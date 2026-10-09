import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { TaskStatusResponse, VideoStatus } from '../types';

const INTERVALO_BASE_MS = 15_000;
const INTERVALO_MAX_MS = 60_000;
const MAX_ERRORES_SEGUIDOS = 5;

const ESTADOS_TERMINALES: VideoStatus[] = ['completado', 'error', 'cancelado'];

export interface ResultadoPolling {
  /** Último estado conocido de la tarea (null si aún no hay respuesta). */
  estado: VideoStatus | null;
  /** Mensaje del último error de red/API, si lo hay. */
  error: string | null;
  /** Segundos desde que empezó el seguimiento actual. */
  elapsedSegundos: number;
  /** Detiene el polling local (la tarea remota puede seguir en el proveedor). */
  detener: () => void;
  /** Reanuda el polling desde cero (reinicia el contador de errores). */
  reanudar: () => void;
  /** false tras llamar a detener(), hasta reanudar(). */
  siguiendo: boolean;
}

/**
 * Consulta el estado de una tarea de generación cada 15 s.
 * Con errores consecutivos aplica backoff (15 s → 30 s → 60 s); tras 5
 * errores seguidos informa estado 'error' a través de onUpdate SIN borrar
 * la tarea, para que el usuario pueda reanudar el seguimiento.
 */
export function useTaskPolling(
  taskId: string | null,
  onUpdate: (respuesta: TaskStatusResponse) => void,
): ResultadoPolling {
  const [estado, setEstado] = useState<VideoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSegundos, setElapsedSegundos] = useState(0);
  const [siguiendo, setSiguiendo] = useState(true);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cronometroRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const erroresSeguidosRef = useRef(0);
  const detenidoRef = useRef(false);
  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;

  const limpiarTemporizadores = useCallback(() => {
    if (temporizadorRef.current) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    if (cronometroRef.current) {
      clearInterval(cronometroRef.current);
      cronometroRef.current = null;
    }
  }, []);

  const detener = useCallback(() => {
    detenidoRef.current = true;
    limpiarTemporizadores();
    setSiguiendo(false);
  }, [limpiarTemporizadores]);

  const consultar = useCallback(async () => {
    const id = taskIdRef.current;
    if (!id || detenidoRef.current) return;
    try {
      const respuesta = await api.estadoTarea(id);
      erroresSeguidosRef.current = 0;
      setError(null);
      setEstado(respuesta.estado);
      onUpdateRef.current(respuesta);
      if (ESTADOS_TERMINALES.includes(respuesta.estado)) {
        detenidoRef.current = true;
        limpiarTemporizadores();
        setSiguiendo(false);
        return;
      }
      temporizadorRef.current = setTimeout(consultar, INTERVALO_BASE_MS);
    } catch (err) {
      erroresSeguidosRef.current += 1;
      const mensaje =
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo consultar el estado de la tarea.';
      setError(mensaje);
      if (erroresSeguidosRef.current >= MAX_ERRORES_SEGUIDOS) {
        // Se informa el error pero la tarea NO se borra: se puede reanudar.
        onUpdateRef.current({ taskId: id, estado: 'error', error: mensaje });
        setEstado('error');
        detenidoRef.current = true;
        limpiarTemporizadores();
        setSiguiendo(false);
        return;
      }
      const espera = Math.min(
        INTERVALO_BASE_MS * 2 ** (erroresSeguidosRef.current - 1),
        INTERVALO_MAX_MS,
      );
      temporizadorRef.current = setTimeout(consultar, espera);
    }
  }, [limpiarTemporizadores]);

  const reanudar = useCallback(() => {
    if (!taskIdRef.current) return;
    limpiarTemporizadores();
    detenidoRef.current = false;
    erroresSeguidosRef.current = 0;
    setError(null);
    setElapsedSegundos(0);
    setSiguiendo(true);
    cronometroRef.current = setInterval(() => {
      setElapsedSegundos((s) => s + 1);
    }, 1000);
    void consultar();
  }, [consultar, limpiarTemporizadores]);

  useEffect(() => {
    if (!taskId) {
      limpiarTemporizadores();
      setEstado(null);
      setError(null);
      setElapsedSegundos(0);
      setSiguiendo(true);
      return;
    }
    detenidoRef.current = false;
    erroresSeguidosRef.current = 0;
    setError(null);
    setElapsedSegundos(0);
    setSiguiendo(true);
    cronometroRef.current = setInterval(() => {
      setElapsedSegundos((s) => s + 1);
    }, 1000);
    void consultar();
    return () => {
      limpiarTemporizadores();
      detenidoRef.current = true;
    };
  }, [taskId, consultar, limpiarTemporizadores]);

  return { estado, error, elapsedSegundos, detener, reanudar, siguiendo };
}
