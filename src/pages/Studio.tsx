import { useCallback, useMemo, useRef, useState } from 'react';
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
import { CuotaModelo } from '../components/CuotaModelo';
import { ImagenesReferencia, type ImagenReferenciaItem } from '../components/ImagenesReferencia';
import { VideoPlayer } from '../components/VideoPlayer';
import {
  CAPACIDADES,
  esCombinacionValida,
  estimarCoste,
  motivoIncompatibilidad,
  urlVigente,
} from '../constants/capabilities';
import { MODELOS, MODELO_POR_DEFECTO, textoPrecioModelo } from '../constants/models';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useQuota } from '../hooks/useQuota';
import { useTaskPolling } from '../hooks/useTaskPolling';
import { api, ApiClientError } from '../services/api';
import type {
  AspectRatio,
  ModelId,
  Resolution,
  TaskStatusResponse,
  VideoStatus,
} from '../types';
import { cn, formatFecha, formatSeconds, newRequestId, truncate } from '../utils/format';
import { formatearFechaCorta } from '../utils/quota';
import { ErrorImagen, MAX_IMAGENES_REFERENCIA, comprimirImagen } from '../utils/imagenes';
import { guardarVideo, obtenerVideo } from '../utils/db';
import { descargarVideo } from '../utils/download';

const TAREA_PENDIENTE_KEY = 'wan-studio:tarea-pendiente';
const CLAVE_HISTORIAL = 'wan-studio-historial-prompts';
const MAX_HISTORIAL = 10;
const UMBRAL_MENSAJE_LARGO_S = 120;

interface ParametrosTarea {
  prompt: string;
  modelId: ModelId;
  duration: number;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  audio: boolean;
}

