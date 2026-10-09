import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod, sendError, sendOk } from '../lib/errors.js';
import { MONEDA_PRECIOS, MODELOS } from '../lib/capabilities.js';

/**
 * GET /api/video/models
 * Devuelve los modelos disponibles y sus capacidades oficiales.
 * No expone secretos ni detalles internos del proveedor.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'GET')) return;

    sendOk(res, {
      modelos: MODELOS,
      moneda: MONEDA_PRECIOS,
      unidadPrecio: 'segundo de vídeo generado',
      nota: 'Las peticiones fallidas no se facturan.',
    });
  } catch (err) {
    sendError(res, err);
  }
}
