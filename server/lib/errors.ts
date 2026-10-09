import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

/**
 * Manejo centralizado de errores de la API.
 * - Mensajes en español, pensados para mostrarse al usuario.
 * - Nunca se exponen secretos, trazas internas ni detalles del proveedor.
 */

export type CodigoErrorApi =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'MISSING_CONFIGURATION'
  | 'PROVIDER_NOT_IMPLEMENTED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';

export interface CuerpoErrorApi {
  error: {
    code: CodigoErrorApi;
    message: string;
    details?: unknown;
  };
}

export class HttpError extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: CodigoErrorApi,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'HttpError';
  }
}

export function sendJson(res: VercelResponse, estado: number, cuerpo: unknown): void {
  res.status(estado).json(cuerpo);
}

export function sendOk(res: VercelResponse, cuerpo: unknown, estado = 200): void {
  sendJson(res, estado, cuerpo);
}

/** Convierte cualquier error en una respuesta JSON segura. */
export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof HttpError) {
    const cuerpo: CuerpoErrorApi = {
      error: { code: err.codigo, message: err.message },
    };
    if (err.detalles !== undefined) cuerpo.error.details = err.detalles;
    sendJson(res, err.estado, cuerpo);
    return;
  }
  if (err instanceof z.ZodError) {
    sendJson(res, 400, {
      error: { code: 'BAD_REQUEST', message: 'Los datos enviados no son válidos.' },
    } satisfies CuerpoErrorApi);
    return;
  }
  // Error desconocido: mensaje genérico, sin fugas de información.
  sendJson(res, 500, {
    error: { code: 'INTERNAL_ERROR', message: 'Ha ocurrido un error inesperado en el servidor.' },
  } satisfies CuerpoErrorApi);
}

/**
 * Exige un método HTTP concreto. Devuelve true si es válido;
 * si no, responde 405 con los métodos permitidos y devuelve false.
 */
export function requireMethod(req: VercelRequest, res: VercelResponse, ...metodos: string[]): boolean {
  if (metodos.includes(req.method ?? '')) return true;
  res.setHeader('Allow', metodos.join(', '));
  sendError(res, new HttpError(405, 'METHOD_NOT_ALLOWED', `Método no permitido. Usa: ${metodos.join(', ')}.`));
  return false;
}

/**
 * Lee el cuerpo JSON con límite de tamaño (protección contra abusos).
 * Vercel ya parsea el JSON cuando el Content-Type es application/json.
 */
export function readJsonBody(req: VercelRequest, maxBytes: number, mensajeExceso?: string): unknown {
  const longitud = Number(req.headers['content-length'] ?? 0);
  if (longitud > maxBytes) {
    throw new HttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      mensajeExceso ?? 'La solicitud es demasiado grande. Reduce el tamaño del prompt.',
    );
  }
  const cuerpo = req.body as unknown;
  if (cuerpo === undefined || cuerpo === null || cuerpo === '') return {};
  if (typeof cuerpo === 'string') {
    try {
      return JSON.parse(cuerpo) as unknown;
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', 'El cuerpo de la solicitud no es un JSON válido.');
    }
  }
  return cuerpo;
}

/**
 * Mapea un error del proveedor (Alibaba Cloud Model Studio) a un HttpError
 * con mensaje en español listo para mostrar al usuario.
 *
 * Reglas verificadas contra la documentación oficial (2026-10-09):
 * - 401 InvalidApiKey → la key no es válida o no es de la región configurada.
 * - 403 → permisos del modelo; Unpurchased/FreeTierOnly → sin habilitar o cuota agotada.
 * - 404 → modelo no encontrado en la región.
 * - 429 → el cliente puede reintentar tras una pausa (sin reintento automático en el servidor).
 * - 400 InvalidParameter → se adjunta el mensaje del proveedor.
 * - 5xx del proveedor → 502 propio con mensaje genérico.
 */
export function mapProviderError(
  statusHttp: number,
  code?: string,
  message?: string,
): HttpError {
  const codigo = (code ?? '').trim();
  const mensajeProveedor = (message ?? '').trim();

  if (statusHttp === 401) {
    if (codigo === 'InvalidApiKey') {
      return new HttpError(
        401,
        'UNAUTHORIZED',
        'La API key no es válida o no corresponde a la región configurada. Revisa ALIBABA_API_KEY y ALIBABA_REGION.',
      );
    }
    return new HttpError(
      401,
      'UNAUTHORIZED',
      'No autorizado: comprueba la configuración del servidor (región/workspace).',
    );
  }

  if (statusHttp === 403) {
    if (codigo === 'Unpurchased' || codigo === 'FreeTierOnly') {
      return new HttpError(
        403,
        'FORBIDDEN',
        'El servicio no está habilitado o la cuota gratuita se ha agotado.',
      );
    }
    return new HttpError(
      403,
      'FORBIDDEN',
      'El proveedor rechazó la petición (403). Revisa los permisos del modelo en Model Studio.',
    );
  }

  if (statusHttp === 404) {
    return new HttpError(404, 'NOT_FOUND', 'Modelo no encontrado en la región configurada.');
  }

  if (statusHttp === 429) {
    return new HttpError(
      429,
      'RATE_LIMITED',
      'Límite de peticiones alcanzado. Espera unos segundos e inténtalo de nuevo.',
    );
  }

  if (statusHttp === 400 && codigo === 'InvalidParameter') {
    return new HttpError(
      400,
      'BAD_REQUEST',
      `Parámetros no válidos: ${mensajeProveedor || 'revisa los parámetros enviados.'}`,
    );
  }

  if (statusHttp >= 500) {
    return new HttpError(
      502,
      'PROVIDER_ERROR',
      'Error interno del proveedor. Inténtalo de nuevo más tarde.',
    );
  }

  // Cualquier otro error del proveedor: mensaje genérico sin fugas.
  return new HttpError(
    502,
    'PROVIDER_ERROR',
    'El proveedor de generación de vídeo devolvió un error. Inténtalo de nuevo más tarde.',
  );
}
