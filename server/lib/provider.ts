import { HttpError, mapProviderError } from './errors.js';
import type { ModelIdApi } from './validation.js';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  Proveedor REAL — Alibaba Cloud Model Studio (verificado 2026-10-09)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoints verificados contra la documentación oficial:
 * - Crear tarea:  POST {base}/services/aigc/video-generation/video-synthesis
 *   con cabecera X-DashScope-Async: enable (obligatoria; sin ella → 403).
 * - Estado:       GET  {base}/tasks/{task_id} con Authorization: Bearer <key>.
 *
 * No existe modo demo: todo lo que aquí corre habla con el proveedor real.
 */

export type EstadoTareaProveedor =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export interface EntradaCrearVideo {
  modelId: ModelIdApi;
  prompt: string;
  duracionSegundos: number;
  resolucion: '480p' | '720p' | '1080p';
  /** 'adaptive' | '16:9' | '21:9' | '9:16' | '1:1' | '4:3' | '3:4' (se normaliza 'auto' → 'adaptive'). */
  aspecto: string;
  audio: boolean;
  semilla?: number;
  mejoraPrompt?: boolean;
  marcaAgua?: boolean;
  idPeticionCliente?: string;
  /** Imágenes de referencia (máx. 10, data URI base64). Se envían en input.media. */
  media?: Array<{ type: 'reference_image'; url: string }>;
}

export interface UsoTareaProveedor {
  duracion?: number;
  fps?: number;
  ratio?: string;
}

export interface InfoTareaProveedor {
  taskId: string;
  estado: EstadoTareaProveedor;
  videoUrl?: string;
  mensajeError?: string;
  uso?: UsoTareaProveedor;
  /** Las URL de vídeo del proveedor son temporales (válidas 24h). */
  expiraEn?: string;
  /** Respuesta cruda del proveedor (solo para diagnóstico en servidor). */
  cruda?: unknown;
}

export interface EntornoProveedor {
  apiKey: string;
  region: string;
  baseUrl: string;
}

const REGION_POR_DEFECTO = 'ap-southeast-1';
const BASE_URL_LEGACY = 'https://dashscope-intl.aliyuncs.com/api/v1';
const TIMEOUT_CREACION_MS = 30_000;
const TIMEOUT_ESTADO_MS = 15_000;
const ESPERA_REINTENTO_MS = 1_000;
const LONGITUD_PROMPT_LOG = 60;

/**
 * Lee y valida las variables de entorno del servidor.
 * Orden de resolución de la base URL (verificado 2026-10-09):
 *  1) ALIBABA_API_BASE_URL explícita gana;
 *  2) si no, se construye desde ALIBABA_REGION + ALIBABA_WORKSPACE_ID
 *     → https://{workspaceId}.{region}.maas.aliyuncs.com/api/v1;
 *  3) si no, legacy https://dashscope-intl.aliyuncs.com/api/v1.
 * Solo ALIBABA_API_KEY es obligatoria. La API key NUNCA sale de aquí:
 * no se registra, no se devuelve al cliente.
 */
export function readProviderEnv(): EntornoProveedor {
  const apiKey = process.env.ALIBABA_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      500,
      'MISSING_CONFIGURATION',
      'Falta la variable de entorno ALIBABA_API_KEY en el servidor. Revisa la configuración en Vercel.',
    );
  }

  const explicita = (process.env.ALIBABA_API_BASE_URL ?? '').trim();
  const region = (process.env.ALIBABA_REGION ?? '').trim() || REGION_POR_DEFECTO;

  let baseUrl: string;
  if (explicita) {
    baseUrl = explicita.replace(/\/+$/, '');
  } else {
    const workspaceId = (process.env.ALIBABA_WORKSPACE_ID ?? '').trim();
    baseUrl = workspaceId
      ? `https://${workspaceId}.${region}.maas.aliyuncs.com/api/v1`
      : BASE_URL_LEGACY;
  }

  return { apiKey, region, baseUrl };
}

/** 480p → 480P (el proveedor exige mayúsculas). */
function resolucionApi(resolucion: EntradaCrearVideo['resolucion']): string {
  return resolucion.toUpperCase();
}

