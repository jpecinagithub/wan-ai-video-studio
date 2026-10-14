import { HttpError, mapProviderError } from './errors.js';
import type { ModelIdApi } from './validation.js';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  Proveedor REAL — Pollinations (gen.pollinations.ai), verificado 2026-10-14
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoints verificados contra la documentación oficial y el OpenAPI en vivo:
 * - Generar vídeo: GET {base}/video/{prompt}?model=…&duration=…&resolution=…
 *   &aspectRatio=…&audio=…&seed=…&image=url1|url2  → 200 con el MP4 directo.
 *   La generación es SÍNCRONA: la misma petición reintentada de forma
 *   idéntica (mismos parámetros y seed) no se vuelve a facturar: el
 *   proveedor espera a la generación en curso o devuelve el resultado
 *   cacheado. Solo la generación se factura; reintentos y cache no.
 * - Subir medios: POST https://media.pollinations.ai/upload → {id, url, …}.
 *   Las imágenes de referencia y el MP4 resultante se alojan aquí (URLs
 *   públicas no listadas, ciclo de vida de 30 días).
 *
 * image[0] = fotograma inicial, image[1] = fotograma final (opcional).
 * No existe modo demo: todo lo que aquí corre habla con el proveedor real.
 * La API key NUNCA sale de aquí: no se registra, no se devuelve al cliente.
 */

export interface EntradaGenerarVideo {
  modelId: ModelIdApi;
  prompt: string;
  duracionSegundos: number;
  resolucion: '480p' | '720p' | '1080p';
  aspecto: '16:9' | '9:16';
  audio: boolean;
  semilla?: number;
  /** URLs públicas https (fotograma inicial y, opcionalmente, final). */
  imagenes?: string[];
}

export interface EntornoProveedor {
  apiKey: string;
}

export type ResultadoVideo =
  | { estado: 'completado'; datos: Buffer; contentType: string }
  | { estado: 'procesando' };

const BASE_VIDEO = 'https://gen.pollinations.ai';
const BASE_MEDIA = 'https://media.pollinations.ai';
/** Límite de la petición de vídeo: por debajo del timeout de la función serverless. */
const TIMEOUT_VIDEO_MS = 55_000;
const TIMEOUT_MEDIA_MS = 30_000;
const LONGITUD_PROMPT_LOG = 60;

/**
 * Lee y valida las variables de entorno del servidor.
 * Solo POLLINATIONS_API_KEY es obligatoria (clave `sk_` de
 * enter.pollinations.ai/keys). La API key NUNCA sale de aquí.
 */
export function readProviderEnv(): EntornoProveedor {
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      500,
      'MISSING_CONFIGURATION',
      'Falta la variable de entorno POLLINATIONS_API_KEY en el servidor. Créala en enter.pollinations.ai/keys y configúrala en Vercel.',
    );
  }
  return { apiKey };
}

function truncarPrompt(prompt: string): string {
  return prompt.length > LONGITUD_PROMPT_LOG ? `${prompt.slice(0, LONGITUD_PROMPT_LOG)}…` : prompt;
}

/** Log de servidor sanitizado: nunca la key, prompt truncado. */
function logProveedor(evento: string, detalle: Record<string, unknown>): void {
  console.log(JSON.stringify({ ambito: 'pollinations-provider', evento, ...detalle }));
}

