import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { track } from '@vercel/analytics';
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Eraser,
  EyeOff,
  Film,
  Gauge,
  Loader2,
  Play,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Button, Card, ErrorBanner, FieldLabel, Modal, Toggle } from '../components/ui';
import { ImagenesReferencia, type ImagenReferenciaItem } from '../components/ImagenesReferencia';
import { VideoPlayer } from '../components/VideoPlayer';
import {
  CAPACIDADES,
  duracionesDe,
  esCombinacionValida,
  estimarCoste,
  maxImagenesDe,
  motivoIncompatibilidad,
  resolucionesDe,
  urlVigente,
} from '../constants/capabilities';
import { MODELOS, MODELO_POR_DEFECTO, obtenerModelo, textoPrecioModelo } from '../constants/models';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useGeneracion } from '../hooks/useGeneracion';
import { api, ApiClientError } from '../services/api';
import type {
  AspectRatio,
  GenerationRequest,
  GenerationResponse,
  ModelId,
  Resolution,
  VideoStatus,
} from '../types';
import { esModeloGratuito } from '../types';
import { cn, formatFecha, formatSeconds, newRequestId, truncate } from '../utils/format';
import { ErrorImagen, comprimirImagen } from '../utils/imagenes';
import { guardarVideo, obtenerVideo } from '../utils/db';
import { descargarVideo } from '../utils/download';
import { capturarPoster } from '../utils/poster';

const TAREA_PENDIENTE_KEY = 'wan-studio:tarea-pendiente';
const CLAVE_HISTORIAL = 'wan-studio-historial-prompts';
const MAX_HISTORIAL = 10;
const UMBRAL_MENSAJE_LARGO_S = 120;

interface GeneracionPendiente {
  solicitud: GenerationRequest;
  startedAt: string;
  recordId: string;
  /** Identificador del trabajo en Magic Hour (con prefijo `mh-`), para reanudarlo. */
  taskIdRemoto?: string;
}

interface VideoCompletado {
  videoUrl: string;
  expiraEn?: string;
  modelId: ModelId;
  duracion: number;
  resolucion: Resolution;
  aspecto: AspectRatio;
  fecha: string;
  prompt: string;
}

interface EstadoNavegacion {
  prompt?: string;
  modelId?: ModelId;
  duration?: number;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  audio?: boolean;
  replay?: { solicitud: GenerationRequest; recordId: string; taskIdRemoto?: string };
}

function leerTareaPendiente(): GeneracionPendiente | null {
  try {
    const crudo = window.localStorage.getItem(TAREA_PENDIENTE_KEY);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as GeneracionPendiente;
    return datos?.solicitud ? datos : null;
  } catch {
    return null;
  }
}

function guardarTareaPendiente(pendiente: GeneracionPendiente | null): void {
  try {
    if (pendiente) {
      window.localStorage.setItem(TAREA_PENDIENTE_KEY, JSON.stringify(pendiente));
    } else {
      window.localStorage.removeItem(TAREA_PENDIENTE_KEY);
    }
  } catch {
    /* sin almacenamiento: la tarea se sigue en memoria */
  }
}

function nombreSugerido(): string {
  const f = new Date();
  const relleno = (n: number) => n.toString().padStart(2, '0');
  return `video-${f.getFullYear()}${relleno(f.getMonth() + 1)}${relleno(f.getDate())}-${relleno(f.getHours())}${relleno(f.getMinutes())}`;
}

/** Semilla aleatoria para que cada generación (y sus reintentos) sea idéntica. */
function semillaAleatoria(): number {
  return Math.floor(Math.random() * 2147483648);
}

/**
 * Pantalla principal: el estudio.
 * Configurar → confirmar → subir imágenes → generar (con reintentos
 * idempotentes) → reproducir → descargar.
 */
