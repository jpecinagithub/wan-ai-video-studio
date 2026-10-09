import { MODELOS } from '../constants/models.js';
import type { ModelId } from '../types/index.js';

/**
 * Lógica del contador LOCAL de cuota gratuita.
 *
 * No existe un endpoint verificado en la API de Model Studio para consultar
 * la cuota restante, así que la app lleva su propia cuenta en localStorage:
 * empieza en el total del panel del usuario y se decrementa solo cuando una
 * generación se completa con éxito (las fallidas no consumen cuota, verificado
 * en la documentación oficial). El contador debe etiquetarse siempre como local.
 */

export const CLAVE_CUOTA = 'wanstudio.quota.v1';

export interface EstadoCuota {
  restantes: number;
}

export type MapaCuota = Record<ModelId, EstadoCuota>;

/** Total de generaciones gratuitas de un modelo (dato del panel del usuario). */
export function totalCuotaDe(modelId: ModelId): number {
  return MODELOS.find((m) => m.id === modelId)?.cuotaGratis.total ?? 0;
}

/** Último día de validez de la cuota ('YYYY-MM-DD'). */
export function expiraCuotaDe(modelId: ModelId): string {
  return MODELOS.find((m) => m.id === modelId)?.cuotaGratis.expira ?? '';
}

/** Estado inicial: cada modelo empieza con su total. */
export function estadoInicialCuota(): MapaCuota {
  const mapa = {} as MapaCuota;
  for (const m of MODELOS) {
    mapa[m.id] = { restantes: m.cuotaGratis.total };
  }
  return mapa;
}

/** Recorta un valor al rango [0, total] (los decimales se truncan). */
export function clampCuota(valor: number, total: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(total, Math.max(0, Math.floor(valor)));
}

/**
 * Normaliza un mapa leído de localStorage: rellena modelos ausentes y
 * recorta valores corruptos o fuera de rango. Nunca lanza.
 */
export function normalizarMapaCuota(mapa: unknown): MapaCuota {
  const inicial = estadoInicialCuota();
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return inicial;
  const crudo = mapa as Partial<Record<string, { restantes?: unknown }>>;
  for (const m of MODELOS) {
    const r = crudo[m.id]?.restantes;
    inicial[m.id] = {
      restantes:
        typeof r === 'number' ? clampCuota(r, m.cuotaGratis.total) : m.cuotaGratis.total,
    };
  }
  return inicial;
}

/**
 * Decrementa en 1 el restante de un modelo (una generación completada).
 * Nunca baja de 0. Los fallos no llaman a esta función.
 */
export function aplicarExito(prev: MapaCuota, modelId: ModelId): MapaCuota {
  const total = totalCuotaDe(modelId);
  const actual = prev[modelId]?.restantes ?? total;
  return { ...prev, [modelId]: { restantes: clampCuota(actual - 1, total) } };
}

/** Ajuste manual del contador (p. ej. si se generan vídeos fuera de la app). */
export function aplicarAjuste(prev: MapaCuota, modelId: ModelId, valor: number): MapaCuota {
  const total = totalCuotaDe(modelId);
  return { ...prev, [modelId]: { restantes: clampCuota(valor, total) } };
}

/**
 * Indica si la cuota gratuita ya caducó. `expira` es el ÚLTIMO día válido
 * (inclusive): caduca a partir del día siguiente. `hoy` es inyectable para tests.
 * Un formato desconocido nunca se considera caducado (no afirmar sin datos).
 */
export function cuotaCaducada(expiraISO: string, hoy: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiraISO.trim());
  if (!m) return false;
  const fin = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  if (Number.isNaN(fin.getTime())) return false;
  return hoy.getTime() > fin.getTime();
}

/** Formatea 'YYYY-MM-DD' en español corto: "4 nov 2026". */
export function formatearFechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fecha);
}
