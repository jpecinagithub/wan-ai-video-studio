import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { MONEDA_PRECIOS, MODELOS } from '../../server/lib/capabilities.js';

/**
 * GET /api/video/models
 * Devuelve los modelos disponibles y sus capacidades.
 * - Pollinations: precios en pollen (requieren Pollen de pago).
 * - Magic Hour: modelo gratuito (créditos gratuitos al registrarse).
 * No expone secretos ni detalles internos de los proveedores.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'GET')) return;

    sendOk(res, {
      modelos: MODELOS,
      moneda: MONEDA_PRECIOS,
      equivalencia: '$1 ≈ 1 pollen (FAQ oficial de Pollinations)',
      unidadPrecio: 'pollen por segundo de vídeo generado',
      nota: 'Las peticiones fallidas no se facturan. Los modelos de Pollinations requieren Pollen de pago; el modelo de Magic Hour usa los créditos gratuitos de tu cuenta.',
    });
  } catch (err) {
    sendError(res, err);
  }
}
