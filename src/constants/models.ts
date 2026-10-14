import type { ModelCapability } from '../types';

/**
 * Tarjetas de modelo mostradas al usuario.
 *
 * Capacidades y precios verificados:
 * - Pollinations: catálogo en vivo (GET /video/models, 2026-10-14).
 *   $1 ≈ 1 pollen (FAQ oficial). Las peticiones fallidas no se facturan.
 *   Los modelos de vídeo requieren Pollen de pago.
 * - Magic Hour: docs.magichour.ai (2026-10-14). Plan gratuito con créditos
 *   al registrarse (sin tarjeta); el modelo `ltx-2.5` es el `default` del
 *   plan gratuito. Si la generación falla, los créditos se devuelven.
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
    tipoCoste: 'pago',
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
    tipoCoste: 'pago',
    precioVideoPorSegundo: { '480p': 0.08, '720p': 0.08, '1080p': 0.1 },
    precioAudioPorSegundo: 0.02,
    estadoIntegracion: 'disponible',
  },
  {
    id: 'magichour/ltx-2.5',
    nombre: 'LTX 2.5',
    descripcion:
      'Modelo gratuito de Magic Hour (LTX Video): el más rápido para iterar, clips de hasta 60 segundos con audio incluido.',
    caracteristicas: [
      'Gratis: créditos al registrarse, sin tarjeta',
      'Clips de 4 a 30 segundos',
      'Audio incluido sin coste extra',
    ],
    velocidad: 'muy rápida',
    resoluciones: ['480p', '720p', '1080p'],
    resolucionDefecto: '480p',
    duraciones: [4, 6, 8, 10, 15, 20, 30],
    duracionDefecto: 8,
    maxImagenes: 0,
    generaAudio: true,
    tipoCoste: 'gratis',
    precioVideoPorSegundo: { '480p': 0, '720p': 0, '1080p': 0 },
    precioAudioPorSegundo: 0,
    estadoIntegracion: 'disponible',
  },
];

export const MODELO_POR_DEFECTO = 'magichour/ltx-2.5' as const;

/** Devuelve la capacidad de un modelo por su id. */
export function obtenerModelo(id: string): ModelCapability | undefined {
  return MODELOS.find((m) => m.id === id);
}

/** Texto de precio orientativo para las tarjetas de modelo. */
export function textoPrecioModelo(modelo: ModelCapability): string {
  if (modelo.tipoCoste === 'gratis') {
    return 'Gratis (créditos gratuitos)';
  }
  const ejemplos = modelo.resoluciones
    .map((r) => {
      const coste = modelo.duracionDefecto * modelo.precioVideoPorSegundo[r];
      return `${coste.toFixed(2)} pollen (${r})`;
    })
    .join(' · ');
  return `≈ ${ejemplos} por ${modelo.duracionDefecto}s`;
}
