import type { ModelCapability } from '../types';

/**
 * Tarjetas de modelo mostradas al usuario.
 * Identificadores verificados en la cuenta de Model Studio del usuario
 * (ambos habilitados, con cuota gratuita). Tarifas oficiales por segundo
 * (USD), región Singapur / scope internacional, verificadas 2026-10-09.
 * wan3.0-video-prime = versión de alta velocidad (misma API y parámetros).
 */
export const MODELOS: ModelCapability[] = [
  {
    id: 'wan3.0-video',
    nombre: 'WAN 3.0 Video',
    descripcion:
      'Generación de vídeo equilibrada: buena calidad con un ritmo de proceso ágil para iterar ideas rápidamente.',
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
  },
  {
    id: 'wan3.0-video-prime',
    nombre: 'WAN 3.0 Video Prime',
    descripcion:
      'Versión de alta velocidad de WAN 3.0: proceso de extremo a extremo notablemente más rápido, con las mismas capacidades.',
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
  },
];

export const MODELO_POR_DEFECTO = 'wan3.0-video' as const;

/** Texto de precio orientativo para las tarjetas de modelo. */
export function textoPrecioModelo(modelo: ModelCapability): string {
  const p = modelo.precioPorSegundo;
  return `Desde $${p['480p'].toFixed(3)}/s (480p) · $${p['720p'].toFixed(2)}/s (720p) · $${p['1080p'].toFixed(2)}/s (1080p)`;
}
