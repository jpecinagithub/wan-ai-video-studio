import type { AspectRatio, ModelId, Resolution } from '../types';
import { MODELOS, obtenerModelo } from './models';

/**
 * Registro centralizado de capacidades.
 * Toda la interfaz construye sus controles a partir de aquí, de modo que
 * una combinación incompatible se deshabilita con su motivo explicado.
 *
 * Límites verificados:
 * - Pollinations (GET /video/models y OpenAPI de /video/{prompt}, 2026-10-14):
 *   Seedance Pro Fast: duración entera 2-10 s, 480p/720p/1080p,
 *   1 imagen (fotograma inicial), sin pista de audio.
 *   Veo 3.1 Fast: duración 4/6/8 s, 720p/1080p, 2 imágenes
 *   (fotogramas inicial y final), audio opcional (+0,02 pollen/s).
 * - Magic Hour (docs.magichour.ai, 2026-10-14): LTX 2.5 (default del plan
 *   gratuito): 1-60 s enteros, 480p/720p/1080p (en gratis por defecto 480p),
 *   audio sin coste extra, solo texto a vídeo (sin imágenes).
 * - Relaciones de aspecto soportadas por estos modelos: 16:9 y 9:16.
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
  prompt: {
    /**
     * El prompt viaja en la ruta de una petición GET en Pollinations
     * (límite práctico 2000); en Magic Hour va en JSON (límite 5000).
     */
    maxCaracteres: 5000,
    maxCaracteresPollinations: 2000,
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
    { id: '9:16', nombre: 'Vertical', descripcion: 'Móvil, Reels y TikTok', ratioCss: '9 / 16' },
  ] as OpcionAspecto[],
  audio: {
    descripcion:
      'Generar el vídeo con pista de audio. Veo 3.1 suma 0,02 pollen/s; en Seedance no tiene efecto; en LTX 2.5 (gratis) no añade coste.',
  },
  avanzadas: {
    semilla: {
      soportado: true,
      descripcion:
        'Fija la semilla para repetir resultados. Vacío = aleatoria (se genera una por intento y se reutiliza en los reintentos).',
    },
  },
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

/** Devuelve el motivo por el que una combinación no es válida, o null si es válida. */
export function motivoIncompatibilidad(p: ParametrosGeneracion): string | null {
  const modelo = obtenerModelo(p.modelId);
  if (!modelo) return 'Modelo no válido.';
  if (!modelo.duraciones.includes(p.duration)) {
    return `${modelo.nombre} solo admite duraciones de ${modelo.duraciones.join(', ')} segundos.`;
  }
  if (!modelo.resoluciones.includes(p.resolution)) {
    return `${modelo.nombre} solo admite resolución ${modelo.resoluciones.join(', ')}.`;
  }
  return null;
}

export interface EstimacionCoste {
  disponible: true;
  /** Coste estimado en pollen (0 para el modelo gratuito). */
  pollen: number;
  /** true si el modelo usa los créditos gratuitos de Magic Hour. */
  gratis: boolean;
  /** Texto listo para mostrar, etiquetado como estimación. */
  texto: string;
}

/**
 * Estimación de coste: duración × tarifa por segundo (vídeo + audio si
 * aplica). Para el modelo gratuito devuelve coste 0 y el texto «Gratis».
 * $1 ≈ 1 pollen (FAQ oficial de Pollinations). Las peticiones fallidas
 * no se facturan; en Magic Hour los créditos se devuelven.
 */
export function estimarCoste(p: ParametrosGeneracion): EstimacionCoste {
  const modelo = obtenerModelo(p.modelId);
  if (!modelo) {
    throw new Error(`Modelo desconocido: ${p.modelId}`);
  }
  if (modelo.tipoCoste === 'gratis') {
    return {
      disponible: true,
      pollen: 0,
      gratis: true,
      texto: 'Gratis (créditos gratuitos de Magic Hour)',
    };
  }
  const video = p.duration * modelo.precioVideoPorSegundo[p.resolution];
  const audio = p.audio && modelo.generaAudio ? p.duration * modelo.precioAudioPorSegundo : 0;
  const pollen = video + audio;
  return {
    disponible: true,
    pollen,
    gratis: false,
    texto: `≈ ${pollen.toFixed(2)} pollen (≈ $${pollen.toFixed(2)} USD)`,
  };
}

/** Duraciones permitidas de un modelo (para construir el control de duración). */
export function duracionesDe(modelId: ModelId): number[] {
  return obtenerModelo(modelId)?.duraciones ?? [];
}

/** Resoluciones permitidas de un modelo. */
export function resolucionesDe(modelId: ModelId): Resolution[] {
  return obtenerModelo(modelId)?.resoluciones ?? [];
}

/** Máximo de imágenes de referencia de un modelo (1 o 2). */
export function maxImagenesDe(modelId: ModelId): number {
  return obtenerModelo(modelId)?.maxImagenes ?? 1;
}

/** Indica si la URL del almacenamiento del proveedor sigue vigente (30 días). */
export function urlVigente(expiraEn?: string): boolean {
  if (!expiraEn) return false;
  return new Date(expiraEn).getTime() > Date.now();
}

export { MODELOS };
