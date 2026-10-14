import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { GenerationRequest, GenerationResponse } from '../types';
import { esModeloGratuito } from '../types';

export type FaseGeneracion = 'inactiva' | 'procesando' | 'completada' | 'error';

const ESPERA_ENTRE_INTENTOS_MS = 12_000;
/** Tiempo máximo de seguimiento de una generación antes de rendirse. */
const TIEMPO_MAXIMO_MS = 12 * 60 * 1000;

/** Pausa entre consultas de estado de Magic Hour. */
const ESPERA_STATUS_MAGICHOUR_MS = 8_000;
/** Tiempo máximo siguiendo un trabajo de Magic Hour. */
const TIEMPO_MAXIMO_MAGICHOUR_MS = 15 * 60 * 1000;

/**
 * Ante estos fallos merece la pena reintentar:
 * - estadoHttp 0: sin conexión o la función serverless fue interrumpida.
 * - 429/502/503/504: límites o errores transitorios del proveedor.
 * Cualquier otro error (400, 401, 402, 403, 410…) se informa sin reintentar.
 */
function esReintentable(err: unknown): boolean {
  if (!(err instanceof ApiClientError)) return false;
  if (err.estadoHttp === 0) return true;
  return [429, 502, 503, 504].includes(err.estadoHttp);
}

export interface CallbacksGeneracion {
  onCompletada: (respuesta: GenerationResponse) => void;
  onError: (mensaje: string) => void;
  /** Se invoca al crear el trabajo (Magic Hour) con su taskId, para poder reanudarlo. */
  onTaskCreada?: (taskId: string) => void;
}

export interface EstadoGeneracion {
  fase: FaseGeneracion;
  error: string | null;
  /** Segundos desde que empezó el seguimiento actual. */
  elapsedSegundos: number;
  /** Número de intentos realizados contra la API. */
  intentos: number;
  /**
   * Inicia la generación y su seguimiento:
   * - Pollinations: bucle generar → reintentar idéntico hasta completar.
   * - Magic Hour: crear el trabajo y consultar su estado hasta completarse.
   */
  iniciar: (solicitud: GenerationRequest, callbacks: CallbacksGeneracion) => void;
  /**
   * Reanuda el seguimiento de un trabajo existente de Magic Hour
   * (taskId con prefijo `mh-`), p. ej. desde «Mis vídeos».
   */
  reanudarSeguimiento: (taskId: string, callbacks: CallbacksGeneracion) => void;
  /** Detiene el seguimiento local (la generación puede seguir en el proveedor). */
  detener: () => void;
}

function mensajeError(err: unknown): string {
  return err instanceof ApiClientError ? err.message : 'No se pudo contactar con el servidor.';
}

