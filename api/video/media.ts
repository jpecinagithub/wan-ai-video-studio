import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, readJsonBody, requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import {
  PollinationsVideoProvider,
  decodificarDataUrl,
  readProviderEnv,
} from '../../server/lib/provider.js';
import { MediaUploadBodySchema, formatZodIssues } from '../../server/lib/validation.js';

/** Una sola imagen comprimida en cliente (~300 KB → ~420 KB en base64). */
const MAX_BODY_BYTES = 1 * 1024 * 1024;

/**
 * POST /api/video/media
 *
 * Sube una imagen de referencia (data URI) al almacenamiento de medios de
 * Pollinations y devuelve su URL pública. Las imágenes deben subirse ANTES
 * de generar: /api/video/generate acepta solo URLs, de modo que los
 * reintentos de una generación sean peticiones idénticas (sin re-facturar).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'POST')) return;
    res.setHeader('Cache-Control', 'no-store');

    const cuerpo = readJsonBody(
      req,
      MAX_BODY_BYTES,
      'La imagen es demasiado grande (máx. ~300 KB comprimida).',
    );
    const parsed = MediaUploadBodySchema.safeParse(cuerpo);
    if (!parsed.success) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'La imagen enviada no es válida.',
        formatZodIssues(parsed.error),
      );
    }

    const { datos, contentType } = decodificarDataUrl(parsed.data.dataUrl);
    const extension = contentType.split('/')[1] ?? 'jpg';
    const nombre = `ref-${Date.now()}.${extension}`;

    const env = readProviderEnv();
    const proveedor = new PollinationsVideoProvider(env);
    const url = await proveedor.subirMedio(datos, contentType, nombre);

    sendOk(res, { url });
  } catch (err) {
    sendError(res, err);
  }
}
