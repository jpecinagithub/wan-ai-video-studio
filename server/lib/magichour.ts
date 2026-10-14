/**
 * Proveedor Magic Hour (plan gratuito): generación de vídeo asíncrona.
 *
 * Documentación oficial (verificada 2026-10-14):
 * - POST https://api.magichour.ai/v1/text-to-video  (Bearer <api_key>)
 *   → { id, credits_charged }
 * - GET  https://api.magichour.ai/v1/video-projects/{id}
 *   → { id, status, downloads: [{ url, expires_at }], error, credits_charged }
 *
 * Estados: draft | queued | rendering | complete | error | canceled.
 * El modelo expuesto por la app es `ltx-2.5` (el `default` del plan gratuito):
 * duraciones enteras 1-60 s, 16:9/9:16/1:1, 480p/720p/1080p, audio sin coste
 * extra, solo texto a vídeo (sin imágenes de referencia).
 */

import { HttpError } from './errors.js';

/** Registro estructurado de eventos del proveedor (logs del servidor). */
function logProveedor(evento: string, detalle: Record<string, unknown>): void {
  console.log(JSON.stringify({ ambito: 'magichour-provider', evento, ...detalle }));
}

const BASE_URL = 'https://api.magichour.ai/v1';

export const MODELO_MAGICHOUR = 'magichour/ltx-2.5';

/** Prefijo de los taskId que pertenecen a Magic Hour (para /api/video/status). */
export const PREFIJO_TASK_MAGICHOUR = 'mh-';

export interface ParametrosVideoMagicHour {
  prompt: string;
  duracion: number;
  resolucion: string;
  aspecto: string;
  audio: boolean;
}

export type EstadoMagicHour =
  | 'pendiente'
  | 'procesando'
  | 'completado'
  | 'error';

export interface ResultadoCreacion {
  taskId: string;
  creditosEstimados: number | null;
}

export interface ResultadoEstado {
  estado: EstadoMagicHour;
  /** URL pública del MP4 cuando está completado. */
  videoUrl?: string;
  mensaje?: string;
}

function claveApi(): string {
  const clave = process.env.MAGIC_HOUR_API_KEY;
  if (!clave || clave.trim() === '') {
    throw new HttpError(
      500,
      'MISSING_CONFIGURATION',
      'Falta la clave de Magic Hour en el servidor (MAGIC_HOUR_API_KEY).',
    );
  }
  return clave.trim();
}

/** Lee un cuerpo de error JSON sin lanzar. */
async function leerCuerpoSeguro(respuesta: Response): Promise<Record<string, any>> {
  try {
    const texto = await respuesta.text();
    if (!texto) return {};
    return JSON.parse(texto) as Record<string, any>;
  } catch {
    return {};
  }
}

function mensajeProveedor(cuerpo: Record<string, any>): string {
  const err = cuerpo.error;
  if (typeof err === 'string' && err.trim() !== '') return err;
  if (err && typeof err === 'object') {
    if (typeof err.message === 'string' && err.message.trim() !== '') return err.message;
  }
  if (typeof cuerpo.message === 'string' && cuerpo.message.trim() !== '') return cuerpo.message;
  if (typeof cuerpo.detail === 'string' && cuerpo.detail.trim() !== '') return cuerpo.detail;
  return '';
}

/** Traduce un error HTTP del proveedor a un HttpError honesto. */
export function mapearErrorMagicHour(status: number, cuerpo: Record<string, any>): HttpError {
  const detalle = mensajeProveedor(cuerpo);
  const conDetalle = detalle !== '' ? ` Detalle del proveedor: ${detalle}` : '';

  if (status === 401 || status === 403) {
    return new HttpError(
      status === 401 ? 401 : 403,
      'UNAUTHORIZED',
      'La clave de Magic Hour no es válida o no tiene permiso.' + conDetalle,
    );
  }
  if (status === 402) {
    return new HttpError(
      402,
      'PAYMENT_REQUIRED',
      'Sin créditos suficientes en Magic Hour (ni gratuitos ni de pago).' + conDetalle,
    );
  }
  if (status === 400 || status === 422) {
    return new HttpError(
      400,
      'BAD_REQUEST',
      'Magic Hour rechazó la petición.' + (detalle !== '' ? ` ${detalle}` : ' Revisa la duración, la resolución o el prompt.'),
    );
  }
  if (status === 429) {
    return new HttpError(429, 'RATE_LIMITED', 'Demasiadas peticiones a Magic Hour. Espera unos minutos y reintenta.');
  }
  if (status >= 500) {
    return new HttpError(502, 'PROVIDER_ERROR', 'Magic Hour devolvió un error interno.' + conDetalle);
  }
  return new HttpError(502, 'PROVIDER_ERROR', `Magic Hour respondió con HTTP ${status}.` + conDetalle);
}

