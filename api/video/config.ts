import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { MODELOS } from '../../server/lib/capabilities.js';

/**
 * GET /api/video/config
 * Configuración NO sensible: límites de la aplicación y capacidades.
 * Nunca devuelve secretos ni variables de entorno.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'GET')) return;

    sendOk(res, {
      limites: {
        /** El prompt viaja en la ruta de una petición GET al proveedor. */
        promptMax: 2000,
        resoluciones: ['480p', '720p', '1080p'],
        relacionesAspecto: ['16:9', '9:16'],
        modelos: MODELOS.map((m) => ({
          id: m.id,
          duraciones: m.duraciones,
          resoluciones: m.resoluciones,
          maxImagenes: m.maxImagenes,
        })),
      },
      integracion: {
        estado: 'disponible',
        // Decisión expresa del usuario: este proyecto NO tiene modo demo.
        modoDemo: false,
        proveedor: 'Pollinations',
        modelos: MODELOS.map((m) => m.id),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
