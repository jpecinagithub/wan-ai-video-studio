import type {
  AppConfig,
  GenerationRequest,
  GenerationResponse,
  ModelCapability,
  TaskStatusResponse,
} from '../types';

const BASE = '/api/video';

/** Error normalizado de la API (mensajes en español, sin datos sensibles). */
export class ApiClientError extends Error {
  constructor(
    public estadoHttp: number,
    public codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ApiClientError';
  }
}

interface CuerpoError {
  error?: { code?: string; message?: string };
}

async function leerJsonSeguro(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json();
  } catch {
    return {};
  }
}

async function errorApi(respuesta: Response): Promise<ApiClientError> {
  let codigo = 'ERROR_DESCONOCIDO';
  let mensaje = 'Ha ocurrido un error inesperado.';
  const cuerpo = (await leerJsonSeguro(respuesta)) as CuerpoError;
  if (cuerpo.error?.code) codigo = cuerpo.error.code;
  if (cuerpo.error?.message) mensaje = cuerpo.error.message;
  return new ApiClientError(respuesta.status, codigo, mensaje);
}

async function request<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiClientError(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Comprueba tu conexión a internet.');
  }

  // 202 = el proveedor sigue generando: no es un error, se devuelve el cuerpo
  // para que el cliente reintente la petición idéntica.
  if (respuesta.status === 202) {
    return (await leerJsonSeguro(respuesta)) as T;
  }

  if (respuesta.ok) {
    return (await respuesta.json()) as T;
  }

  throw await errorApi(respuesta);
}

/** Cliente tipado de la API serverless. No maneja secretos. */
export const api = {
  /**
   * Sube una imagen de referencia (data URI) al almacenamiento del proveedor.
   * Devuelve su URL pública, lista para usar en la generación.
   */
  subirImagen(dataUrl: string): Promise<{ url: string }> {
    return request<{ url: string }>('/media', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
  },

  /**
   * Genera un vídeo.
   * - Pollinations: la respuesta puede ser 'completado' (con videoUrl) o
   *   'procesando' (202): en ese caso hay que reintentar la petición IDÉNTICA
   *   (mismos parámetros y seed); el proveedor la retoma sin volver a facturar.
   * - Magic Hour: la respuesta es 'pendiente' (201) con el taskId del trabajo;
   *   hay que consultar el estado con `consultarEstado` hasta completarse.
   */
  generarVideo(datos: GenerationRequest): Promise<GenerationResponse> {
    return request<GenerationResponse>('/generate', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  /**
   * Consulta el estado de un trabajo de Magic Hour (taskId con prefijo `mh-`).
   * Responde 'pendiente' | 'procesando' (seguir consultando) o 'completado'
   * (con videoUrl). Si el trabajo falló, lanza ApiClientError.
   */
  consultarEstado(taskId: string): Promise<TaskStatusResponse> {
    return request<TaskStatusResponse>(`/status/${encodeURIComponent(taskId)}`);
  },

  modelos(): Promise<{ modelos: ModelCapability[] }> {
    return request<{ modelos: ModelCapability[] }>('/models');
  },

  configuracion(): Promise<AppConfig> {
    return request<AppConfig>('/config');
  },
};

/**
 * URL del proxy de descarga: el navegador pide el MP4 a nuestra API
 * (evita problemas de CORS con el almacenamiento del proveedor) y esta
 * lo reenvía en streaming.
 */
export function urlDescargaProxy(videoUrl: string, nombre: string): string {
  return `/api/video/download?url=${encodeURIComponent(videoUrl)}&nombre=${encodeURIComponent(nombre)}`;
}
