import { z } from 'zod';

/**
 * Validación estricta de todas las entradas de la API con Zod.
 *
 * Límites verificados contra el catálogo en vivo de Pollinations
 * (GET /video/models, 2026-10-14):
 * - Modelos: 'bytedance/seedance-1-pro-fast' (2-10 s, 480p/720p/1080p,
 *   1 imagen = fotograma inicial) y 'google/veo-3.1-fast' (4/6/8 s,
 *   720p/1080p, 2 imágenes = inicial + final, audio opcional con coste).
 * - El prompt viaja en la ruta de una petición GET al proveedor: límite
 *   práctico de 2000 caracteres para no romper la URL.
 * - Relaciones de aspecto soportadas por estos modelos de vídeo: 16:9 y 9:16.
 */

/** Lista cerrada de modelos permitidos. Ningún otro modelo es aceptado. */
export const MODEL_IDS = [
  'bytedance/seedance-1-pro-fast',
  'google/veo-3.1-fast',
] as const;
export type ModelIdApi = (typeof MODEL_IDS)[number];

/**
 * Imagen de referencia como data URI (se sube al almacenamiento de medios
 * del proveedor ANTES de generar, para obtener una URL pública).
 */
const DATA_URI_IMAGEN = /^data:image\/(jpeg|jpg|png|webp|bmp);base64,[A-Za-z0-9+/]+={0,2}$/;
/** ~420 KB de base64 ≈ 300 KB de imagen comprimida en cliente, con margen. */
const MAX_DATA_URI_CHARS = 420_000;

export const MediaUploadBodySchema = z.object({
  dataUrl: z
    .string({ required_error: 'Falta la imagen.' })
    .max(MAX_DATA_URI_CHARS, 'La imagen es demasiado grande (máx. ~300 KB comprimida).')
    .regex(
      DATA_URI_IMAGEN,
      'La imagen debe ser un data URI válido (JPG, PNG, WEBP o BMP en base64).',
    ),
});

export type MediaUploadBody = z.infer<typeof MediaUploadBodySchema>;

/** URL pública https de una imagen ya alojada (fotograma inicial/final). */
const URL_PUBLICA = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
/** Máximo de imágenes por petición (el mayor de los modelos: Veo admite 2). */
export const MAX_IMAGENES = 2;

export const GenerateVideoBodySchema = z.object({
  prompt: z
    .string({ required_error: 'El prompt es obligatorio.' })
    .trim()
    .min(1, 'El prompt no puede estar vacío.')
    .max(2000, 'El prompt supera los 2000 caracteres permitidos.'),
  modelId: z.enum(MODEL_IDS, { errorMap: () => ({ message: 'Modelo no válido.' }) }),
  duration: z
    .number({ invalid_type_error: 'La duración debe ser un número.' })
    .int('La duración debe ser un número entero de segundos.')
    .min(2, 'La duración mínima es de 2 segundos.')
    .max(10, 'La duración máxima es de 10 segundos.'),
  resolution: z.enum(['480p', '720p', '1080p'], {
    errorMap: () => ({ message: 'Resolución no válida.' }),
  }),
  aspectRatio: z.enum(['16:9', '9:16'], {
    errorMap: () => ({ message: 'Relación de aspecto no válida.' }),
  }),
  audio: z.boolean().default(true),
  seed: z.number().int().min(0).max(2147483647).optional(),
  imageUrls: z
    .array(z.string().regex(URL_PUBLICA, 'La URL de imagen no es válida.'))
    .max(MAX_IMAGENES, 'El máximo es 2 imágenes (fotograma inicial y final).')
    .optional(),
});

export type GenerateVideoBody = z.infer<typeof GenerateVideoBodySchema>;

/** Detalles de validación listos para el cliente (sin datos sensibles). */
export function formatZodIssues(error: z.ZodError): Array<{ campo: string; mensaje: string }> {
  return error.issues.map((i) => ({
    campo: i.path.join('.') || '(raíz)',
    mensaje: i.message,
  }));
}
