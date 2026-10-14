import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import {
  PREFIJO_TASK_MAGICHOUR,
  consultarEstadoMagicHour,
} from '../../server/lib/magichour.js';

/**
 * GET /api/video/status/:taskId
 *
 * Consulta el estado de un trabajo de Magic Hour (proveedor gratuito,
 * asíncrono). Los taskId de Magic Hour llevan el prefijo `mh-`; cualquier
 * otro identificador se rechaza (Pollinations es síncrono y no usa tareas).
 *
 * Respuestas:
 * - 200 {estado:'pendiente'|'procesando', mensaje}
 * - 200 {estado:'completado', videoUrl}
 * - 4xx/5xx honestos si el trabajo falló, se canceló o el taskId no es válido.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'GET')) return;
    res.setHeader('Cache-Control', 'no-store');

    const crudo = req.query.taskId;
    const taskId = Array.isArray(crudo) ? crudo[0] ?? '' : crudo ?? '';
    if (taskId === '') {
      throw new HttpError(400, 'BAD_REQUEST', 'Falta el identificador de la tarea.');
    }
    if (!taskId.startsWith(PREFIJO_TASK_MAGICHOUR)) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'Este endpoint solo consulta trabajos del proveedor gratuito (Magic Hour).',
      );
    }

    const resultado = await consultarEstadoMagicHour(taskId);

    if (resultado.estado === 'completado') {
      sendOk(res, {
        estado: 'completado',
        mensaje: 'Vídeo generado correctamente.',
        videoUrl: resultado.videoUrl,
        metadatos: { gratuito: true },
      });
      return;
    }

    sendOk(res, {
      estado: resultado.estado,
      mensaje: resultado.mensaje ?? 'El vídeo se está generando…',
    });
  } catch (err) {
    sendError(res, err);
  }
}
