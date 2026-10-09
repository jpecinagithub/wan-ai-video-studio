import { z } from 'zod';

/**
 * Validación estricta de todas las entradas de la API con Zod.
 *
 * Límites verificados contra la documentación oficial de Alibaba Cloud
 * Model Studio (2026-10-09): prompt máx. 20000 caracteres, duración entera
 * [2,30], resolución 480p|720p|1080p (se mapea a 480P|720P|1080P),
 * ratio oficial: 16:9|21:9|9:16|1:1|4:3|3:4|auto (auto → 'adaptive').
 */

/** Lista cerrada de modelos permitidos. Ningún otro modelo es aceptado. */
export const MODEL_IDS = ['wan3.0-video', 'wan3.0-video-prime'] as const;
export type ModelIdApi = (typeof MODEL_IDS)[number];

/**
 * Imagen de referencia (verificado en la documentación oficial 2026-10-09):
 * `type: "reference_image"` (máx. 10), URL pública https o data URI base64.
 * Esta app envía siempre data URI (sin hosting externo).
 */
const DATA_URI_IMAGEN = /^data:image\/(jpeg|jpg|png|webp|bmp);base64,[A-Za-z0-9+/]+={0,2}$/;
/** ~420 KB de base64 ≈ 300 KB de imagen comprimida en cliente, con margen. */
const MAX_DATA_URI_CHARS = 420_000;
/** Límite oficial de imágenes de referencia por petición. */
export const MAX_MEDIA_REFERENCIA = 10;

const MediaReferenciaSchema = z.object({
  type: z.literal('reference_image'),
  url: z
    .string({ required_error: 'La imagen de referencia no es válida.' })
    .max(MAX_DATA_URI_CHARS, 'La imagen de referencia es demasiado grande (máx. ~300 KB comprimida).')
    .regex(
      DATA_URI_IMAGEN,
      'La imagen debe ser un data URI válido (JPG, PNG, WEBP o BMP en base64).',
    ),
});

export type MediaReferenciaApi = z.infer<typeof MediaReferenciaSchema>;

export const GenerateVideoBodySchema = z.object({
  prompt: z
    .string({ required_error: 'El prompt es obligatorio.' })
    .trim()
    .min(1, 'El prompt no puede estar vacío.')
    .max(20000, 'El prompt supera los 20000 caracteres permitidos.'),
  modelId: z.enum(MODEL_IDS, { errorMap: () => ({ message: 'Modelo no válido.' }) }),
  duration: z
    .number({ invalid_type_error: 'La duración debe ser un número.' })
    .int('La duración debe ser un número entero de segundos.')
    .min(2, 'La duración mínima es de 2 segundos.')
    .max(30, 'La duración máxima es de 30 segundos.'),
  resolution: z.enum(['480p', '720p', '1080p'], {
    errorMap: () => ({ message: 'Resolución no válida.' }),
  }),
  aspectRatio: z.enum(['16:9', '21:9', '9:16', '1:1', '4:3', '3:4', 'auto'], {
    errorMap: () => ({ message: 'Relación de aspecto no válida.' }),
  }),
  audio: z.boolean().default(true),
  seed: z.number().int().min(0).max(2147483647).optional(),
  enhancePrompt: z.boolean().optional(),
  watermark: z.boolean().optional(),
  clientRequestId: z.string().uuid('El identificador de petición no es válido.').optional(),
  media: z
    .array(MediaReferenciaSchema)
    .max(MAX_MEDIA_REFERENCIA, 'El máximo es 10 imágenes de referencia.')
    .optional(),
});

export type GenerateVideoBody = z.infer<typeof GenerateVideoBodySchema>;

export const StatusQuerySchema = z.object({
  taskId: z
    .string({ required_error: 'Falta el identificador de la tarea.' })
    .trim()
    .min(1, 'El identificador de la tarea no puede estar vacío.')
    .max(256, 'El identificador de la tarea no es válido.'),
});

/** Detalles de validación listos para el cliente (sin datos sensibles). */
export function formatZodIssues(error: z.ZodError): Array<{ campo: string; mensaje: string }> {
  return error.issues.map((i) => ({
    campo: i.path.join('.') || '(raíz)',
    mensaje: i.message,
  }));
}