async function peticion<T>(ruta: string, init: RequestInit): Promise<T> {
  // La clave se lee ANTES del try: un fallo de configuración (500) no debe
  // enmascararse como un error de red (502).
  const clave = claveApi();
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new HttpError(502, 'PROVIDER_ERROR', `No se pudo contactar con Magic Hour: ${String(error)}`);
  }

  if (!respuesta.ok) {
    const cuerpo = await leerCuerpoSeguro(respuesta);
    throw mapearErrorMagicHour(respuesta.status, cuerpo);
  }

  try {
    return (await respuesta.json()) as T;
  } catch {
    throw new HttpError(502, 'PROVIDER_ERROR', 'Magic Hour devolvió una respuesta no válida.');
  }
}

interface RespuestaCreacion {
  id?: string;
  credits_charged?: number;
}

interface Descarga {
  url?: string;
  expires_at?: string;
}

interface RespuestaEstado {
  id?: string;
  status?: string;
  downloads?: Descarga[];
  error?: unknown;
  credits_charged?: number;
}

/**
 * Crea un trabajo de texto a vídeo en Magic Hour.
 * Devuelve el taskId con el prefijo `mh-` (para /api/video/status).
 */
export async function crearVideoMagicHour(
  parametros: ParametrosVideoMagicHour,
): Promise<ResultadoCreacion> {
  const cuerpo = {
    end_seconds: parametros.duracion,
    aspect_ratio: parametros.aspecto,
    resolution: parametros.resolucion,
    model: 'ltx-2.5',
    audio: parametros.audio,
    style: { prompt: parametros.prompt },
    name: `Video Studio - ${new Date().toISOString()}`,
  };

  logProveedor('video_crear', {
    duracion: parametros.duracion,
    resolucion: parametros.resolucion,
    aspecto: parametros.aspecto,
    audio: parametros.audio,
  });

  const datos = await peticion<RespuestaCreacion>('/text-to-video', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });

  if (!datos.id || typeof datos.id !== 'string') {
    logProveedor('video_crear_sin_id', {});
    throw new HttpError(502, 'PROVIDER_ERROR', 'Magic Hour no devolvió el identificador del trabajo.');
  }

  return {
    taskId: `${PREFIJO_TASK_MAGICHOUR}${datos.id}`,
    creditosEstimados: typeof datos.credits_charged === 'number' ? datos.credits_charged : null,
  };
}

/** Extrae el id real de Magic Hour a partir de un taskId con prefijo `mh-`. */
export function idRealMagicHour(taskId: string): string {
  if (!taskId.startsWith(PREFIJO_TASK_MAGICHOUR) || taskId.length <= PREFIJO_TASK_MAGICHOUR.length) {
    throw new HttpError(400, 'BAD_REQUEST', 'El identificador de tarea no es válido.');
  }
  return taskId.slice(PREFIJO_TASK_MAGICHOUR.length);
}

/**
 * Consulta el estado de un trabajo de Magic Hour y lo normaliza.
 * Estados del proveedor: draft | queued | rendering | complete | error | canceled.
 */
export async function consultarEstadoMagicHour(taskId: string): Promise<ResultadoEstado> {
  const id = idRealMagicHour(taskId);
  const datos = await peticion<RespuestaEstado>(`/video-projects/${encodeURIComponent(id)}`, {
    method: 'GET',
  });

  const estado = datos.status ?? 'unknown';

  if (estado === 'complete') {
    const descarga = Array.isArray(datos.downloads) ? datos.downloads[0] : undefined;
    const url = descarga && typeof descarga.url === 'string' ? descarga.url : undefined;
    if (!url) {
      logProveedor('video_completado_sin_url', { id });
      throw new HttpError(502, 'PROVIDER_ERROR', 'Magic Hour marcó el trabajo como completado pero no devolvió la URL del vídeo.');
    }
    logProveedor('video_completado', { id });
    return { estado: 'completado', videoUrl: url };
  }

  if (estado === 'error') {
    const detalle =
      datos.error && typeof datos.error === 'object' && 'message' in datos.error
        ? String((datos.error as { message: unknown }).message)
        : mensajeProveedor(datos as unknown as Record<string, any>);
    logProveedor('video_error', { id, detalle });
    throw new HttpError(
      502,
      'PROVIDER_ERROR',
      `Magic Hour no pudo generar el vídeo.${detalle !== '' ? ` Detalle: ${detalle}` : ' Los créditos se devuelven automáticamente.'}`,
    );
  }

  if (estado === 'canceled') {
    logProveedor('video_cancelado', { id });
    throw new HttpError(410, 'PROVIDER_ERROR', 'El trabajo se canceló en Magic Hour.');
  }

  if (estado === 'queued' || estado === 'rendering' || estado === 'draft') {
    return {
      estado: estado === 'queued' ? 'pendiente' : 'procesando',
      mensaje: estado === 'queued' ? 'En cola en Magic Hour…' : 'Generando el vídeo en Magic Hour…',
    };
  }

  logProveedor('video_estado_desconocido', { id, estado });
  throw new HttpError(502, 'PROVIDER_ERROR', `Magic Hour devolvió un estado desconocido: ${estado}.`);
}

/** true si el modelo pertenece a Magic Hour. */
export function esModeloMagicHour(modelId: string): boolean {
  return modelId.startsWith('magichour/');
}
