import type { ModelIdApi } from './validation.js';

/**
 * Registro centralizado del backend: modelos soportados y sus capacidades.
 * Precios oficiales de Alibaba Cloud Model Studio (USD por segundo de vídeo,
 * región Singapur, verificados 2026-10-09). Las peticiones fallidas no se facturan.
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
  duracionMin: number;
  duracionMax: number;
  /** USD por segundo de vídeo generado, por resolución. */
  precioPorSegundo: Record<ResolucionApi, number>;
  estadoIntegracion: EstadoIntegracion;
  /**
   * Cuota gratuita del panel de Model Studio del usuario (dato de su cuenta,
   * 2026-10-09). No es sensible: se expone en GET /api/video/models.
   */
  cuotaGratis: { total: number; expira: string };
}

export const MODELOS: CapacidadModelo[] = [
  {
    id: 'wan3.0-video',
    nombre: 'WAN 3.0 Video',
    descripcion:
      'Modelo de generación de vídeo equilibrado: buena calidad con tiempos de proceso ágiles para iterar rápido.',
    caracteristicas: [
      'Texto a vídeo de alta calidad',
      'Movimiento de cámara natural',
      'Ideal para iterar ideas rápidamente',
    ],
    velocidad: 'rápida',
    resoluciones: ['480p', '720p', '1080p'],
    duracionMin: 2,
    duracionMax: 30,
    precioPorSegundo: { '480p': 0.05, '720p': 0.1, '1080p': 0.2 },
    estadoIntegracion: 'disponible',
    cuotaGratis: { total: 30, expira: '2026-11-04' },
  },
  {
    id: 'wan3.0-video-prime',
    nombre: 'WAN 3.0 Video Prime',
    descripcion:
      'Versión de alta velocidad de WAN 3.0: proceso de extremo a extremo notablemente más rápido, con las mismas capacidades y parámetros.',
    caracteristicas: [
      'Velocidad de generación muy superior',
      'Mismas resoluciones y parámetros',
      'Ideal cuando el tiempo apremia',
    ],
    velocidad: 'muy rápida',
    resoluciones: ['480p', '720p', '1080p'],
    duracionMin: 2,
    duracionMax: 30,
    precioPorSegundo: { '480p': 0.068, '720p': 0.14, '1080p': 0.28 },
    estadoIntegracion: 'disponible',
    cuotaGratis: { total: 30, expira: '2026-11-20' },
  },
];

export const MONEDA_PRECIOS = 'USD';

/** Devuelve la capacidad de un modelo por su id (o undefined si no existe). */
export function obtenerCapacidad(modelId: string): CapacidadModelo | undefined {
  return MODELOS.find((m) => m.id === modelId);
}

/** Estimación del coste de una generación (USD). Solo para información; fallos no se facturan. */
export function estimarCoste(
  modelId: ModelIdApi,
  resolucion: ResolucionApi,
  duracionSegundos: number,
): number {
  const modelo = obtenerCapacidad(modelId);
  if (!modelo) return 0;
  return modelo.precioPorSegundo[resolucion] * duracionSegundos;
}
