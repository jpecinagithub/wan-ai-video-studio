import type { AspectRatio, ModelId, Resolution } from '../types';
import { MODELOS } from './models';

/**
 * Registro centralizado de capacidades.
 * Toda la interfaz construye sus controles a partir de aquí, de modo que
 * una combinación incompatible se deshabilita con su motivo explicado.
 *
 * Límites verificados contra la documentación oficial de Alibaba Cloud
 * Model Studio (2026-10-09). Ambos modelos comparten API y límites:
 * duración entera [2,30] (defecto 5), resolución 480P/720P/1080P
 * (defecto 1080P), ratio adaptive|21:9|16:9|4:3|1:1|3:4|9:16
 * (defecto adaptive), audio booleano (defecto true, no afecta al precio),
 * seed -1|[0,2147483647], prompt_extend (defecto true), watermark (defecto false).
 */

export interface OpcionResolucion {
  id: Resolution;
  nombre: string;
  descripcion: string;
  impacto: string;
}

export interface OpcionAspecto {
  id: AspectRatio;
  nombre: string;
  descripcion: string;
  /** Proporción CSS para dibujar el icono de pantalla. */
  ratioCss: string;
}

export const CAPACIDADES = {
  duracion: {
    min: 2,
    max: 30,
    defecto: 5,
    paso: 1,
    unidad: 's',
  },
  prompt: {
    maxCaracteres: 20000,
  },
  resoluciones: [
    {
      id: '480p',
      nombre: '480p',
      descripcion: 'Vista previa ligera, ideal para probar ideas.',
      impacto: 'Menor tiempo de generación y menor coste estimado.',
    },
    {
      id: '720p',
      nombre: '720p',
      descripcion: 'Equilibrio entre calidad y velocidad.',
      impacto: 'Buena calidad para redes sociales y previsualización.',
    },
    {
      id: '1080p',
      nombre: '1080p',
      descripcion: 'Alta definición para el resultado final.',
      impacto: 'Mayor tiempo de generación y mayor coste estimado.',
    },
  ] as OpcionResolucion[],
  aspectos: [
    { id: '16:9', nombre: 'Horizontal', descripcion: 'Pantallas y YouTube', ratioCss: '16 / 9' },
    { id: '21:9', nombre: 'Panorámico', descripcion: 'Formato cine', ratioCss: '21 / 9' },
    { id: '9:16', nombre: 'Vertical', descripcion: 'Móvil, Reels y TikTok', ratioCss: '9 / 16' },
    { id: '1:1', nombre: 'Cuadrado', descripcion: 'Publicaciones sociales', ratioCss: '1 / 1' },
    { id: '4:3', nombre: 'Clásico', descripcion: 'Formato tradicional', ratioCss: '4 / 3' },
    { id: '3:4', nombre: 'Retrato', descripcion: 'Retrato vertical', ratioCss: '3 / 4' },
    { id: 'auto', nombre: 'Automático', descripcion: 'Lo decide el modelo', ratioCss: '16 / 9' },
  ] as OpcionAspecto[],
  audio: {
    soportado: true,
    descripcion: 'Generar el vídeo con pista de audio. No afecta al precio.',
  },
  avanzadas: {
    semilla: {
      soportado: true,
      descripcion: 'Fija la semilla para repetir resultados similares. Vacío = aleatoria.',
    },
    mejoraPrompt: {
      soportado: true,
      descripcion: 'El modelo amplía automáticamente tu descripción (activado por defecto).',
    },
    marcaAgua: {
      soportado: true,
      descripcion: 'Añade una marca de agua al vídeo generado.',
    },
  },
  /** Límite local de generaciones simultáneas (también se aplica en el servidor). */
  generacionesSimultaneas: 2,
} as const;

export interface ParametrosGeneracion {
  modelId: ModelId;
  duration: number;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  audio: boolean;
}

/** Comprueba si una combinación de parámetros es válida. */
export function esCombinacionValida(p: ParametrosGeneracion): boolean {
  return motivoIncompatibilidad(p) === null;
}

/**
 * Devuelve el motivo por el que una combinación no es válida,
 * o null si es válida. La interfaz muestra este texto al usuario.
 *
 * La documentación oficial no establece límites de duración por resolución:
 * el rango [2,30] vale para 480p, 720p y 1080p en ambos modelos.
 */
export function motivoIncompatibilidad(p: ParametrosGeneracion): string | null {
  if (p.duration < CAPACIDADES.duracion.min || p.duration > CAPACIDADES.duracion.max) {
    return `La duración debe estar entre ${CAPACIDADES.duracion.min} y ${CAPACIDADES.duracion.max} segundos.`;
  }
  return null;
}

export interface EstimacionCoste {
  disponible: true;
  /** Coste estimado en USD. */
  usd: number;
  /** Texto listo para mostrar, etiquetado como estimación. */
  texto: string;
}

/**
 * Estimación de coste: duración × tarifa oficial por segundo (modelo, resolución).
 * Tarifas oficiales (USD/s, Singapur, scope internacional):
 * - wan3.0-video: 480p $0.05 · 720p $0.10 · 1080p $0.20
 * - wan3.0-video-prime: 480p $0.068 · 720p $0.14 · 1080p $0.28
 * Se usa la tarifa de lista (conservadora); existe un 30% de descuento
 * promocional sin fecha de fin publicada. El audio no afecta al precio
 * y las peticiones fallidas no se facturan.
 */
export function estimarCoste(p: ParametrosGeneracion): EstimacionCoste {
  const modelo = MODELOS.find((m) => m.id === p.modelId);
  if (!modelo) {
    throw new Error(`Modelo desconocido: ${p.modelId}`);
  }
  const usd = p.duration * modelo.precioPorSegundo[p.resolution];
  return {
    disponible: true,
    usd,
    texto: `≈ $${usd.toFixed(2)} USD (estimación, tarifa oficial de Singapur)`,
  };
}

/** Indica si la URL del proveedor sigue vigente (caducan a las 24h). */
export function urlVigente(expiraEn?: string): boolean {
  if (!expiraEn) return false;
  return new Date(expiraEn).getTime() > Date.now();
}
