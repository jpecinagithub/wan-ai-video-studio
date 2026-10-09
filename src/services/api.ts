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

  if (respuesta.ok) {
    return (await respuesta.json()) as T;
  }

  let codigo = 'ERROR_DESCONOCIDO';
  let mensaje = 'Ha ocurrido un error inesperado.';
  try {
    const cuerpo = (await respuesta.json()) as CuerpoError;
    if (cuerpo.error?.code) codigo = cuerpo.error.code;
    if (cuerpo.error?.message) mensaje = cuerpo.error.message;
  } catch {
    // Respuesta no JSON: se conserva el mensaje genérico.
  }
  throw new ApiClientError(respuesta.status, codigo, mensaje);
}

/** Cliente tipado de la API serverless. No maneja secretos. */
export const api = {
  generarVideo(datos: GenerationRequest): Promise<GenerationResponse> {
    return request<GenerationResponse>('/generate', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  estadoTarea(taskId: string): Promise<TaskStatusResponse> {
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
 * (evita problemas de CORS con el proveedor) y esta lo reenvía en streaming.
 */
export function urlDescargaProxy(videoUrl: string, nombre: string): string {
  return `/api/video/download?url=${encodeURIComponent(videoUrl)}&nombre=${encodeURIComponent(nombre)}`;
}