/** 'auto' → 'adaptive'; el resto de ratios se pasan tal cual. */
function ratioApi(aspecto: string): string {
  return aspecto === 'auto' ? 'adaptive' : aspecto;
}

function truncarPrompt(prompt: string): string {
  return prompt.length > LONGITUD_PROMPT_LOG
    ? `${prompt.slice(0, LONGITUD_PROMPT_LOG)}…`
    : prompt;
}

/** Log de servidor sanitizado: nunca la key, prompt truncado, con request_id. */
function logProveedor(evento: string, detalle: Record<string, unknown>): void {
  console.log(JSON.stringify({ ambito: 'alibaba-provider', evento, ...detalle }));
}

function esErrorAbortado(err: unknown): boolean {
  return (
    err instanceof DOMException && err.name === 'AbortError' ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

async function leerCuerpoSeguro(respuesta: Response): Promise<Record<string, any>> {
  try {
    const json = (await respuesta.json()) as unknown;
    return typeof json === 'object' && json !== null ? (json as Record<string, any>) : {};
  } catch {
    return {};
  }
}

function mapearEstadoProveedor(estado: unknown): EstadoTareaProveedor {
  switch (typeof estado === 'string' ? estado.toUpperCase() : '') {
    case 'PENDING':
      return 'pending';
    case 'RUNNING':
      return 'processing';
    case 'SUCCEEDED':
      return 'succeeded';
    case 'FAILED':
      return 'failed';
    case 'CANCELED':
      return 'cancelled';
    default:
      // UNKNOWN (tarea inexistente o caducada) u otros valores no documentados.
      return 'unknown';
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Proveedor de generación de vídeo (Alibaba Cloud Model Studio).
 * La cancelación en el proveedor NO está verificada: no se implementa.
 */
export class AlibabaVideoProvider {
  constructor(private readonly env: EntornoProveedor) {}

  /**
   * Crea una tarea de generación (asíncrona) en el proveedor.
   * SIN reintento automático: un reintento podría duplicar la tarea
   * (las peticiones fallidas no se facturan, pero las duplicadas sí).
   */
  async crearTareaVideo(entrada: EntradaCrearVideo): Promise<InfoTareaProveedor> {
    const parameters: Record<string, unknown> = {
      resolution: resolucionApi(entrada.resolucion),
      ratio: ratioApi(entrada.aspecto),
      duration: entrada.duracionSegundos,
      audio: entrada.audio,
    };
    // Solo los parámetros opcionales definidos (regla oficial).
    if (entrada.semilla !== undefined) parameters.seed = entrada.semilla;
    if (entrada.mejoraPrompt !== undefined) parameters.prompt_extend = entrada.mejoraPrompt;
    if (entrada.marcaAgua !== undefined) parameters.watermark = entrada.marcaAgua;

    const url = `${this.env.baseUrl}/services/aigc/video-generation/video-synthesis`;
    const imagenes = entrada.media?.length ?? 0;

    const input: Record<string, unknown> = { prompt: entrada.prompt };
    if (imagenes > 0) {
      // Modo con imágenes de referencia: el prompt las menciona como "Image 1", "Image 2", ...
      input.media = entrada.media!.map((m) => ({ type: m.type, url: m.url }));
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.env.apiKey}`,
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: entrada.modelId,
          input,
          parameters,
        }),
        signal: AbortSignal.timeout(TIMEOUT_CREACION_MS),
      });
    } catch (err) {
      if (esErrorAbortado(err)) {
        logProveedor('crear_timeout', { prompt: truncarPrompt(entrada.prompt), imagenes });
      } else {
        logProveedor('crear_red_error', { prompt: truncarPrompt(entrada.prompt), imagenes });
      }
      throw new HttpError(
        502,
        'PROVIDER_ERROR',
        'No se pudo contactar con Alibaba Cloud Model Studio.',
      );
    }

    const cuerpo = await leerCuerpoSeguro(respuesta);
    const requestId = cuerpo.request_id as string | undefined;

    if (!respuesta.ok) {
      logProveedor('crear_error', {
        status: respuesta.status,
        code: cuerpo.code,
        requestId,
        prompt: truncarPrompt(entrada.prompt),
        imagenes,
      });
      throw mapProviderError(respuesta.status, cuerpo.code, cuerpo.message);
    }

    const salida = (cuerpo.output ?? {}) as Record<string, unknown>;
    const taskId = salida.task_id as string | undefined;
    if (!taskId) {
      logProveedor('crear_sin_task_id', { requestId, prompt: truncarPrompt(entrada.prompt), imagenes });
      throw new HttpError(
        502,
        'PROVIDER_ERROR',
        'El proveedor no devolvió un identificador de tarea. Inténtalo de nuevo.',
      );
    }

    logProveedor('crear_ok', { taskId, requestId, prompt: truncarPrompt(entrada.prompt), imagenes });
    return { taskId, estado: 'pending', cruda: salida };
  }

  /**
   * Consulta el estado de una tarea existente.
   * 1 reintento (1s de espera) solo en 5xx o fallo de red.
   */
  async obtenerTareaVideo(taskId: string): Promise<InfoTareaProveedor> {
    const url = `${this.env.baseUrl}/tasks/${encodeURIComponent(taskId)}`;

    let respuesta: Response | undefined;
    let ultimoErrorRed: unknown;
    for (let intento = 0; intento < 2; intento++) {
      try {
        const candidata = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.env.apiKey}` },
          signal: AbortSignal.timeout(TIMEOUT_ESTADO_MS),
        });
        if (candidata.status >= 500 && intento === 0) {
          logProveedor('estado_reintento_5xx', { taskId, status: candidata.status });
          await candidata.arrayBuffer().catch(() => undefined);
          await esperar(ESPERA_REINTENTO_MS);
          continue;
        }
        respuesta = candidata;
        break;
      } catch (err) {
        ultimoErrorRed = err;
        if (intento === 0) {
          logProveedor('estado_reintento_red', { taskId });
          await esperar(ESPERA_REINTENTO_MS);
          continue;
        }
      }
    }

    if (!respuesta) {
      logProveedor('estado_red_error', { taskId, abortado: esErrorAbortado(ultimoErrorRed) });
      throw new HttpError(
        502,
        'PROVIDER_ERROR',
        'No se pudo contactar con Alibaba Cloud Model Studio.',
      );
    }

    const cuerpo = await leerCuerpoSeguro(respuesta);
    const requestId = cuerpo.request_id as string | undefined;

    if (!respuesta.ok) {
      logProveedor('estado_error', { taskId, status: respuesta.status, code: cuerpo.code, requestId });
      throw mapProviderError(respuesta.status, cuerpo.code, cuerpo.message);
    }

    const salida = (cuerpo.output ?? {}) as Record<string, unknown>;
    const estado = mapearEstadoProveedor(salida.task_status);
    const info: InfoTareaProveedor = { taskId, estado, cruda: salida };

    if (estado === 'succeeded') {
      const videoUrl = salida.video_url as string | undefined;
      if (videoUrl) info.videoUrl = videoUrl;
      const uso = (salida.usage ?? {}) as Record<string, unknown>;
      const usoNormalizado: UsoTareaProveedor = {};
      if (typeof uso.duration === 'number') usoNormalizado.duracion = uso.duration;
      if (typeof uso.fps === 'number') usoNormalizado.fps = uso.fps;
      if (typeof uso.ratio === 'string') usoNormalizado.ratio = uso.ratio;
      if (Object.keys(usoNormalizado).length > 0) info.uso = usoNormalizado;
      // Las URL de vídeo del proveedor son temporales: válidas 24h.
      info.expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    if (estado === 'failed') {
      const mensaje = (salida.message as string | undefined) ?? '';
      info.mensajeError = mensaje.trim() || 'La generación del vídeo falló en el proveedor.';
    }

    if (estado === 'unknown') {
      logProveedor('estado_desconocido', { taskId, requestId });
    }

    return info;
  }
}
