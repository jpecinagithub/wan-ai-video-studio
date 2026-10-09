import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { track } from '@vercel/analytics';
import {
  Check,
  Download,
  Film,
  Pencil,
  Play,
  RefreshCw,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react';
import { Button, Card, EmptyState, ErrorBanner, Loading } from '../components/ui';
import { VideoPlayer } from '../components/VideoPlayer';
import { urlVigente } from '../constants/capabilities';
import { MODELOS } from '../constants/models';
import { eliminarVideo, listarVideos } from '../utils/db';
import { descargarVideo } from '../utils/download';
import { cn, formatFecha, truncate } from '../utils/format';
import type { VideoRecord, VideoStatus } from '../types';

/** Clave donde se guarda el taskId remoto para retomar el seguimiento en el Estudio. */
const CLAVE_TAREA_PENDIENTE = 'wan-studio:tarea-pendiente';

/** Colores del badge de estado (tema oscuro + light). */
const COLORES_ESTADO: Record<VideoStatus, string> = {
  pendiente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  procesando: 'bg-accent-soft text-accent border-accent/30',
  completado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelado: 'bg-surface-2 text-muted border-line',
};

const ETIQUETA_ESTADO: Record<VideoStatus, string> = {
  pendiente: 'Pendiente',
  procesando: 'Procesando',
  completado: 'Completado',
  error: 'Error',
  cancelado: 'Cancelado',
};

function nombreModelo(id: VideoRecord['modelId']): string {
  return MODELOS.find((m) => m.id === id)?.nombre ?? id;
}

/**
 * Galería local de vídeos generados (el historial se limita a 20 registros
 * en la capa de datos). Los metadatos viven en el dispositivo; los enlaces
 * del proveedor caducan a las 24h.
 */
export function MisVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reproduciendoId, setReproduciendoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<{ id: string; mensaje: string } | null>(
    null,
  );
  const [nombresArchivo, setNombresArchivo] = useState<Record<string, string>>({});

  useEffect(() => {
    let activo = true;
    listarVideos()
      .then((lista) => {
        if (activo) setVideos(lista);
      })
      .catch(() => {
        if (activo) setError('No se pudo leer el historial de vídeos de este dispositivo.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const reutilizarPrompt = (v: VideoRecord) => {
    navigate('/', { state: { prompt: v.prompt } });
  };

  const nuevaVersion = (v: VideoRecord) => {
    navigate('/', {
      state: {
        prompt: v.prompt,
        modelId: v.modelId,
        duration: v.duracion,
        resolution: v.resolucion,
        aspectRatio: v.aspecto,
        audio: true,
      },
    });
  };

  const reanudarSeguimiento = (v: VideoRecord) => {
    if (!v.taskIdRemoto) return;
    try {
      window.localStorage.setItem(CLAVE_TAREA_PENDIENTE, v.taskIdRemoto);
    } catch {
      // Sin acceso a localStorage: se navega igualmente al Estudio.
    }
    navigate('/');
  };

  const confirmarEliminar = async (v: VideoRecord) => {
    try {
      await eliminarVideo(v.id);
      setVideos((prev) => prev.filter((x) => x.id !== v.id));
      setEliminandoId(null);
      if (reproduciendoId === v.id) setReproduciendoId(null);
    } catch {
      setError('No se pudo eliminar el registro. Inténtalo de nuevo.');
      setEliminandoId(null);
    }
  };

  const descargar = async (v: VideoRecord) => {
    if (!v.videoUrl) return;
    const nombre = (nombresArchivo[v.id] ?? v.nombre).trim() || v.nombre;
    const archivo = nombre.endsWith('.mp4') ? nombre : `${nombre}.mp4`;
    setDescargandoId(v.id);
    setErrorDescarga(null);
    try {
      await descargarVideo(v.videoUrl, archivo);
      // Solo telemetría del evento, nunca el prompt ni la URL.
      track('descarga', { modelo: v.modelId });
    } catch {
      setErrorDescarga({
        id: v.id,
        mensaje: 'No se pudo descargar el vídeo. El enlace puede haber caducado.',
      });
    } finally {
      setDescargandoId(null);
    }
  };

  if (cargando) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Mis vídeos</h1>
        <Loading texto="Cargando tu historial…" />
      </div>
    );
  }

  if (videos.length === 0 && !error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Mis vídeos</h1>
        <EmptyState
          icono={<Film className="h-7 w-7" aria-hidden="true" />}
          titulo="Aún no has generado ningún vídeo"
          descripcion="Cuando generes tu primer vídeo aparecerá aquí, con opciones para reproducirlo, descargarlo, reutilizar su prompt o eliminarlo del historial."
          accion={
            <Link to="/">
              <Button>Ir al Estudio</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">Mis vídeos</h1>
      <p className="mb-6 text-sm text-muted">
        {videos.length === 1
          ? 'Tienes 1 vídeo guardado en este dispositivo (máximo 20).'
          : `Tienes ${videos.length} vídeos guardados en este dispositivo (máximo 20).`}
      </p>

      {error && (
        <div className="mb-4">
          <ErrorBanner titulo="Algo falló" mensaje={error} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {videos.map((v) => {
          const vigente = Boolean(v.videoUrl) && urlVigente(v.expiraEn);
          const enlaceCaducado = Boolean(v.videoUrl) && !urlVigente(v.expiraEn);
          const reproduciendo = reproduciendoId === v.id;
          const confirmandoEliminar = eliminandoId === v.id;
          const descargando = descargandoId === v.id;
          const puedeReanudar =
            v.seguimientoDetenido &&
            (v.estado === 'pendiente' || v.estado === 'procesando') &&
            Boolean(v.taskIdRemoto);

          return (
            <Card key={v.id}>
              {/* Cabecera */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold" title={v.prompt}>
                    {truncate(v.prompt, 80)}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">{formatFecha(v.fecha)}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                    COLORES_ESTADO[v.estado],
                  )}
                >
                  {ETIQUETA_ESTADO[v.estado]}
                </span>
              </div>

              {/* Badges de parámetros */}
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Parámetros del vídeo">
                {[nombreModelo(v.modelId), `${v.duracion}s`, v.resolucion, v.aspecto].map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted"
                  >
                    {b}
                  </span>
                ))}
              </div>

              {/* Vigencia del enlace */}
              {vigente && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Enlace válido hasta {formatFecha(v.expiraEn as string)}.
                </p>
              )}
              {enlaceCaducado && (
                <p className="mt-3 text-xs text-amber-400" role="note">
                  El enlace del proveedor ha caducado (24h). Descarga tus vídeos antes de que
                  caduquen.
                </p>
              )}

              {/* Reproductor inline */}
              {reproduciendo && v.videoUrl && (
                <div className="mt-4 overflow-hidden rounded-xl border border-line">
                  <VideoPlayer src={v.videoUrl} titulo={v.nombre} aspecto={v.aspecto} />
                </div>
              )}

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {vigente && (
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    onClick={() => setReproduciendoId(reproduciendo ? null : v.id)}
                    aria-expanded={reproduciendo}
                    aria-label={reproduciendo ? 'Ocultar reproductor' : 'Reproducir vídeo'}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {reproduciendo ? 'Ocultar' : 'Reproducir'}
                  </Button>
                )}

                {vigente && (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <label htmlFor={`nombre-${v.id}`} className="sr-only">
                      Nombre del archivo a descargar
                    </label>
                    <input
                      id={`nombre-${v.id}`}
                      type="text"
                      value={nombresArchivo[v.id] ?? v.nombre}
                      onChange={(e) =>
                        setNombresArchivo((prev) => ({ ...prev, [v.id]: e.target.value }))
                      }
                      placeholder="Nombre del archivo"
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
                    />
                    <Button
                      className="min-h-[44px] shrink-0"
                      onClick={() => descargar(v)}
                      disabled={descargando}
                      aria-label={`Descargar vídeo "${v.nombre}"`}
                    >
                      {descargando ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />{' '}
                          Descargando…
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" aria-hidden="true" /> Descargar
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {puedeReanudar && (
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    onClick={() => reanudarSeguimiento(v)}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reanudar seguimiento
                  </Button>
                )}

                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => reutilizarPrompt(v)}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Reutilizar prompt
                </Button>

                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => nuevaVersion(v)}
                  aria-label="Crear una nueva versión con estos parámetros"
                >
                  <Repeat2 className="h-4 w-4" aria-hidden="true" /> Nueva versión
                </Button>

                {confirmandoEliminar ? (
                  <div
                    className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5"
                    role="alertdialog"
                    aria-label={`Confirmar eliminación de "${v.nombre}"`}
                  >
                    <span className="text-xs font-medium text-red-400">¿Eliminar?</span>
                    <button
                      type="button"
                      onClick={() => confirmarEliminar(v)}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-red-500 px-3 text-xs font-semibold text-white focus-visible:outline-2"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEliminandoId(null)}
                      aria-label="Cancelar eliminación"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:text-ink focus-visible:outline-2"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="min-h-[44px] text-muted hover:text-red-400"
                    onClick={() => setEliminandoId(v.id)}
                    aria-label={`Eliminar "${v.nombre}" del historial`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar
                  </Button>
                )}
              </div>

              {errorDescarga?.id === v.id && (
                <p className="mt-2 text-xs text-red-400" role="alert">
                  {errorDescarga.mensaje}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
