import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { AlibabaVideoProvider, readProviderEnv } from '../../server/lib/provider.js';
import type { InfoTareaProveedor } from '../../server/lib/provider.js';
import { marcarTerminal } from '../../server/lib/tareas.js';
import { StatusQuerySchema } from '../../server/lib/validation.js';

type EstadoNormalizado = 'pendiente' | 'procesando' | 'completado' | 'error' | 'cancelado';

const ESTADOS_TERMINALES: InfoTareaProveedor['estado'][] = ['succeeded', 'failed', 'cancelled', 'unknown'];

/**
 * GET /api/video/status/:taskId
 * (vercel.json reescribe /api/video/status/:taskId → /api/video/status?taskId=:taskId)
 *
 * Consulta el estado remoto en Alibaba Cloud Model Studio y devuelve un estado
 * normalizado más la URL y los metadatos cuando la tarea está completada.
 * Las tareas terminales liberan su hueco de simultaneidad en el registro.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'GET')) return;
    res.setHeader('Cache-Control', 'no-store');

    const rawTaskId = req.query.taskId;
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    const parsed = StatusQuerySchema.safeParse({ taskId });
    if (!parsed.success) {
      throw new HttpError(400, 'BAD_REQUEST', 'Falta un identificador de tarea válido.');
    }

    const env = readProviderEnv();
    const proveedor = new AlibabaVideoProvider(env);
    const tarea = await proveedor.obtenerTareaVideo(parsed.data.taskId);

    if (ESTADOS_TERMINALES.includes(tarea.estado)) {
      marcarTerminal(tarea.taskId);
    }

    sendOk(res, normalizarRespuesta(tarea));
  } catch (err) {
    sendError(res, err);
  }
}

function normalizarRespuesta(tarea: InfoTareaProveedor): Record<string, unknown> {
  const base: Record<string, unknown> = { taskId: tarea.taskId };

  const estado: EstadoNormalizado =
    tarea.estado === 'pending'
      ? 'pendiente'
      : tarea.estado === 'processing'
        ? 'procesando'
        : tarea.estado === 'succeeded'
          ? 'completado'
          : tarea.estado === 'cancelled'
            ? 'cancelado'
            : 'error';

  base.estado = estado;

  switch (estado) {
    case 'pendiente':
      base.mensaje = 'La tarea está en cola. Vuelve a consultar en unos segundos.';
      break;
    case 'procesando':
      base.mensaje = 'El vídeo se está generando. Vuelve a consultar en unos segundos.';
      break;
    case 'completado': {
      base.videoUrl = tarea.videoUrl;
      base.mensaje = 'Vídeo generado correctamente.';
      // Las URL del proveedor son temporales: válidas 24 horas.
      base.expiraEn = tarea.expiraEn ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (tarea.uso) base.metadatos = { uso: tarea.uso };
      break;
    }
    case 'cancelado':
      base.mensaje = 'La tarea fue cancelada.';
      break;
    case 'error':
      base.error =
        tarea.estado === 'unknown'
          ? 'La tarea no existe o ha expirado (las tareas caducan a las 24 horas).'
          : tarea.mensajeError || 'La generación del vídeo falló en el proveedor.';
      break;
  }

  return base;
}
