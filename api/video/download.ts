import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, requireMethod, sendError } from '../../server/lib/errors.js';

/**
 * GET /api/video/download?url=<encoded>&nombre=<nombre>
 *
 * Proxy de descarga de vídeos: hace fetch a la URL temporal del proveedor y
 * transmite el cuerpo por streaming SIN cargarlo en memoria, con cabeceras
 * de descarga forzada. Solo acepta hosts de la infraestructura de Alibaba
 * Cloud (lista cerrada) para evitar usos como proxy abierto.
 */

const HOSTS_PERMITIDOS = [
  '.aliyuncs.com',
  'dashscope.aliyuncs.com',
  'dashscope-intl.aliyuncs.com',
  'dashscope-us.aliyuncs.com',
  'maas.aliyuncs.com',
];

const MAX_LONGITUD_NOMBRE = 100;

function hostPermitido(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTS_PERMITIDOS.some((sufijo) => h === sufijo || h.endsWith(`.${sufijo}`));
}

/** Solo alfanuméricos, guiones y guion bajo; si queda vacío, 'video'. */
function sanitizarNombre(nombre: unknown): string {
  const limpio = String(nombre ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .slice(0, MAX_LONGITUD_NOMBRE);
  return limpio || 'video';
}

/** Transmite un ReadableStream web a la respuesta sin acumularlo en memoria. */
async function transmitirPorStreaming(
  cuerpo: ReadableStream<Uint8Array> | null,
  res: VercelResponse,
): Promise<void> {
  if (!cuerpo) {
    res.end();
    return;
  }
  const lector = cuerpo.getReader();
  const alCerrar = () => lector.cancel().catch(() => undefined);
  res.on('close', alCerrar);
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (value && value.length > 0) {
        const puedeSeguir = res.write(value);
        if (!puedeSeguir) await new Promise<void>((r) => res.once('drain', r));
      }
    }
    res.end();
  } finally {
    res.off('close', alCerrar);
    lector.releaseLock();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'GET')) return;

    const rawUrl = req.query.url;
    const urlDescarga = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;
    const rawNombre = req.query.nombre;
    const nombre = Array.isArray(rawNombre) ? rawNombre[0] : rawNombre;

    if (!urlDescarga || typeof urlDescarga !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', 'Falta el parámetro "url".');
    }

    let destino: URL;
    try {
      destino = new URL(urlDescarga);
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', 'URL de descarga no válida.');
    }
    if ((destino.protocol !== 'http:' && destino.protocol !== 'https:') || !hostPermitido(destino.hostname)) {
      throw new HttpError(400, 'BAD_REQUEST', 'URL de descarga no válida.');
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(destino.toString(), { method: 'GET' });
    } catch {
      throw new HttpError(502, 'PROVIDER_ERROR', 'No se pudo descargar el vídeo.');
    }

    if (!respuesta.ok || !respuesta.body) {
      throw new HttpError(502, 'PROVIDER_ERROR', 'No se pudo descargar el vídeo.');
    }

    const nombreArchivo = `${sanitizarNombre(nombre)}.mp4`;
    res.setHeader('Content-Type', respuesta.headers.get('content-type') ?? 'video/mp4');
    const longitud = respuesta.headers.get('content-length');
    if (longitud) res.setHeader('Content-Length', longitud);
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Cache-Control', 'no-store');

    await transmitirPorStreaming(respuesta.body, res);
  } catch (err) {
    sendError(res, err);
  }
}
