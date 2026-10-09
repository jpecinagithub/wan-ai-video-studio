import { useCallback, useMemo } from 'react';
import type { ModelId } from '../types/index.js';
import { useLocalStorage } from './useLocalStorage.js';
import {
  CLAVE_CUOTA,
  aplicarAjuste,
  aplicarExito,
  cuotaCaducada,
  estadoInicialCuota,
  expiraCuotaDe,
  normalizarMapaCuota,
  totalCuotaDe,
  type MapaCuota,
} from '../utils/quota.js';

export interface InfoCuota {
  restantes: number;
  total: number;
  expiraISO: string;
  caducada: boolean;
}

/**
 * Contador local de cuota gratuita, persistido en localStorage.
 * Se decrementa solo ante generaciones completadas con éxito.
 */
export function useQuota() {
  const [mapaCrudo, setMapa] = useLocalStorage<MapaCuota>(CLAVE_CUOTA, estadoInicialCuota());
  const mapa = useMemo(() => normalizarMapaCuota(mapaCrudo), [mapaCrudo]);

  const infoCuota = useCallback(
    (modelId: ModelId): InfoCuota => {
      const total = totalCuotaDe(modelId);
      const expiraISO = expiraCuotaDe(modelId);
      const restantes = mapa[modelId]?.restantes ?? total;
      return { restantes, total, expiraISO, caducada: cuotaCaducada(expiraISO) };
    },
    [mapa],
  );

  const registrarExito = useCallback(
    (modelId: ModelId) => {
      setMapa((prev) => aplicarExito(normalizarMapaCuota(prev), modelId));
    },
    [setMapa],
  );

  const ajustarCuota = useCallback(
    (modelId: ModelId, valor: number) => {
      setMapa((prev) => aplicarAjuste(normalizarMapaCuota(prev), modelId, valor));
    },
    [setMapa],
  );

  const restablecerCuota = useCallback(() => {
    setMapa(estadoInicialCuota());
  }, [setMapa]);

  return { infoCuota, registrarExito, ajustarCuota, restablecerCuota };
}
