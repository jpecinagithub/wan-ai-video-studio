import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  estimarCostePollen,
  obtenerCapacidad,
  validarCombinacion,
} from '../../server/lib/capabilities.js';
import { HttpError, readJsonBody, requireMethod, sendError, sendOk } from '../../server/lib/errors.js';
import { PollinationsVideoProvider, readProviderEnv } from '../../server/lib/provider.js';
import { GenerateVideoBodySchema, formatZodIssues } from '../../server/lib/validation.js';

/**
 * Límite del cuerpo: solo JSON con parámetros (las imágenes viajan como
 * URLs públicas ya alojadas). Muy por debajo del límite de Vercel.
 */
const MAX_BODY_BYTES = 256 * 1024;

/** Los enlaces del almacenamiento de medios del proveedor duran 30 días. */
const DIAS_VIGENCIA_URL = 30;

/**
 * POST /api/video/generate
 *
 * La generación en Pollinations es SÍNCRONA: este endpoint intenta la
 * petición completa (generar + publicar el MP4). Si el proveedor tarda más
 * que el timeout propio, responde 202 {estado:'procesando'} y el cliente
 * reintente la petición IDÉNTICA (mismos parámetros y seed): el proveedor
 * retoma la generación en curso o devuelve el resultado cacheado SIN
 * volver a facturar. Solo la generación se factura; reintentos y cache no.
 *
 * No hay límite de simultaneidad propio: el proveedor aplica el suyo (429).
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