function esErrorAbortado(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

/** Lee un cuerpo de error JSON sin lanzar ({status, error:{code,message}}). */
async function leerCuerpoSeguro(respuesta: Response): Promise<Record<string, any>> {
  try {
    const json = (await respuesta.json()) as unknown;
    return typeof json === 'object' && json !== null ? (json as Record<string, any>) : {};
  } catch {
    return {};
  }
}

/** Decodifica un data URI de imagen a sus bytes y su tipo de contenido. */
export function decodificarDataUrl(dataUrl: string): { datos: Buffer; contentType: string } {
  const coincidencia = /^data:(image\/(?:jpeg|jpg|png|webp|bmp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );
  if (!coincidencia) {
    throw new HttpError(400, 'BAD_REQUEST', 'La imagen de referencia no es un data URI válido.');
  }
  const contentType = coincidencia[1] === 'image/jpg' ? 'image/jpeg' : coincidencia[1];
  return { datos: Buffer.from(coincidencia[2], 'base64'), contentType };
}

/**
 * Proveedor de generación de vídeo (Pollinations).
 * La generación es síncrona; ante un timeout propio se devuelve
 * {estado:'procesando'} para que el cliente reintente la petición
 * idéntica (el proveedor la retoma sin volver a facturar).
 */
export class PollinationsVideoProvider {
  constructor(private readonly env: EntornoProveedor) {}

  /** Construye la URL de generación (determinista: base de la idempotencia). */
  urlGeneracion(entrada: EntradaGenerarVideo): string {
    const params = new URLSearchParams({
      model: entrada.modelId,
      duration: String(entrada.duracionSegundos),
      resolution: entrada.resolucion,
      aspectRatio: entrada.aspecto,
      audio: entrada.audio ? 'true' : 'false',
    });
    if (entrada.semilla !== undefined) params.set('seed', String(entrada.semilla));
    if (entrada.imagenes && entrada.imagenes.length > 0) {
      params.set('image', entrada.imagenes.join('|'));
    }
    return `${BASE_VIDEO}/video/${encodeURIComponent(entrada.prompt)}?${params.toString()}`;
  }

  async generarVideo(entrada: EntradaGenerarVideo): Promise<ResultadoVideo> {
    const url = this.urlGeneracion(entrada);
    const resumen = {
      modelo: entrada.modelId,
      duracion: entrada.duracionSegundos,
      resolucion: entrada.resolucion,
      prompt: truncarPrompt(entrada.prompt),
      imagenes: entrada.imagenes?.length ?? 0,
    };

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.env.apiKey}` },
        signal: AbortSignal.timeout(TIMEOUT_VIDEO_MS),
      });
    } catch (err) {
      if (esErrorAbortado(err)) {
        // Timeout propio: la generación puede seguir en el proveedor.
        // El cliente reintentará la petición idéntica y la retomará.
        logProveedor('video_timeout_propio', resumen);
        return { estado: 'procesando' };
      }
      logProveedor('video_red_error', resumen);
      throw new HttpError(502, 'PROVIDER_ERROR', 'No se pudo contactar con Pollinations.');
    }

    if (!respuesta.ok) {
      const cuerpo = await leerCuerpoSeguro(respuesta);
      const errorProv = (cuerpo.error ?? {}) as { code?: string; message?: string };
      logProveedor('video_error', {
        ...resumen,
        status: respuesta.status,
        code: errorProv.code,
      });
      throw mapProviderError(respuesta.status, errorProv.code, errorProv.message);
    }

    const contentType = respuesta.headers.get('content-type') ?? '';
    if (!/video|octet-stream/i.test(contentType)) {
      logProveedor('video_contenido_inesperado', { ...resumen, contentType });
      throw new HttpError(
        502,
        'PROVIDER_ERROR',
        'El proveedor devolvió una respuesta inesperada. Inténtalo de nuevo.',
      );
    }

    const datos = Buffer.from(await respuesta.arrayBuffer());
    if (datos.length === 0) {
      throw new HttpError(502, 'PROVIDER_ERROR', 'El proveedor devolvió un vídeo vacío.');
    }

    logProveedor('video_ok', { ...resumen, bytes: datos.length });
    return { estado: 'completado', datos, contentType: contentType || 'video/mp4' };
  }

  /**
   * Sube un binario al almacenamiento de medios de Pollinations.
   * Devuelve la URL pública (no listada, ciclo de vida de 30 días).
   */
  async subirMedio(datos: Buffer, contentType: string, nombre: string): Promise<string> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${BASE_MEDIA}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.apiKey}`,
          'Content-Type': contentType,
          'X-File-Name': nombre,
        },
        body: new Uint8Array(datos),
        signal: AbortSignal.timeout(TIMEOUT_MEDIA_MS),
      });
    } catch (err) {
      logProveedor('upload_red_error', { nombre, abortado: esErrorAbortado(err) });
      throw new HttpError(502, 'PROVIDER_ERROR', 'No se pudo publicar el archivo generado.');
    }

    const cuerpo = await leerCuerpoSeguro(respuesta);
    if (!respuesta.ok) {
      const errorProv = (cuerpo.error ?? {}) as { code?: string; message?: string };
      logProveedor('upload_error', { nombre, status: respuesta.status, code: errorProv.code });
      throw mapProviderError(respuesta.status, errorProv.code, errorProv.message);
    }

    const url = typeof cuerpo.url === 'string' ? cuerpo.url : '';
    if (!url) {
      logProveedor('upload_sin_url', { nombre });
      throw new HttpError(502, 'PROVIDER_ERROR', 'El almacenamiento no devolvió una URL válida.');
    }
    logProveedor('upload_ok', { nombre, bytes: datos.length });
    return url;
  }
}
