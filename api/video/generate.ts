import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  estimarCostePollen,
  obtenerCapacidad,
  validarCombinacion,
} from '../../server/lib/capabilities.js';
import { HttpError, readJsonBody, requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { crearVideoMagicHour } from '../../server/lib/magichour.js';import { PollinationsVideoProvider, readProviderEnv } from '../../server/lib/provider.js';
import {
  GenerateVideoBodySchema,
  esModeloMagicHourApi,
  formatZodIssues,
} from '../../server/lib/validation.js';

/**
 * Límite del cuerpo: solo JSON con parámetros (las imágenes viajan como
 * URLs públicas ya alojadas). Muy por debajo del límite de Vercel.
 */
const MAX_BODY_BYTES = 256 * 1024;

/** Los enlaces del almacenamiento de medios de Pollinations duran 30 días. */
const DIAS_VIGENCIA_URL = 30;

/**
 * POST /api/video/generate
 *
 * Dos proveedores, dos flujos:
 *
 * - **Pollinations** (pollen de pago): generación SÍNCRONA. Este endpoint
 *   intenta la petición completa (generar + publicar el MP4). Si el proveedor
 *   tarda más que el timeout propio, responde 202 {estado:'procesando'} y el
 *   cliente reintente la petición IDÉNTICA (mismos parámetros y seed): el
 *   proveedor retoma la generación en curso o devuelve el resultado cacheado
 *   SIN volver a facturar.
 * - **Magic Hour** (gratuito): generación ASÍNCRONA. Este endpoint crea el
 *   trabajo y responde 201 {estado:'pendiente', taskId}; el cliente consulta
 *   GET /api/video/status/:taskId hasta que el estado sea 'completado'.
 *   Si la generación falla, Magic Hour devuelve los créditos.
 *
 * No hay límite de simultaneidad propio: cada proveedor aplica el suyo (429).
 * Modo real, sin demo (decisión expresa del usuario).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (!requireMethod(req, res, 'POST')) return;
    res.setHeader('Cache-Control', 'no-store');

    const cuerpo = readJsonBody(
      req,
      MAX_BODY_BYTES,
      'La solicitud es demasiado grande. Las imágenes deben subirse primero con /api/video/media.',
    );
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

    validarCombinacion(datos.modelId, datos.duration, datos.resolution, datos.imageUrls?.length ?? 0);

    // ── Rama Magic Hour (gratuita, asíncrona) ──────────────────────────
    if (esModeloMagicHourApi(datos.modelId)) {
      if ((datos.imageUrls?.length ?? 0) > 0) {
        throw new HttpError(
          400,
          'BAD_REQUEST',
          'El modelo gratuito (LTX 2.5) es solo texto a vídeo: no admite imágenes de referencia.',
        );
      }
      const creacion = await crearVideoMagicHour({
        prompt: datos.prompt,
        duracion: datos.duration,
        resolucion: datos.resolution,
        aspecto: datos.aspectRatio,
        audio: datos.audio,
      });
      sendOk(
        res,
        {
          estado: 'pendiente',
          taskId: creacion.taskId,
          mensaje: 'Trabajo creado en Magic Hour. Consultando el estado…',
          creditosEstimados: creacion.creditosEstimados,
          metadatos: {
            modelo: datos.modelId,
            nombreModelo: obtenerCapacidad(datos.modelId)?.nombre,
            duracion: datos.duration,
            resolucion: datos.resolution,
            aspecto: datos.aspectRatio,
            gratuito: true,
          },
        },
        201,
      );
      return;
    }

    // ── Rama Pollinations (pollen de pago, síncrona) ──────────────────
    if (datos.prompt.length > 2000) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        'El prompt supera los 2000 caracteres que permite Pollinations (el prompt viaja en la URL).',
      );
    }

    const env = readProviderEnv();
    const proveedor = new PollinationsVideoProvider(env);

    const resultado = await proveedor.generarVideo({
      modelId: datos.modelId,
      prompt: datos.prompt,
      duracionSegundos: datos.duration,
      resolucion: datos.resolution,
      aspecto: datos.aspectRatio,
      audio: datos.audio,
      semilla: datos.seed,
      imagenes: datos.imageUrls,
    });

    if (resultado.estado === 'procesando') {
      sendOk(
        res,
        {
          estado: 'procesando',
          mensaje:
            'El vídeo se está generando en Pollinations. Reintentando automáticamente sin coste adicional…',
        },
        202,
      );
      return;
    }

    // Publicar el MP4 en el almacenamiento del proveedor: URL pública
    // estable (30 días) para reproducir, descargar e historiar.
    const nombre = `video-${Date.now()}.mp4`;
    const videoUrl = await proveedor.subirMedio(resultado.datos, resultado.contentType, nombre);

    const modelo = obtenerCapacidad(datos.modelId);
    const costePollen = estimarCostePollen(
      datos.modelId,
      datos.resolution,
      datos.duration,
      datos.audio,
    );

    sendOk(res, {
      estado: 'completado',
      mensaje: 'Vídeo generado correctamente.',
      videoUrl,
      expiraEn: new Date(Date.now() + DIAS_VIGENCIA_URL * 24 * 60 * 60 * 1000).toISOString(),
      costePollen,
      metadatos: {
        modelo: datos.modelId,
        nombreModelo: modelo?.nombre,
        duracion: datos.duration,
        resolucion: datos.resolution,
        aspecto: datos.aspectRatio,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
