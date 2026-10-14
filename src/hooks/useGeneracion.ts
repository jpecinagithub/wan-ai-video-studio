import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { GenerationRequest, GenerationResponse } from '../types';

export type FaseGeneracion = 'inactiva' | 'procesando' | 'completada' | 'error';

const ESPERA_ENTRE_INTENTOS_MS = 12_000;
/** Tiempo máximo de seguimiento de una generación antes de rendirse. */
const TIEMPO_MAXIMO_MS = 12 * 60 * 1000;

/**
 * Ante estos fallos merece la pena reintentar la petición idéntica:
 * - estadoHttp 0: sin conexión o la función serverless fue interrumpida
 *   (el proveedor sigue generando; el reintento la retoma sin facturar).
 * - 429/502/503/504: límites o errores transitorios del proveedor.
 * Cualquier otro error (400, 401, 402, 403…) se informa sin reintentar.
 */
function esReintentable(err: unknown): boolean {
  if (!(err instanceof ApiClientError)) return false;
  if (err.estadoHttp === 0) return true;
  return [429, 502, 503, 504].includes(err.estadoHttp);
}

export interface CallbacksGeneracion {
  onCompletada: (respuesta: GenerationResponse) => void;
  onError: (mensaje: string) => void;
}

export interface EstadoGeneracion {
  fase: FaseGeneracion;
  error: string | null;
  /** Segundos desde que empezó el seguimiento actual. */
  elapsedSegundos: number;
  /** Número de intentos realizados contra la API. */
  intentos: number;
  /** Inicia el bucle generar → reintentar idéntico hasta completar o fallar. */
  iniciar: (solicitud: GenerationRequest, callbacks: CallbacksGeneracion) => void;
  /** Detiene el seguimiento local (la generación puede seguir en el proveedor). */
  detener: () => void;
}

/**
 * Bucle de generación contra Pollinations: la API es síncrona y puede
 * responder 202 {estado:'procesando'} (o cortarse por timeout). Cada
 * reintento envía la petición IDÉNTICA (mismos parámetros y seed), que el
 * proveedor retoma sin volver a facturar. Solo la generación se factura.
 */
export function useGeneracion(): EstadoGeneracion {
  const [fase, setFase] = useState<FaseGeneracion>('inactiva');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSegundos, setElapsedSegundos] = useState(0);
  const [intentos, setIntentos] = useState(0);

  const detenidoRef = useRef(false);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cronometroRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef<CallbacksGeneracion | null>(null);

  const limpiar = useCallback(() => {
    if (temporizadorRef.current) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    if (cronometroRef.current) {
      clearInterval(cronometroRef.current);
      cronometroRef.current = null;
    }
  }, []);

  const esperar = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        temporizadorRef.current = setTimeout(resolve, ms);
      }),
    [],
  );

  const detener = useCallback(() => {
    detenidoRef.current = true;
    limpiar();
    setFase('inactiva');
  }, [limpiar]);

  const iniciar = useCallback(
    (solicitud: GenerationRequest, callbacks: CallbacksGeneracion) => {
      detenidoRef.current = false;
      callbacksRef.current = callbacks;
      setError(null);
      setIntentos(0);
      setElapsedSegundos(0);
      setFase('procesando');
      cronometroRef.current = setInterval(() => {
        setElapsedSegundos((s) => s + 1);
      }, 1000);

      const inicio = Date.now();
      const bucle = async () => {
        let n = 0;
        for (;;) {
          if (detenidoRef.current) return;
          n += 1;
          setIntentos(n);
          try {
            const respuesta = await api.generarVideo(solicitud);
            if (detenidoRef.current) return;
            if (respuesta.estado === 'completado' && respuesta.videoUrl) {
              limpiar();
              setFase('completada');
              callbacksRef.current?.onCompletada(respuesta);
              return;
            }
            // 'procesando': esperar y reintentar la petición idéntica.
          } catch (err) {
            if (detenidoRef.current) return;
            if (!esReintentable(err)) {
              const mensaje =
                err instanceof ApiClientError
                  ? err.message
                  : 'No se pudo contactar con el servidor.';
              limpiar();
              setError(mensaje);
              setFase('error');
              callbacksRef.current?.onError(mensaje);
              return;
            }
            // Reintentable: se sigue esperando sin informar error.
          }
          if (Date.now() - inicio > TIEMPO_MAXIMO_MS) {
            limpiar();
            const mensaje =
              'La generación está tardando demasiado. Puedes reanudarla desde «Mis vídeos»: la solicitud idéntica no se vuelve a facturar.';
            setError(mensaje);
            setFase('error');
            callbacksRef.current?.onError(mensaje);
            return;
          }
          await esperar(ESPERA_ENTRE_INTENTOS_MS);
        }
      };
      void bucle();
    },
    [esperar, limpiar],
  );

  useEffect(() => limpiar, [limpiar]);

  return { fase, error, elapsedSegundos, intentos, iniciar, detener };
}
