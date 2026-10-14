import type { ModelCapability } from '../types';

/**
 * Tarjetas de modelo mostradas al usuario.
 * Capacidades y precios (pollen/segundo) verificados contra el catálogo
 * en vivo de Pollinations (GET /video/models, 2026-10-14).
 * $1 ≈ 1 pollen (FAQ oficial de Pollinations). Las peticiones fallidas
 * no se facturan. Los modelos de vídeo requieren Pollen de pago.
 */
export const MODELOS: ModelCapability[] = [
  {
    id: 'bytedance/seedance-1-pro-fast',
    nombre: 'Seedance Pro Fast',
    descripcion:
      'Modelo rápido y económico de ByteDance: ideal para iterar ideas y probar conceptos gastando muy poco.',
    caracteristicas: [
      'Texto a vídeo e imagen a vídeo',
      'Clips de 2 a 10 segundos',
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
      'El modelo de vídeo de Google: máxima calidad cinematográfica, con audio generado y fotogramas inicial y final.',
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

export const MODELO_POR_DEFECTO = 'bytedance/seedance-1-pro-fast' as const;

/** Devuelve la capacidad de un modelo por su id. */
export function obtenerModelo(id: string): ModelCapability | undefined {
  return MODELOS.find((m) => m.id === id);
}

/** Texto de precio orientativo para las tarjetas de modelo (pollen). */
export function textoPrecioModelo(modelo: ModelCapability): string {
  const ejemplos = modelo.resoluciones
    .map((r) => {
      const coste = modelo.duracionDefecto * modelo.precioVideoPorSegundo[r];
      return `${coste.toFixed(2)} pollen (${r})`;
    })
    .join(' · ');
  return `≈ ${ejemplos} por ${modelo.duracionDefecto}s`;
}