export function Studio() {
  const location = useLocation();
  const estadoNav = (location.state as EstadoNavegacion | null) ?? {};

  const modeloInicial = obtenerModelo(MODELO_POR_DEFECTO)!;

  /* ---------- Configuración ---------- */
  const [prompt, setPrompt] = useState(estadoNav.prompt ?? '');
  const [modelId, setModelId] = useState<ModelId>(
    estadoNav.modelId ?? MODELO_POR_DEFECTO,
  );
  const [duracion, setDuracion] = useState<number>(
    estadoNav.duration ?? modeloInicial.duracionDefecto,
  );
  const [resolucion, setResolucion] = useState<Resolution>(
    estadoNav.resolution ?? modeloInicial.resolucionDefecto,
  );
  const [aspecto, setAspecto] = useState<AspectRatio>(estadoNav.aspectRatio ?? '16:9');
  const [audio, setAudio] = useState(estadoNav.audio ?? true);
  const [mostrarAvanzadas, setMostrarAvanzadas] = useState(false);
  const [semilla, setSemilla] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [imagenes, setImagenes] = useState<ImagenReferenciaItem[]>([]);
  const [errorImagenes, setErrorImagenes] = useState<string | null>(null);
  const [procesandoImagenes, setProcesandoImagenes] = useState(false);
  const [subiendoImagenes, setSubiendoImagenes] = useState(false);

  /* ---------- Estado de flujo ---------- */
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [tareaActiva, setTareaActiva] = useState<GeneracionPendiente | null>(leerTareaPendiente);
  const [errorTarea, setErrorTarea] = useState<string | null>(null);
  const [panelColapsado, setPanelColapsado] = useState(false);
  const [resultado, setResultado] = useState<VideoCompletado | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [promptExpandido, setPromptExpandido] = useState(false);

  const [historial, setHistorial] = useLocalStorage<string[]>(CLAVE_HISTORIAL, []);

  const tareaActivaRef = useRef(tareaActiva);
  tareaActivaRef.current = tareaActiva;
  const replayIniciadoRef = useRef(false);

  const modelo = obtenerModelo(modelId) ?? modeloInicial;
  const maxImagenes = maxImagenesDe(modelId);
  const duraciones = duracionesDe(modelId);
  const resoluciones = resolucionesDe(modelId);

  const parametros = useMemo(
    () => ({ modelId, duration: duracion, resolution: resolucion, aspectRatio: aspecto, audio }),
    [modelId, duracion, resolucion, aspecto, audio],
  );
  const motivo = motivoIncompatibilidad(parametros);
  const valida = esCombinacionValida(parametros);
  const coste = estimarCoste(parametros);

  const { fase, elapsedSegundos, intentos, iniciar, reanudarSeguimiento: reanudarPorTaskId, detener } =
    useGeneracion();
  const generando = enviando || fase === 'procesando';
  const puedeGenerar = prompt.trim().length > 0 && valida && !generando;
  const esGratis = esModeloGratuito(modelId);
  const promptMax = esGratis
    ? CAPACIDADES.prompt.maxCaracteres
    : CAPACIDADES.prompt.maxCaracteresPollinations;

  /* ---------- Finalización de la generación ---------- */
  const manejarCompletada = useCallback(async (resp: GenerationResponse) => {
    const pendiente = tareaActivaRef.current;
    if (!pendiente || !resp.videoUrl) return;

    const video: VideoCompletado = {
      videoUrl: resp.videoUrl,
      expiraEn: resp.expiraEn,
      modelId: pendiente.solicitud.modelId,
      duracion: resp.metadatos?.duracion ?? pendiente.solicitud.duration,
      resolucion: resp.metadatos?.resolucion ?? pendiente.solicitud.resolution,
      aspecto: resp.metadatos?.aspecto ?? pendiente.solicitud.aspectRatio,
      fecha: pendiente.startedAt,
      prompt: pendiente.solicitud.prompt,
    };

    const registro = await obtenerVideo(pendiente.recordId).catch(() => undefined);
    if (registro) {
      await guardarVideo({
        ...registro,
        estado: 'completado' satisfies VideoStatus,
        videoUrl: resp.videoUrl,
        expiraEn: resp.expiraEn,
        seguimientoDetenido: false,
      }).catch(() => undefined);
    }
    // Póster en segundo plano: un único intento, sin bloquear la UI.
    capturarPoster(resp.videoUrl, 320)
      .then(async (poster) => {
        if (!poster) return;
        const actual = await obtenerVideo(pendiente.recordId).catch(() => undefined);
        if (actual) {
          await guardarVideo({ ...actual, poster }).catch(() => undefined);
        }
      })
      .catch(() => undefined);

    track('generacion_completada', {
      modelo: pendiente.solicitud.modelId,
      duracion: pendiente.solicitud.duration,
    });
    setResultado(video);
    setNombreArchivo(nombreSugerido());
    setTareaActiva(null);
    setErrorTarea(null);
    guardarTareaPendiente(null);
  }, []);

  const manejarError = useCallback(async (mensaje: string) => {
    const pendiente = tareaActivaRef.current;
    if (pendiente) {
      const registro = await obtenerVideo(pendiente.recordId).catch(() => undefined);
      if (registro) {
        await guardarVideo({ ...registro, estado: 'error' satisfies VideoStatus }).catch(
          () => undefined,
        );
      }
    }
    track('error', { codigo: 'GENERACION_FALLIDA' });
    setErrorTarea(mensaje);
    // Se conserva la tarea activa para poder reintentar con el mismo botón.
  }, []);

  const comenzarSeguimiento = useCallback(
    async (solicitud: GenerationRequest, recordIdExistente?: string) => {
      const startedAt = new Date().toISOString();
      const recordId = recordIdExistente ?? newRequestId();
      const pendiente: GeneracionPendiente = { solicitud, startedAt, recordId };
      guardarTareaPendiente(pendiente);
      setTareaActiva(pendiente);
      setResultado(null);
      setErrorTarea(null);
      setPanelColapsado(false);

      if (!recordIdExistente) {
        await guardarVideo({
          id: recordId,
          fecha: startedAt,
          prompt: solicitud.prompt,
          modelId: solicitud.modelId,
          duracion: solicitud.duration,
          resolucion: solicitud.resolution,
          aspecto: solicitud.aspectRatio,
          estado: 'pendiente',
          nombre: nombreSugerido(),
          solicitud,
        }).catch(() => undefined);
        track('generacion_iniciada', {
          modelo: solicitud.modelId,
          duracion: solicitud.duration,
          resolucion: solicitud.resolution,
        });
      } else {
        const registro = await obtenerVideo(recordId).catch(() => undefined);
        if (registro) {
          await guardarVideo({
            ...registro,
            estado: 'pendiente' satisfies VideoStatus,
            seguimientoDetenido: false,
          }).catch(() => undefined);
        }
      }

      iniciar(solicitud, {
        onCompletada: manejarCompletada,
        onError: manejarError,
        // Magic Hour: guardar el taskId para poder reanudar el seguimiento.
        onTaskCreada: (taskId) => {
          setTareaActiva((prev) => {
            if (!prev || prev.recordId !== recordId) return prev;
            const actualizada = { ...prev, taskIdRemoto: taskId };
            guardarTareaPendiente(actualizada);
            return actualizada;
          });
          void (async () => {
            const registro = await obtenerVideo(recordId).catch(() => undefined);
            if (registro) {
              await guardarVideo({ ...registro, taskIdRemoto: taskId }).catch(() => undefined);
            }
          })();
        },
      });
    },
    [iniciar, manejarCompletada, manejarError],
  );

  /* ---------- Reanudar una generación pendiente (Mis vídeos o recarga) ---------- */
  useEffect(() => {
    if (replayIniciadoRef.current) return;
    const replay = estadoNav.replay;
    if (replay?.solicitud) {
      replayIniciadoRef.current = true;
      const s = replay.solicitud;
      setPrompt(s.prompt);
      setModelId(s.modelId);
      setDuracion(s.duration);
      setResolucion(s.resolution);
      setAspecto(s.aspectRatio);
      setAudio(s.audio);
      setSemilla(s.seed !== undefined ? String(s.seed) : '');
      if (replay.taskIdRemoto) {
        // Magic Hour: el trabajo ya existe; seguir consultando su estado.
        const startedAt = new Date().toISOString();
        const pendiente: GeneracionPendiente = {
          solicitud: s,
          startedAt,
          recordId: replay.recordId,
          taskIdRemoto: replay.taskIdRemoto,
        };
        guardarTareaPendiente(pendiente);
        setTareaActiva(pendiente);
        setResultado(null);
        setErrorTarea(null);
        setPanelColapsado(false);
        void (async () => {
          const registro = await obtenerVideo(replay.recordId).catch(() => undefined);
          if (registro) {
            await guardarVideo({
              ...registro,
              estado: 'pendiente' satisfies VideoStatus,
              seguimientoDetenido: false,
            }).catch(() => undefined);
          }
        })();
        reanudarPorTaskId(replay.taskIdRemoto, {
          onCompletada: manejarCompletada,
          onError: manejarError,
        });
      } else {
        void comenzarSeguimiento(s, replay.recordId);
      }
    }
    // Solo al montar: el estado de navegación no cambia después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Acciones ---------- */
  const seleccionarModelo = (id: ModelId) => {
    const nuevo = obtenerModelo(id);
    if (!nuevo) return;
    setModelId(id);
    setDuracion(nuevo.duracionDefecto);
    setResolucion(nuevo.resolucionDefecto);
    setImagenes((prev) => prev.slice(0, nuevo.maxImagenes));
    setErrorImagenes(null);
    track('seleccion_modelo', { modelo: id });
  };

  /* ---------- Imágenes de referencia ---------- */
  const añadirImagenes = async (archivos: File[]) => {
    if (archivos.length === 0 || procesandoImagenes) return;
    setErrorImagenes(null);
    const hueco = maxImagenes - imagenes.length;
    if (hueco <= 0) {
      setErrorImagenes(
        maxImagenes === 1
          ? 'Este modelo admite 1 imagen de referencia (fotograma inicial).'
          : `El máximo es ${maxImagenes} imágenes de referencia.`,
      );
      return;
    }
    const lote = archivos.slice(0, hueco);
    setProcesandoImagenes(true);
    try {
      const comprimidas: ImagenReferenciaItem[] = [];
      for (const archivo of lote) {
        const c = await comprimirImagen(archivo);
        comprimidas.push({ id: newRequestId(), dataUrl: c.dataUrl, nombre: c.nombre });
      }
      setImagenes((prev) => [...prev, ...comprimidas].slice(0, maxImagenes));
      if (archivos.length > hueco) {
        setErrorImagenes(
          `Se añadieron ${hueco} de ${archivos.length}: el máximo es ${maxImagenes}.`,
        );
      }
    } catch (err) {
      setErrorImagenes(
        err instanceof ErrorImagen ? err.message : 'No se pudieron procesar las imágenes.',
      );
    } finally {
      setProcesandoImagenes(false);
    }
  };

  const eliminarImagen = (id: string) => {
    setImagenes((prev) => prev.filter((img) => img.id !== id));
    setErrorImagenes(null);
  };

  const limpiar = () => setPrompt('');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* Portapapeles no disponible: no se interrumpe el flujo. */
    }
  };

  const guardarEnHistorial = (texto: string) => {
    setHistorial((prev) => [texto, ...prev.filter((p) => p !== texto)].slice(0, MAX_HISTORIAL));
  };

  const borrarDelHistorial = (texto: string) => {
    setHistorial((prev) => prev.filter((p) => p !== texto));
  };

  const abrirConfirmacion = () => {
    if (!puedeGenerar) return;
    setErrorEnvio(null);
    setModalAbierto(true);
  };

  const confirmarGeneracion = async () => {
    if (enviando || !puedeGenerar) return;
    setEnviando(true);
    setErrorEnvio(null);

    const semillaNum = semilla.trim() === '' ? semillaAleatoria() : Math.floor(Number(semilla));
    const semillaFinal =
      Number.isNaN(semillaNum) || semillaNum < 0 ? semillaAleatoria() : semillaNum;

    try {
      // 1) Subir las imágenes de referencia al almacenamiento del proveedor.
      //    Así /generate recibe solo rutas/URLs y los reintentos son idénticos.
      //    - Pollinations: URLs públicas (/api/video/media).
      //    - MiniMax H3: file_path de Magic Hour (/api/video/media-mh).
      //    - LTX 2.5: solo texto a vídeo, no hay nada que subir.
      setSubiendoImagenes(true);
      const urls: string[] = [];
      const rutas: string[] = [];
      try {
        if (modelId === 'magichour/minimax-h3') {
          const subidas = await Promise.all(
            imagenes.map((img) => api.subirImagenMH(img.dataUrl)),
          );
          for (const s of subidas) rutas.push(s.filePath);
        } else if (maxImagenes > 0) {
          const subidas = await Promise.all(
            imagenes.map((img) => api.subirImagen(img.dataUrl)),
          );
          for (const s of subidas) urls.push(s.url);
        }
      } finally {
        setSubiendoImagenes(false);
      }

      // 2) Generar (con reintentos idempotentes hasta completar).
      const solicitud: GenerationRequest = {
        prompt: prompt.trim(),
        modelId,
        duration: duracion,
        resolution: resolucion,
        aspectRatio: aspecto,
        audio,
        seed: semillaFinal,
        imageUrls: urls.length > 0 ? urls : undefined,
        imageFilePaths: rutas.length > 0 ? rutas : undefined,
      };
      guardarEnHistorial(solicitud.prompt);
      setModalAbierto(false);
      await comenzarSeguimiento(solicitud);
    } catch (err) {
      const codigo = err instanceof ApiClientError ? err.codigo : 'SIN_CONEXION';
      const mensaje =
        err instanceof ApiClientError ? err.message : 'No se pudo contactar con el servidor.';
      track('error', { codigo });
      setErrorEnvio(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const dejarDeSeguir = async () => {
    detener();
    const pendiente = tareaActivaRef.current;
    if (pendiente) {
      const registro = await obtenerVideo(pendiente.recordId).catch(() => undefined);
      if (registro) {
        await guardarVideo({ ...registro, seguimientoDetenido: true }).catch(() => undefined);
      }
    }
  };

  const reanudarSeguimiento = () => {
    const pendiente = tareaActivaRef.current;
    if (!pendiente || fase === 'procesando') return;
    setErrorTarea(null);
    setPanelColapsado(false);
    void (async () => {
      const registro = await obtenerVideo(pendiente.recordId).catch(() => undefined);
      if (registro) {
        await guardarVideo({ ...registro, seguimientoDetenido: false }).catch(() => undefined);
      }
    })();
    const callbacks = { onCompletada: manejarCompletada, onError: manejarError };
    // Magic Hour con trabajo ya creado: seguir consultando su estado.
    if (pendiente.taskIdRemoto) {
      reanudarPorTaskId(pendiente.taskIdRemoto, callbacks);
      return;
    }
    iniciar(pendiente.solicitud, callbacks);
  };

  const descartarPendiente = () => {
    detener();
    guardarTareaPendiente(null);
    setTareaActiva(null);
    setErrorTarea(null);
  };

  const descargar = async () => {
    if (!resultado || descargando) return;
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await descargarVideo(resultado.videoUrl, nombreArchivo.trim() || 'video');
      track('descarga', { modelo: resultado.modelId });
    } catch (err) {
      setErrorDescarga(err instanceof Error ? err.message : 'No se pudo descargar el vídeo.');
    } finally {
      setDescargando(false);
    }
  };

  const siguiendo = fase === 'procesando';
  const mensajeRotativo =
    elapsedSegundos >= UMBRAL_MENSAJE_LARGO_S
      ? 'Tu generación continúa procesándose.'
      : 'Estamos creando tu vídeo.';
  const duracionEsSegmentada = duraciones.length <= 4;

  /* ---------- Render ---------- */
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* -------- Panel de configuración -------- */}
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Crea vídeos con inteligencia artificial
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">
            Describe la escena que imaginas y conviértela en vídeo: tienes modelos de pago
            (Pollinations) y modelos gratuitos con créditos (Magic Hour). Sin tecnicismos:
            escribe, configura y genera.
          </p>
        </div>

        {/* Modelo */}
        <Card>
          <h2 className="mb-3 text-base font-semibold">Modelo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODELOS.map((m) => {
              const activo = m.id === modelId;
              const rangoDuracion =
                m.duraciones.length <= 4
                  ? `${m.duraciones.join(' / ')} s`
                  : `${m.duraciones[0]}–${m.duraciones[m.duraciones.length - 1]} s`;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => seleccionarModelo(m.id)}
                  aria-pressed={activo}
                  className={cn(
                    'block w-full rounded-xl2 border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    activo
                      ? 'border-accent bg-accent-soft shadow-glow'
                      : 'border-line bg-surface-2 hover:border-muted',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{m.nombre}</p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          m.tipoCoste === 'gratis'
                            ? 'bg-success/15 text-success'
                            : 'bg-accent-soft text-accent',
                        )}
                      >
                        {m.tipoCoste === 'gratis' ? 'Gratis' : 'De pago'}
                      </span>
                      {activo && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">{m.descripcion}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {m.caracteristicas.map((c) => (
                      <li key={c} className="flex items-start gap-1.5 text-xs text-muted">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    {m.velocidad === 'rápida' ? (
                      <Zap className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    ) : (
                      <Gauge className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    )}
                    <span>Velocidad {m.velocidad}</span>
                    <span aria-hidden="true">·</span>
                    <span>{m.resoluciones.join(' / ')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{rangoDuracion}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {m.maxImagenes === 0
                      ? 'Solo texto a vídeo'
                      : m.maxImagenes === 1
                        ? '1 imagen de referencia'
                        : 'Hasta 2 imágenes'}{' '}
                    · {m.generaAudio ? 'con audio' : 'sin audio'}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-muted">
                    {textoPrecioModelo(m)}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Imágenes de referencia (solo modelos de pago que las admitan) */}
        {maxImagenes > 0 && (
          <ImagenesReferencia
            imagenes={imagenes}
            onAñadir={añadirImagenes}
            onEliminar={eliminarImagen}
            maxImagenes={maxImagenes}
            procesando={procesandoImagenes}
            subiendo={subiendoImagenes}
            error={errorImagenes}
            deshabilitado={generando}
          />
        )}

        {/* Prompt */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel htmlFor="prompt">Describe tu vídeo</FieldLabel>
            <span className="text-xs text-muted" aria-live="polite">
              {prompt.length} / {promptMax}
            </span>
          </div>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, promptMax))}
            rows={6}
            placeholder="Un plano aéreo cinematográfico de un castillo medieval entre montañas al amanecer… (puedes escribir en español o en inglés)"
            className="w-full resize-y rounded-xl2 border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={limpiar} disabled={prompt.length === 0}>
              <Eraser className="h-4 w-4" aria-hidden="true" /> Limpiar
            </Button>
            <Button variant="secondary" onClick={copiar} disabled={prompt.length === 0}>
              {copiado ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
            <Link to="/biblioteca" className="inline-flex">
              <Button variant="ghost">
                <BookOpen className="h-4 w-4" aria-hidden="true" /> Ver ejemplos
              </Button>
            </Link>
          </div>

          {historial.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Prompts recientes
                </p>
                <button
                  type="button"
                  onClick={() => setHistorial([])}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Borrar todo
                </button>
              </div>
              <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                {historial.map((p) => (
                  <li
                    key={p}
                    className="group flex items-center gap-1 rounded-lg transition-colors hover:bg-surface-2"
                  >
                    <button
                      type="button"
                      onClick={() => setPrompt(p)}
                      title={`Reutilizar: ${p}`}
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {truncate(p, 90)}
                    </button>
                    <button
                      type="button"
                      onClick={() => borrarDelHistorial(p)}
                      aria-label={`Borrar prompt: ${truncate(p, 60)}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Duración */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Duración</h2>
            <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent">
              {formatSeconds(duracion)}
            </span>
          </div>
          {duracionEsSegmentada ? (
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duración">
              {duraciones.map((d) => {
                const activa = d === duracion;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => setDuracion(d)}
                    className={cn(
                      'rounded-xl2 border p-3 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      activa
                        ? 'border-accent bg-accent-soft'
                        : 'border-line bg-surface-2 hover:border-muted',
                    )}
                  >
                    <p className="font-semibold">{formatSeconds(d)}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <input
                id="duracion"
                type="range"
                min={duraciones[0]}
                max={duraciones[duraciones.length - 1]}
                step={1}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="w-full accent-[#8b5cf6]"
                aria-valuetext={`${duracion} segundos`}
              />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{duraciones[0]}s</span>
                <span>{duraciones[duraciones.length - 1]}s</span>
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-muted">
            {modelo.nombre} admite {duraciones.length <= 4 ? 'estas duraciones' : 'este rango'}.
          </p>
        </Card>

        {/* Resolución */}
        <Card>
          <h2 className="mb-3 text-base font-semibold">Resolución</h2>
          <div
            className="grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Resolución"
          >
            {CAPACIDADES.resoluciones
              .filter((r) => resoluciones.includes(r.id))
              .map((r) => {
                const activa = r.id === resolucion;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => setResolucion(r.id)}
                    className={cn(
                      'rounded-xl2 border p-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      activa
                        ? 'border-accent bg-accent-soft'
                        : 'border-line bg-surface-2 hover:border-muted',
                    )}
                  >
                    <p className="font-semibold">{r.nombre}</p>
                    <p className="mt-1 text-xs text-muted">{r.descripcion}</p>
                  </button>
                );
              })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {CAPACIDADES.resoluciones.find((r) => r.id === resolucion)?.impacto}
          </p>
        </Card>

        {/* Relación de aspecto */}
        <Card>
          <h2 className="mb-3 text-base font-semibold">Formato de pantalla</h2>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Relación de aspecto">
            {CAPACIDADES.aspectos.map((a) => {
              const activo = a.id === aspecto;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  title={`${a.nombre} — ${a.descripcion}`}
                  onClick={() => setAspecto(a.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl2 border p-2.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    activo
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface-2 hover:border-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('h-6 border-2', activo ? 'border-accent' : 'border-muted')}
                    style={{ aspectRatio: a.ratioCss }}
                  />
                  <span className="text-[11px] font-medium">{a.id}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {CAPACIDADES.aspectos.find((a) => a.id === aspecto)?.nombre} —{' '}
            {CAPACIDADES.aspectos.find((a) => a.id === aspecto)?.descripcion}
          </p>
        </Card>

        {/* Audio y avanzadas */}
        <Card>
          <Toggle
            id="audio"
            label="Audio"
            descripcion={CAPACIDADES.audio.descripcion}
            checked={audio}
            onChange={setAudio}
          />
          {!esGratis && (
            <>
              <button
                type="button"
                onClick={() => setMostrarAvanzadas((v) => !v)}
                aria-expanded={mostrarAvanzadas}
                className="mt-2 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {mostrarAvanzadas ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', mostrarAvanzadas && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              {mostrarAvanzadas && (
                <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
                  <div>
                    <FieldLabel htmlFor="semilla">Semilla (opcional)</FieldLabel>
                    <input
                      id="semilla"
                      type="number"
                      min={0}
                      max={2147483647}
                      value={semilla}
                      onChange={(e) => setSemilla(e.target.value)}
                      placeholder="Aleatoria"
                      className="w-full rounded-xl2 border border-line bg-bg p-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                    />
                    <p className="mt-1 text-xs text-muted">
                      {CAPACIDADES.avanzadas.semilla.descripcion}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Coste estimado */}
        <Card>
          <h2 className="mb-2 text-base font-semibold">Coste estimado</h2>
          <p className="text-lg font-bold text-accent">{coste.texto}</p>
          {esGratis ? (
            <p className="mt-1 text-xs text-muted">
              Se descuenta de los créditos gratuitos de tu cuenta de Magic Hour (sin tarjeta). Si
              la generación falla, los créditos se devuelven.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Se descuenta de tu saldo de Pollen de pago ($1 ≈ 1 pollen). Las peticiones fallidas no
              se facturan.
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            Modelo: {modelo.nombre} · {formatSeconds(duracion)} · {resolucion}
            {imagenes.length > 0 &&
              ` · ${imagenes.length} ${imagenes.length === 1 ? 'imagen' : 'imágenes'}`}
          </p>
        </Card>

        {/* Generar */}
        {motivo && <ErrorBanner titulo="Combinación no válida" mensaje={motivo} />}
        {errorEnvio && <ErrorBanner titulo="No se pudo iniciar la generación" mensaje={errorEnvio} />}
        {tareaActiva && fase !== 'procesando' && !resultado && (
          <p className="rounded-xl2 border border-line bg-surface-2 p-3 text-center text-xs text-muted">
            Tienes una generación en pausa. Reanúdala desde el panel de la derecha o descártala
            para empezar otra.
          </p>
        )}
        <Button
          onClick={abrirConfirmacion}
          disabled={!puedeGenerar}
          className="hidden w-full py-4 text-base lg:inline-flex"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          Generar vídeo
        </Button>
        <p className="hidden text-center text-xs text-muted lg:block">
          Al generar aceptas que la solicitud se procese en{' '}
          {esGratis ? 'Magic Hour' : 'Pollinations (gen.pollinations.ai)'}.
        </p>
      </div>

      {/* -------- Panel de visualización -------- */}
      <div className="flex flex-col gap-5">
        {tareaActiva ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                {siguiendo ? 'Generación en curso' : 'Generación en pausa'}
              </h2>
              <button
                type="button"
                onClick={() => setPanelColapsado((v) => !v)}
                aria-expanded={!panelColapsado}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                {panelColapsado ? 'Mostrar' : 'Ocultar'}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', panelColapsado && '-rotate-90')}
                  aria-hidden="true"
                />
              </button>
            </div>

            {!panelColapsado && (
              <div className="mt-4">
                {siguiendo ? (
                  <div className="flex flex-col items-center py-6 text-center" aria-live="polite">
                    <span className="relative flex h-16 w-16 items-center justify-center">
                      <span
                        className="absolute inset-0 animate-ping rounded-full bg-accent/20"
                        aria-hidden="true"
                      />
                      <span
                        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft"
                        aria-hidden="true"
                      >
                        <Loader2 className="h-7 w-7 animate-spin text-accent" />
                      </span>
                    </span>
                    <p className="mt-4 text-sm font-medium text-ink">{mensajeRotativo}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Tiempo transcurrido: {formatSeconds(elapsedSegundos)}
                      {intentos > 1 && ` · intento ${intentos}`}
                    </p>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-sm font-medium text-ink">
                      {errorTarea ? 'La generación se detuvo con un error.' : 'Seguimiento en pausa.'}
                    </p>
                    {errorTarea && (
                      <p className="mx-auto mt-2 max-w-md text-xs text-muted">{errorTarea}</p>
                    )}
                    {!errorTarea && (
                      <p className="mx-auto mt-2 max-w-md text-xs text-muted">
                        {tareaActiva.solicitud && esModeloGratuito(tareaActiva.solicitud.modelId)
                          ? 'El trabajo puede seguir procesándose en Magic Hour. Reanudar consulta su estado sin coste adicional.'
                          : 'La generación puede seguir procesándose en Pollinations. Reanudar envía la solicitud idéntica, sin coste adicional.'}
                      </p>
                    )}
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-3 rounded-xl2 bg-surface-2 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted">Modelo</dt>
                    <dd className="mt-0.5 font-medium">
                      {obtenerModelo(tareaActiva.solicitud.modelId)?.nombre}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Resolución</dt>
                    <dd className="mt-0.5 font-medium">{tareaActiva.solicitud.resolution}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Duración</dt>
                    <dd className="mt-0.5 font-medium">
                      {formatSeconds(tareaActiva.solicitud.duration)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Estado</dt>
                    <dd className="mt-0.5 font-medium">
                      {siguiendo ? 'Generando' : errorTarea ? 'Error' : 'En pausa'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  {siguiendo ? (
                    <Button variant="secondary" onClick={dejarDeSeguir}>
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                      Dejar de seguir
                    </Button>
                  ) : (
                    <>
                      <Button onClick={reanudarSeguimiento}>
                        <Play className="h-4 w-4" aria-hidden="true" />
                        {errorTarea ? 'Reintentar' : 'Reanudar seguimiento'}
                      </Button>
                      <Button variant="secondary" onClick={descartarPendiente}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Descartar
                      </Button>
                    </>
                  )}
                </div>
                {siguiendo && (
                  <p className="mt-2 text-xs text-muted">
                    {tareaActiva.solicitud && esModeloGratuito(tareaActiva.solicitud.modelId)
                      ? 'Si dejas de seguir, el trabajo puede continuar en Magic Hour. Podrás reanudarlo desde aquí o desde «Mis vídeos».'
                      : 'Si dejas de seguir, la generación puede continuar en Pollinations. Podrás reanudarla desde aquí o desde «Mis vídeos»; la solicitud idéntica no se vuelve a facturar.'}
                  </p>
                )}
              </div>
            )}
          </Card>
        ) : resultado ? (
          <div className="flex flex-col gap-5">
            <Card>
              <h2 className="mb-3 text-base font-semibold" aria-live="polite">
                Tu vídeo está listo.
              </h2>
              <VideoPlayer
                src={resultado.videoUrl}
                titulo="Vídeo generado"
                aspecto={resultado.aspecto}
              />

              <div className="mt-4 rounded-xl2 bg-surface-2 p-4">
                <h3 className="mb-2 text-sm font-semibold">Detalles de la generación</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted">Modelo</dt>
                    <dd className="mt-0.5 font-medium">
                      {obtenerModelo(resultado.modelId)?.nombre}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Duración</dt>
                    <dd className="mt-0.5 font-medium">{formatSeconds(resultado.duracion)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Resolución</dt>
                    <dd className="mt-0.5 font-medium">{resultado.resolucion}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Formato</dt>
                    <dd className="mt-0.5 font-medium">{resultado.aspecto}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs text-muted">Fecha</dt>
                    <dd className="mt-0.5 font-medium">{formatFecha(resultado.fecha)}</dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-xs font-medium text-muted">Prompt</p>
                  <p className="mt-1 text-sm text-ink">
                    {promptExpandido ? resultado.prompt : truncate(resultado.prompt, 180)}
                  </p>
                  {resultado.prompt.length > 180 && (
                    <button
                      type="button"
                      onClick={() => setPromptExpandido((v) => !v)}
                      className="mt-1 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {promptExpandido ? 'Mostrar menos' : 'Mostrar más'}
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-base font-semibold">Descargar</h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <FieldLabel htmlFor="nombre-archivo">Nombre del archivo</FieldLabel>
                  <input
                    id="nombre-archivo"
                    type="text"
                    value={nombreArchivo}
                    onChange={(e) => setNombreArchivo(e.target.value)}
                    placeholder="mi-video"
                    className="w-full rounded-xl2 border border-line bg-bg p-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={descargar} loading={descargando} className="w-full sm:w-auto">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Descargar MP4
                  </Button>
                </div>
              </div>
              {errorDescarga && (
                <div className="mt-3">
                  <ErrorBanner titulo="No se pudo descargar" mensaje={errorDescarga} />
                </div>
              )}
              <p className="mt-3 text-xs text-muted">
                El enlace del almacenamiento caduca a los 30 días: descarga tu vídeo antes.
                {resultado.expiraEn && urlVigente(resultado.expiraEn) && (
                  <> Disponible hasta el {formatFecha(resultado.expiraEn)}.</>
                )}
                {resultado.expiraEn && !urlVigente(resultado.expiraEn) && (
                  <span className="font-medium text-danger"> El enlace parece haber caducado.</span>
                )}
              </p>
            </Card>
          </div>
        ) : (
          <Card className="flex min-h-[320px] flex-1 flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Film className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Tu vídeo aparecerá aquí</h2>
            <p className="mt-2 max-w-md text-sm text-muted">
              Configura los parámetros, escribe tu descripción y pulsa «Generar vídeo». La
              generación puede tardar varios minutos; puedes dejar de seguirla y reanudarla cuando
              quieras sin coste adicional.
            </p>
            {errorTarea && (
              <div className="mt-4 w-full max-w-md">
                <ErrorBanner titulo="La generación no se completó" mensaje={errorTarea} />
              </div>
            )}
          </Card>
        )}
      </div>

      {/* -------- Botón sticky en móvil -------- */}
      <div className="fixed inset-x-0 bottom-[76px] z-40 px-4 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Button
          onClick={abrirConfirmacion}
          disabled={!puedeGenerar}
          className="w-full py-4 text-base shadow-glow"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          Generar vídeo
        </Button>
      </div>

      {/* -------- Modal de confirmación -------- */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => (enviando ? undefined : setModalAbierto(false))}
        titulo="Confirmar generación"
        descripcion="Revisa los parámetros antes de enviar la solicitud al proveedor."
      >
        <dl className="grid grid-cols-2 gap-3 rounded-xl2 bg-surface-2 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Modelo</dt>
            <dd className="mt-0.5 font-medium">{modelo.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Duración</dt>
            <dd className="mt-0.5 font-medium">{formatSeconds(duracion)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Resolución</dt>
            <dd className="mt-0.5 font-medium">{resolucion}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Formato</dt>
            <dd className="mt-0.5 font-medium">{aspecto}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Audio</dt>
            <dd className="mt-0.5 font-medium">{audio ? 'Sí' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Imágenes de referencia</dt>
            <dd className="mt-0.5 font-medium">
              {maxImagenes === 0
                ? 'Solo texto a vídeo'
                : imagenes.length > 0
                  ? `${imagenes.length}`
                  : 'Ninguna'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted">Coste estimado</dt>
            <dd className="mt-0.5 font-medium">{coste.texto}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-xl2 bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          {esGratis ? (
            <>
              La generación puede tardar varios minutos. Puedes cerrar esta ventana o dejar de
              seguir el progreso: el seguimiento se reanuda desde «Mis vídeos» consultando el
              estado del trabajo. Si la generación falla, Magic Hour devuelve los créditos.
            </>
          ) : (
            <>
              La generación puede tardar varios minutos. Puedes cerrar esta ventana o dejar de
              seguir el progreso: la solicitud idéntica se puede reanudar desde «Mis vídeos» sin
              volver a facturar. Las peticiones fallidas no se facturan.
            </>
          )}
        </p>
        {errorEnvio && (
          <div className="mt-3">
            <ErrorBanner titulo="No se pudo iniciar la generación" mensaje={errorEnvio} />
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setModalAbierto(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmarGeneracion} loading={enviando}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Confirmar y generar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
