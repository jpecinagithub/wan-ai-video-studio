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
        /** El prompt viaja en la ruta de una petición GET en Pollinations (2000); en Magic Hour va en JSON (5000). */
        promptMax: 5000,
        promptMaxPollinations: 2000,
        resoluciones: ['480p', '720p', '1080p'],
        relacionesAspecto: ['16:9', '9:16'],
        modelos: MODELOS.map((m) => ({
          id: m.id,
          duraciones: m.duraciones,
          resoluciones: m.resoluciones,
          maxImagenes: m.maxImagenes,
          tipoCoste: m.tipoCoste,
          generaAudio: m.generaAudio,
        })),
      },
      integracion: {
        estado: 'disponible',
        // Decisión expresa del usuario: este proyecto NO tiene modo demo.
        modoDemo: false,
        proveedores: [
          { nombre: 'Pollinations', tipoCoste: 'pago', claveEnv: 'POLLINATIONS_API_KEY' },
          { nombre: 'Magic Hour', tipoCoste: 'gratis', claveEnv: 'MAGIC_HOUR_API_KEY' },
        ],
        modelos: MODELOS.map((m) => m.id),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
