import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { MODELOS } from '../../server/lib/capabilities.js';
import { MAX_SIMULTANEAS } from '../../server/lib/tareas.js';

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
        promptMax: 20000,
        duracionMin: 2,
        duracionMax: 30,
        resoluciones: ['480p', '720p', '1080p'],
        generacionesSimultaneas: MAX_SIMULTANEAS,
      },
      integracion: {
        estado: 'disponible',
        // Decisión expresa del usuario: este proyecto NO tiene modo demo.
        modoDemo: false,
        modelos: MODELOS.map((m) => m.id),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