interface TareaPendienteGuardada {
  taskId: string;
  params: ParametrosTarea;
  startedAt: string;
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

function leerTareaPendiente(): TareaPendienteGuardada | null {
  try {
    const crudo = window.localStorage.getItem(TAREA_PENDIENTE_KEY);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as TareaPendienteGuardada;
    return datos?.taskId ? datos : null;
  } catch {
    return null;
  }
}

function nombreSugerido(): string {
  const f = new Date();
  const relleno = (n: number) => n.toString().padStart(2, '0');
  return `wan-video-${f.getFullYear()}${relleno(f.getMonth() + 1)}${relleno(f.getDate())}-${relleno(f.getHours())}${relleno(f.getMinutes())}`;
}

/**
 * Pantalla principal: el estudio.
 * Configurar → confirmar → generar → seguir la tarea → reproducir → descargar.
 */
export function Studio() {
  const location = useLocation();
  const promptInicial = (location.state as { prompt?: string } | null)?.prompt ?? '';

  /* ---------- Configuración ---------- */
  const [prompt, setPrompt] = useState(promptInicial);
  const [modelId, setModelId] = useState<ModelId>(MODELO_POR_DEFECTO);
  const [duracion, setDuracion] = useState<number>(CAPACIDADES.duracion.defecto);
  const [resolucion, setResolucion] = useState<Resolution>('720p');
  const [aspecto, setAspecto] = useState<AspectRatio>('16:9');
  const [audio, setAudio] = useState(true);
  const [mostrarAvanzadas, setMostrarAvanzadas] = useState(false);
  const [semilla, setSemilla] = useState('');
  const [mejoraPrompt, setMejoraPrompt] = useState(true);
  const [marcaAgua, setMarcaAgua] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [imagenes, setImagenes] = useState<ImagenReferenciaItem[]>([]);
  const [errorImagenes, setErrorImagenes] = useState<string | null>(null);
  const [procesandoImagenes, setProcesandoImagenes] = useState(false);

  /* ---------- Estado de flujo ---------- */
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [tareaActiva, setTareaActiva] = useState<TareaPendienteGuardada | null>(leerTareaPendiente);
  const [errorTarea, setErrorTarea] = useState<string | null>(null);
  const [panelColapsado, setPanelColapsado] = useState(false);
  const [resultado, setResultado] = useState<VideoCompletado | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [promptExpandido, setPromptExpandido] = useState(false);

  const [historial, setHistorial] = useLocalStorage<string[]>(CLAVE_HISTORIAL, []);

  /* Contador local de cuota gratuita (se decrementa solo ante éxitos). */
  const { infoCuota, registrarExito, ajustarCuota } = useQuota();

  const tareaActivaRef = useRef(tareaActiva);
  tareaActivaRef.current = tareaActiva;

  const parametros = useMemo(
    () => ({ modelId, duration: duracion, resolution: resolucion, aspectRatio: aspecto, audio }),
    [modelId, duracion, resolucion, aspecto, audio],
  );
  const motivo = motivoIncompatibilidad(parametros);
  const valida = esCombinacionValida(parametros);
  const coste = estimarCoste(parametros);
  const modelo = MODELOS.find((m) => m.id === modelId);
  const cuotaModal = infoCuota(modelId);
  const puedeGenerar = prompt.trim().length > 0 && valida && !enviando && !tareaActiva;

  /* ---------- Actualizaciones del polling ---------- */
  const manejarActualizacion = useCallback(async (resp: TaskStatusResponse) => {
    const pendiente = tareaActivaRef.current;
    if (!pendiente || resp.taskId !== pendiente.taskId) return;

    const registro = await obtenerVideo(pendiente.taskId).catch(() => undefined);

    if (resp.estado === 'completado' && resp.videoUrl) {
      const video: VideoCompletado = {
        videoUrl: resp.videoUrl,
        expiraEn: resp.expiraEn,
        modelId: pendiente.params.modelId,
        duracion: resp.metadatos?.duracion ?? pendiente.params.duration,
        resolucion: resp.metadatos?.resolucion ?? pendiente.params.resolution,
        aspecto: resp.metadatos?.aspecto ?? pendiente.params.aspectRatio,
        fecha: pendiente.startedAt,
        prompt: pendiente.params.prompt,
      };
      if (registro) {
        await guardarVideo({
          ...registro,
          estado: 'completado' satisfies VideoStatus,
          videoUrl: resp.videoUrl,
          expiraEn: resp.expiraEn,
          seguimientoDetenido: false,
        }).catch(() => undefined);
      }
      track('generacion_completada', {
        modelo: pendiente.params.modelId,
        duracion: pendiente.params.duration,
      });
      registrarExito(pendiente.params.modelId);
      setResultado(video);
      setNombreArchivo(nombreSugerido());
      setTareaActiva(null);
      setErrorTarea(null);
      try {
        window.localStorage.removeItem(TAREA_PENDIENTE_KEY);
      } catch {
        /* sin almacenamiento: no es crítico */
      }
    } else if (resp.estado === 'error' || resp.estado === 'cancelado') {
      if (registro) {
        await guardarVideo({ ...registro, estado: resp.estado }).catch(() => undefined);
      }
      track('error', { codigo: 'GENERACION_FALLIDA' });
      setErrorTarea(
        resp.error ?? resp.mensaje ?? 'La generación no pudo completarse. Inténtalo de nuevo.',
      );
      setTareaActiva(null);
      try {
        window.localStorage.removeItem(TAREA_PENDIENTE_KEY);
      } catch {
        /* sin almacenamiento: no es crítico */
      }
    } else if (registro && registro.estado !== resp.estado) {
      await guardarVideo({ ...registro, estado: resp.estado }).catch(() => undefined);
    }
  }, [registrarExito]);

  const { error: errorPolling, elapsedSegundos, detener, reanudar, siguiendo } = useTaskPolling(
    tareaActiva?.taskId ?? null,
    manejarActualizacion,
  );

  /* ---------- Acciones ---------- */
  const seleccionarModelo = (id: ModelId) => {
    setModelId(id);
    track('seleccion_modelo', { modelo: id });
  };

  /* ---------- Imágenes de referencia ---------- */
  const añadirImagenes = async (archivos: File[]) => {
    if (archivos.length === 0 || procesandoImagenes) return;
    setErrorImagenes(null);
    const hueco = MAX_IMAGENES_REFERENCIA - imagenes.length;
    if (hueco <= 0) {
      setErrorImagenes(`El máximo es ${MAX_IMAGENES_REFERENCIA} imágenes de referencia.`);
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
      setImagenes((prev) => [...prev, ...comprimidas].slice(0, MAX_IMAGENES_REFERENCIA));
      if (archivos.length > hueco) {
        setErrorImagenes(
          `Se añadieron ${hueco} de ${archivos.length}: el máximo es ${MAX_IMAGENES_REFERENCIA} imágenes.`,
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

  const insertarEtiquetaEnPrompt = (etiqueta: string) => {
    setPrompt((prev) => {
      const base = prev.trimEnd();
      if (base.endsWith(etiqueta)) return prev;
      const separador = base.length === 0 ? '' : ' ';
      return `${base}${separador}${etiqueta}`;
    });
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

    const semillaNum = semilla.trim() === '' ? undefined : Math.floor(Number(semilla));
    const params: ParametrosTarea = {
      prompt: prompt.trim(),
      modelId,
      duration: duracion,
      resolution: resolucion,
      aspectRatio: aspecto,
      audio,
    };

    try {
      const respuesta = await api.generarVideo({
        ...params,
        seed:
          semillaNum === undefined || Number.isNaN(semillaNum) || semillaNum < 0
            ? undefined
            : semillaNum,
        enhancePrompt: mejoraPrompt || undefined,
        watermark: marcaAgua || undefined,
        clientRequestId: newRequestId(),
        media:
          imagenes.length > 0
            ? imagenes.map((img) => ({ type: 'reference_image' as const, url: img.dataUrl }))
            : undefined,
      });
      const startedAt = new Date().toISOString();
      const pendiente: TareaPendienteGuardada = { taskId: respuesta.taskId, params, startedAt };
      try {
        window.localStorage.setItem(TAREA_PENDIENTE_KEY, JSON.stringify(pendiente));
      } catch {
        /* sin almacenamiento: la tarea se sigue en memoria */
      }
      setTareaActiva(pendiente);
      setResultado(null);
      setErrorTarea(null);
      setPanelColapsado(false);
      await guardarVideo({
        id: respuesta.taskId,
        fecha: startedAt,
        prompt: params.prompt,
        modelId: params.modelId,
        duracion: params.duration,
        resolucion: params.resolution,
        aspecto: params.aspectRatio,
        estado: 'pendiente',
        nombre: nombreSugerido(),
        taskIdRemoto: respuesta.taskId,
      }).catch(() => undefined);
      track('generacion_iniciada', { modelo: modelId, duracion, resolucion });
      guardarEnHistorial(params.prompt);
      setModalAbierto(false);
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
      const registro = await obtenerVideo(pendiente.taskId).catch(() => undefined);
      if (registro) {
        await guardarVideo({ ...registro, seguimientoDetenido: true }).catch(() => undefined);
      }
    }
  };

  const reanudarSeguimiento = async () => {
    const pendiente = tareaActivaRef.current;
    if (pendiente) {
      const registro = await obtenerVideo(pendiente.taskId).catch(() => undefined);
      if (registro) {
        await guardarVideo({ ...registro, seguimientoDetenido: false }).catch(() => undefined);
      }
    }
    reanudar();
  };

  const descargar = async () => {
    if (!resultado || descargando) return;
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await descargarVideo(resultado.videoUrl, nombreArchivo.trim() || 'video');
      track('descarga', { modelo: resultado.modelId });
    } catch (err) {
      setErrorDescarga(
        err instanceof Error ? err.message : 'No se pudo descargar el vídeo.',
      );
    } finally {
      setDescargando(false);
    }
  };

  const mensajeRotativo =
    elapsedSegundos >= UMBRAL_MENSAJE_LARGO_S
      ? 'Tu generación continúa procesándose.'
      : 'Estamos creando tu vídeo.';

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
            Describe la escena que imaginas y los modelos Wan 3.0 de Alibaba Cloud la convertirán en
            vídeo. Sin tecnicismos: escribe, configura y genera.
          </p>
        </div>

        {/* Modelo */}
        <Card>
          <h2 className="mb-3 text-base font-semibold">Modelo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODELOS.map((m) => {
              const activo = m.id === modelId;
              const cuota = infoCuota(m.id);
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col rounded-xl2 border transition-all',
                    activo
                      ? 'border-accent bg-accent-soft shadow-glow'
                      : 'border-line bg-surface-2',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => seleccionarModelo(m.id)}
                    aria-pressed={activo}
                    className="block w-full flex-1 rounded-t-xl2 p-4 pb-3 text-left transition-colors hover:bg-surface-2/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{m.nombre}</p>
                      {activo && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
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
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-muted">{textoPrecioModelo(m)}</p>
                  </button>
                  <div className="border-t border-line/70 px-4 py-3">
                    <CuotaModelo
                      restantes={cuota.restantes}
                      total={cuota.total}
                      expiraISO={cuota.expiraISO}
                      caducada={cuota.caducada}
                      onAjustar={(valor) => ajustarCuota(m.id, valor)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Imágenes de referencia */}
        <ImagenesReferencia
          imagenes={imagenes}
          onAñadir={añadirImagenes}
          onEliminar={eliminarImagen}
          onInsertarEnPrompt={insertarEtiquetaEnPrompt}
          procesando={procesandoImagenes}
          error={errorImagenes}
          deshabilitado={enviando || !!tareaActiva}
        />

        {/* Prompt */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel htmlFor="prompt">Describe tu vídeo</FieldLabel>
            <span className="text-xs text-muted" aria-live="polite">
              {prompt.length} / {CAPACIDADES.prompt.maxCaracteres}
            </span>
          </div>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, CAPACIDADES.prompt.maxCaracteres))}
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
            <FieldLabel htmlFor="duracion">Duración</FieldLabel>
            <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent">
              {formatSeconds(duracion)}
            </span>
          </div>
          <input
            id="duracion"
            type="range"
            min={CAPACIDADES.duracion.min}
            max={CAPACIDADES.duracion.max}
            step={CAPACIDADES.duracion.paso}
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value))}
            className="w-full accent-[#8b5cf6]"
            aria-valuetext={`${duracion} segundos`}
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{CAPACIDADES.duracion.min}s</span>
            <span>{CAPACIDADES.duracion.max}s</span>
          </div>
        </Card>

        {/* Resolución */}
        <Card>
          <h2 className="mb-3 text-base font-semibold">Resolución</h2>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Resolución">
            {CAPACIDADES.resoluciones.map((r) => {
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
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-7"
            role="radiogroup"
            aria-label="Relación de aspecto"
          >
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
              <Toggle
                id="mejora"
                label="Mejora automática del prompt"
                descripcion={CAPACIDADES.avanzadas.mejoraPrompt.descripcion}
                checked={mejoraPrompt}
                onChange={setMejoraPrompt}
              />
              <Toggle
                id="marca"
                label="Marca de agua"
                descripcion={CAPACIDADES.avanzadas.marcaAgua.descripcion}
                checked={marcaAgua}
                onChange={setMarcaAgua}
              />
            </div>
          )}
        </Card>

        {/* Coste estimado */}
        <Card>
          <h2 className="mb-2 text-base font-semibold">Coste estimado</h2>
          {cuotaModal.restantes > 0 && !cuotaModal.caducada ? (
            <>
              <p className="text-lg font-bold text-success">Gratis</p>
              <p className="mt-1 text-xs text-muted">
                Cuota gratuita: {cuotaModal.restantes} de {cuotaModal.total} restantes · Válida
                hasta el {formatearFechaCorta(cuotaModal.expiraISO)}
              </p>
              <p className="mt-1 text-xs text-muted/70">Sin cuota gratuita: {coste.texto}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{coste.texto}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Modelo: {modelo?.nombre} · {formatSeconds(duracion)} · {resolucion}
          </p>
        </Card>

        {/* Generar */}
        {motivo && <ErrorBanner titulo="Combinación no válida" mensaje={motivo} />}
        {errorEnvio && <ErrorBanner titulo="No se pudo iniciar la generación" mensaje={errorEnvio} />}
        {tareaActiva && (
          <p className="rounded-xl2 border border-line bg-surface-2 p-3 text-center text-xs text-muted">
            Ya hay una generación en curso. Puedes dejar de seguirla desde el panel de la derecha
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
          Al generar aceptas que la solicitud se procese en Alibaba Cloud Model Studio.
        </p>
      </div>

      {/* -------- Panel de visualización -------- */}
      <div className="flex flex-col gap-5">
        {tareaActiva ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Generación en curso</h2>
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
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-3 rounded-xl2 bg-surface-2 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted">Modelo</dt>
                    <dd className="mt-0.5 font-medium">
                      {MODELOS.find((m) => m.id === tareaActiva.params.modelId)?.nombre}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Resolución</dt>
                    <dd className="mt-0.5 font-medium">{tareaActiva.params.resolution}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Duración</dt>
                    <dd className="mt-0.5 font-medium">
                      {formatSeconds(tareaActiva.params.duration)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Estado</dt>
                    <dd className="mt-0.5 font-medium">
                      {siguiendo ? 'Siguiendo' : 'Seguimiento detenido'}
                    </dd>
                  </div>
                </dl>

                {errorPolling && (
                  <p className="mt-3 rounded-xl2 border border-line bg-surface-2 p-3 text-xs text-muted" role="status">
                    {errorPolling} Reintentando automáticamente…
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {siguiendo ? (
                    <Button variant="secondary" onClick={dejarDeSeguir}>
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                      Dejar de seguir
                    </Button>
                  ) : (
                    <Button onClick={reanudarSeguimiento}>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Reanudar seguimiento
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Si dejas de seguir, la tarea puede continuar procesándose en Alibaba Cloud. Podrás
                  reanudar el seguimiento cuando quieras; la aplicación sigue siendo usable mientras
                  tanto.
                </p>
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
                      {MODELOS.find((m) => m.id === resultado.modelId)?.nombre}
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
                El enlace del proveedor caduca a las 24 horas: descarga tu vídeo antes.
                {resultado.expiraEn && urlVigente(resultado.expiraEn) && (
                  <> Disponible hasta el {formatFecha(resultado.expiraEn)}.</>
                )}
                {resultado.expiraEn && !urlVigente(resultado.expiraEn) && (
                  <span className="font-medium text-danger">
                    {' '}El enlace parece haber caducado.
                  </span>
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
              Configura los parámetros, escribe tu descripción y pulsa «Generar vídeo». Mientras se
              procesa podrás seguir usando la aplicación con total normalidad.
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
            <dd className="mt-0.5 font-medium">{modelo?.nombre}</dd>
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
              {imagenes.length > 0 ? `${imagenes.length}` : 'Ninguna'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Coste estimado</dt>
            <dd className="mt-0.5 font-medium">
              {cuotaModal.restantes > 0 && !cuotaModal.caducada ? (
                <>
                  Gratis <span className="font-normal text-muted">(cuota gratuita)</span>
                </>
              ) : (
                coste.texto
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded-xl2 bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          Cuota gratuita de este modelo: {cuotaModal.restantes} de {cuotaModal.total} restantes{' '}
          <span className="text-muted/70">(contador local)</span>. Tras esta generación te quedarán{' '}
          {Math.max(0, cuotaModal.restantes - 1)} de {cuotaModal.total} gratuitas en este modelo.
          {cuotaModal.caducada && (
            <> La cuota gratuita caducó el {formatearFechaCorta(cuotaModal.expiraISO)}.</>
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