/**
 * Generación de vídeo con seguimiento automático:
 * - Pollinations (pago): la API es síncrona y puede responder 202
 *   {estado:'procesando'} (o cortarse por timeout). Cada reintento envía la
 *   petición IDÉNTICA (mismos parámetros y seed), que el proveedor retoma
 *   sin volver a facturar. Solo la generación se factura.
 * - Magic Hour (gratis): la API es asíncrona. Se crea el trabajo
 *   (201 {estado:'pendiente', taskId}) y se consulta
 *   GET /api/video/status/:taskId hasta que esté 'completado'.
 *   Si la generación falla, Magic Hour devuelve los créditos.
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

  const fallar = useCallback(
    (mensaje: string) => {
      limpiar();
      setError(mensaje);
      setFase('error');
      callbacksRef.current?.onError(mensaje);
    },
    [limpiar],
  );

  const completar = useCallback(
    (respuesta: GenerationResponse) => {
      limpiar();
      setFase('completada');
      callbacksRef.current?.onCompletada(respuesta);
    },
    [limpiar],
  );

  const preparar = useCallback(
    (callbacks: CallbacksGeneracion) => {
      detenidoRef.current = false;
      callbacksRef.current = callbacks;
      setError(null);
      setIntentos(0);
      setElapsedSegundos(0);
      setFase('procesando');
      cronometroRef.current = setInterval(() => {
        setElapsedSegundos((s) => s + 1);
      }, 1000);
    },
    [],
  );

  /** Bucle de consulta de estado de Magic Hour hasta completarse. */
  const seguirTrabajoMagicHour = useCallback(
    (taskId: string) => {
      const inicio = Date.now();
      const bucle = async () => {
        let n = 0;
        for (;;) {
          if (detenidoRef.current) return;
          n += 1;
          setIntentos(n);
          try {
            const estado = await api.consultarEstado(taskId);
            if (detenidoRef.current) return;
            if (estado.estado === 'completado' && estado.videoUrl) {
              completar({ estado: 'completado', videoUrl: estado.videoUrl });
              return;
            }
            // 'pendiente' | 'procesando': seguir consultando.
          } catch (err) {
            if (detenidoRef.current) return;
            if (!esReintentable(err)) {
              fallar(mensajeError(err));
              return;
            }
            // Reintentable: se sigue consultando sin informar error.
          }
          if (Date.now() - inicio > TIEMPO_MAXIMO_MAGICHOUR_MS) {
            fallar(
              'La generación está tardando demasiado. Puedes reanudarla desde «Mis vídeos».',
            );
            return;
          }
          await esperar(ESPERA_STATUS_MAGICHOUR_MS);
        }
      };
      void bucle();
    },
    [completar, esperar, fallar],
  );

  /** Rama Pollinations: reintentar la petición idéntica hasta completar. */
  const buclePollinations = useCallback(
    (solicitud: GenerationRequest) => {
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
              completar(respuesta);
              return;
            }
            // 'procesando': esperar y reintentar la petición idéntica.
          } catch (err) {
            if (detenidoRef.current) return;
            if (!esReintentable(err)) {
              fallar(mensajeError(err));
              return;
            }
          }
          if (Date.now() - inicio > TIEMPO_MAXIMO_MS) {
            fallar(
              'La generación está tardando demasiado. Puedes reanudarla desde «Mis vídeos»: la solicitud idéntica no se vuelve a facturar.',
            );
            return;
          }
          await esperar(ESPERA_ENTRE_INTENTOS_MS);
        }
      };
      void bucle();
    },
    [completar, esperar, fallar],
  );

  const iniciar = useCallback(
    (solicitud: GenerationRequest, callbacks: CallbacksGeneracion) => {
      preparar(callbacks);
      if (esModeloGratuito(solicitud.modelId)) {
        // Magic Hour: crear el trabajo y seguir su estado.
        const crear = async () => {
          try {
            const respuesta = await api.generarVideo(solicitud);
            if (detenidoRef.current) return;
            if (respuesta.estado === 'pendiente' && respuesta.taskId) {
              callbacksRef.current?.onTaskCreada?.(respuesta.taskId);
              seguirTrabajoMagicHour(respuesta.taskId);
              return;
            }
            if (respuesta.estado === 'completado' && respuesta.videoUrl) {
              completar(respuesta);
              return;
            }
            fallar('Respuesta inesperada del servidor al crear el trabajo.');
          } catch (err) {
            if (detenidoRef.current) return;
            fallar(mensajeError(err));
          }
        };
        void crear();
        return;
      }
      buclePollinations(solicitud);
    },
    [buclePollinations, completar, fallar, preparar, seguirTrabajoMagicHour],
  );

  const reanudarSeguimiento = useCallback(
    (taskId: string, callbacks: CallbacksGeneracion) => {
      preparar(callbacks);
      seguirTrabajoMagicHour(taskId);
    },
    [preparar, seguirTrabajoMagicHour],
  );

  useEffect(() => limpiar, [limpiar]);

  return { fase, error, elapsedSegundos, intentos, iniciar, reanudarSeguimiento, detener };
}
