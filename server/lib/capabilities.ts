import { HttpError } from './errors.js';
import type { ModelIdApi } from './validation.js';

/**
 * Registro centralizado del backend: modelos soportados y sus capacidades.
 * Precios en pollen por segundo de vídeo generado, verificados contra el
 * catálogo en vivo de Pollinations (GET /video/models, 2026-10-14).
 * $1 ≈ 1 pollen (FAQ oficial de Pollinations). Las peticiones fallidas
 * no se facturan. Todos los modelos de vídeo requieren Pollen de pago.
 */

export type VelocidadModelo = 'rápida' | 'muy rápida';
export type ResolucionApi = '480p' | '720p' | '1080p';
export type EstadoIntegracion = 'disponible';

export interface CapacidadModelo {
  id: ModelIdApi;
  nombre: string;
  descripcion: string;
  caracteristicas: string[];
  velocidad: VelocidadModelo;
  resoluciones: ResolucionApi[];
  resolucionDefecto: ResolucionApi;
  /** Duraciones permitidas en segundos (lista cerrada por modelo). */
  duraciones: number[];
  duracionDefecto: number;
  /**
   * Imágenes admitidas: 1 = solo fotograma inicial; 2 = inicial + final.
   * Se envían como image[0] (inicial) e image[1] (final).
   */
  maxImagenes: number;
  /** El modelo puede generar pista de audio (Veo la factura aparte). */
  generaAudio: boolean;
  /** Pollen por segundo de vídeo, por resolución. */
  precioVideoPorSegundo: Record<ResolucionApi, number>;
  /** Pollen por segundo de audio (0 si no aplica). */
  precioAudioPorSegundo: number;
  estadoIntegracion: EstadoIntegracion;
}

export const MODELOS: CapacidadModelo[] = [
  {
    id: 'bytedance/seedance-1-pro-fast',
    nombre: 'Seedance Pro Fast',
    descripcion:
      'Modelo rápido y económico de ByteDance: ideal para iterar ideas y probar conceptos sin gastar casi nada.',
    caracteristicas: [
      'Texto a vídeo e imagen a vídeo',
      'Hasta 10 segundos por clip',
      'El más barato del catálogo',
    ],
    velocidad: 'rápida',
    resoluciones: ['480p', '720p', '1080p'],
    resolucionDefecto: '720p',
    duraciones: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    duracionDefecto: 8,
    maxImagenes: 1,
    generaAudio: false,
    precioVideoPorSegundo: { '480p': 0.015, '720p': 0.025, '1080p': 0.06 },
    precioAudioPorSegundo: 0,
    estadoIntegracion: 'disponible',
  },
  {
    id: 'google/veo-3.1-fast',
    nombre: 'Veo 3.1 Fast',
    descripcion:
      'El modelo de vídeo de Google: máxima calidad cinematográfica con audio generado, fotograma inicial y final.',
    caracteristicas: [
      'Calidad cinematográfica con audio',
      'Fotograma inicial y final',
      'Movimiento de cámara natural',
    ],
    velocidad: 'muy rápida',
    resoluciones: ['720p', '1080p'],
    resolucionDefecto: '720p',
    duraciones: [4, 6, 8],
    duracionDefecto: 8,
    maxImagenes: 2,
    generaAudio: true,
    precioVideoPorSegundo: { '480p': 0.08, '720p': 0.08, '1080p': 0.1 },
    precioAudioPorSegundo: 0.02,
    estadoIntegracion: 'disponible',
  },
];

export const MONEDA_PRECIOS = 'pollen';

/** Devuelve la capacidad de un modelo por su id (o undefined si no existe). */
export function obtenerCapacidad(modelId: string): CapacidadModelo | undefined {
  return MODELOS.find((m) => m.id === modelId);
}

/**
 * Valida que la combinación de parámetros sea compatible con el modelo.
 * Lanza HttpError 400 con un mensaje en español si no lo es.
 */
export function validarCombinacion(
  modelId: ModelIdApi,
  duracion: number,
  resolucion: ResolucionApi,
  numImagenes: number,
): void {
  const modelo = obtenerCapacidad(modelId);
  if (!modelo) {
    throw new HttpError(400, 'BAD_REQUEST', 'Modelo no válido.');
  }
  if (!modelo.duraciones.includes(duracion)) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      `${modelo.nombre} solo admite duraciones de ${modelo.duraciones.join(', ')} segundos.`,
    );
  }
  if (!modelo.resoluciones.includes(resolucion)) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      `${modelo.nombre} solo admite resolución ${modelo.resoluciones.join(', ')}.`,
    );
  }
  if (numImagenes > modelo.maxImagenes) {
    throw new HttpError(
      400,
      'BAD_REQUEST',
      `${modelo.nombre} admite como máximo ${modelo.maxImagenes} ${modelo.maxImagenes === 1 ? 'imagen (fotograma inicial)' : 'imágenes (fotogramas inicial y final)'}.`,
    );
  }
}

/**
 * Estimación del coste de una generación, en pollen.
 * Solo para información; las peticiones fallidas no se facturan.
 */
export function estimarCostePollen(
  modelId: ModelIdApi,
  resolucion: ResolucionApi,
  duracionSegundos: number,
  audio: boolean,
): number {
  const modelo = obtenerCapacidad(modelId);
  if (!modelo) return 0;
  const video = modelo.precioVideoPorSegundo[resolucion] * duracionSegundos;
  const audioCoste =
    audio && modelo.generaAudio ? modelo.precioAudioPorSegundo * duracionSegundos : 0;
  return video + audioCoste;
}
