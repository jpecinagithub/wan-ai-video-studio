import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, readJsonBody, requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { AlibabaVideoProvider, readProviderEnv } from '../../server/lib/provider.js';
import {
  guardarRespuestaIdempotente,
  hayHuecoSimultaneidad,
  MAX_SIMULTANEAS,
  obtenerRespuestaIdempotente,
  registrarActiva,
  type RespuestaCreacion,
} from '../../server/lib/tareas.js';
import { GenerateVideoBodySchema, formatZodIssues } from '../../server/lib/validation.js';

const MAX_BODY_BYTES = 64 * 1024; // 64 KB: suficiente para el prompt más largo.
const MAX_CLAVE_IDEMPOTENCIA = 256;

/**
 * POST /api/video/generate
 * Valida la petición, aplica idempotencia y el límite de simultaneidad,
 * y crea la tarea en Alibaba Cloud Model Studio (modo real, sin demo).
 * Devuelve el identificador de tarea y el estado inicial (nunca espera al vídeo).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'POST')) return;

    const cuerpo = readJsonBody(req, MAX_BODY_BYTES);
    const parsed = GenerateVideoBodySchema.safeParse(cuerpo);
    if (!parsed.success) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'Los datos enviados no son válidos.',
        formatZodIssues(parsed.error),
      );
    }
    const datos = parsed.data;

    // Clave de idempotencia: del body o de la cabecera X-Idempotency-Key.
    const cabecera = req.headers['x-idempotency-key'];
    const claveCabecera = (Array.isArray(cabecera) ? cabecera[0] : cabecera)?.trim();
    const claveIdempotencia =
      datos.clientRequestId ??
      (claveCabecera && claveCabecera.length <= MAX_CLAVE_IDEMPOTENCIA ? claveCabecera : undefined);

    if (claveIdempotencia) {
      const repetida = obtenerRespuestaIdempotente(claveIdempotencia);
      if (repetida) {
        sendOk(res, repetida, 200);
        return;
      }
    }

    if (!hayHuecoSimultaneidad()) {
      throw new HttpError(
        429,
        'RATE_LIMITED',
        `Has alcanzado el límite de ${MAX_SIMULTANEAS} generaciones simultáneas. Espera a que termine alguna antes de crear otra.`,
      );
    }

    const env = readProviderEnv();
    const proveedor = new AlibabaVideoProvider(env);

    const tarea = await proveedor.crearTareaVideo({
      modelId: datos.modelId,
      prompt: datos.prompt,
      duracionSegundos: datos.duration,
      resolucion: datos.resolution,
      aspecto: datos.aspectRatio,
      audio: datos.audio,
      semilla: datos.seed,
      mejoraPrompt: datos.enhancePrompt,
      marcaAgua: datos.watermark,
      idPeticionCliente: datos.clientRequestId,
    });

    const respuesta: RespuestaCreacion = {
      taskId: tarea.taskId,
      estado: 'pendiente',
      mensaje: 'Tarea creada. Consulta el estado periódicamente.',
    };

    registrarActiva(tarea.taskId);
    if (claveIdempotencia) guardarRespuestaIdempotente(claveIdempotencia, respuesta);

    sendOk(res, respuesta, 201);
  } catch (err) {
    sendError(res, err);
  }
}
