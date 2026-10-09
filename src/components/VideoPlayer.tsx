import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { AspectRatio } from '../types';
import { cn, formatSeconds } from '../utils/format';

const ASPECTO_CSS: Record<AspectRatio, string> = {
  '16:9': '16 / 9',
  '21:9': '21 / 9',
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '3:4': '3 / 4',
  auto: '16 / 9',
};

interface VideoPlayerProps {
  src: string;
  titulo?: string;
  aspecto?: AspectRatio;
}

function BotonControl({
  onClick,
  etiqueta,
  children,
  activo,
}: {
  onClick: () => void;
  etiqueta: string;
  children: React.ReactNode;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

/**
 * Reproductor de vídeo con controles propios accesibles.
 * Incluye un conmutador a los controles nativos del navegador.
 */
export function VideoPlayer({ src, titulo = 'Vídeo generado', aspecto = '16:9' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);

  const [reproduciendo, setReproduciendo] = useState(false);
  const [actual, setActual] = useState(0);
  const [duracionTotal, setDuracionTotal] = useState(0);
  const [volumen, setVolumen] = useState(1);
  const [silenciado, setSilenciado] = useState(false);
  const [repetir, setRepetir] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [controlesNativos, setControlesNativos] = useState(false);

  const alternarReproduccion = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const buscar = useCallback(
    (clienteX: number) => {
      const barra = barraRef.current;
      const v = videoRef.current;
      if (!barra || !v || !duracionTotal) return;
      const rect = barra.getBoundingClientRect();
      const proporcion = Math.min(1, Math.max(0, (clienteX - rect.left) / rect.width));
      v.currentTime = proporcion * duracionTotal;
    },
    [duracionTotal],
  );

  const manejarTeclaBarra = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    if (e.key === 'ArrowRight') v.currentTime = Math.min(duracionTotal, v.currentTime + 5);
    else if (e.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5);
    else if (e.key === 'Home') v.currentTime = 0;
    else if (e.key === 'End') v.currentTime = duracionTotal;
    else return;
    e.preventDefault();
  };

  const alternarPantallaCompleta = useCallback(() => {
    const c = contenedorRef.current;
    if (!c) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void c.requestFullscreen();
  }, []);

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const progreso = duracionTotal > 0 ? (actual / duracionTotal) * 100 : 0;

  return (
    <div
      ref={contenedorRef}
      className="overflow-hidden rounded-xl2 bg-black shadow-soft"
      style={{ aspectRatio: ASPECTO_CSS[aspecto] }}
    >
      <div className="relative flex h-full w-full flex-col">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          title={titulo}
          controls={controlesNativos}
          loop={repetir}
          muted={silenciado}
          playsInline
          preload="metadata"
          className="h-full w-full bg-black object-contain"
          onPlay={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          onTimeUpdate={(e) => setActual(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuracionTotal(e.currentTarget.duration || 0)}
          onVolumeChange={(e) => {
            setVolumen(e.currentTarget.volume);
            setSilenciado(e.currentTarget.muted);
          }}
        />

        {!controlesNativos && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-8">
            {/* Barra de progreso */}
            <div
              ref={barraRef}
              role="slider"
              tabIndex={0}
              aria-label="Posición de reproducción"
              aria-valuemin={0}
              aria-valuemax={Math.round(duracionTotal)}
              aria-valuenow={Math.round(actual)}
              aria-valuetext={`${formatSeconds(actual)} de ${formatSeconds(duracionTotal)}`}
              onClick={(e) => buscar(e.clientX)}
              onKeyDown={manejarTeclaBarra}
              className="group/barra flex h-6 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/barra:h-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${progreso}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <BotonControl
                onClick={alternarReproduccion}
                etiqueta={reproduciendo ? 'Pausar' : 'Reproducir'}
              >
                {reproduciendo ? (
                  <Pause className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Play className="h-5 w-5" aria-hidden="true" />
                )}
              </BotonControl>

              <span className="mx-1 select-none text-xs tabular-nums text-white/85" aria-live="off">
                {formatSeconds(actual)} / {formatSeconds(duracionTotal)}
              </span>

              <BotonControl
                onClick={() => {
                  const v = videoRef.current;
                  if (v) v.muted = !v.muted;
                }}
                etiqueta={silenciado ? 'Activar sonido' : 'Silenciar'}
              >
                {silenciado || volumen === 0 ? (
                  <VolumeX className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-5 w-5" aria-hidden="true" />
                )}
              </BotonControl>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={silenciado ? 0 : volumen}
                aria-label="Volumen"
                onChange={(e) => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.volume = Number(e.target.value);
                  v.muted = false;
                }}
                className="hidden h-1.5 w-20 cursor-pointer accent-white sm:block"
              />

              <div className="flex-1" />

              <BotonControl
                onClick={() => setRepetir((r) => !r)}
                etiqueta={repetir ? 'Desactivar repetición' : 'Repetir vídeo'}
                activo={repetir}
              >
                <Repeat
                  className={cn('h-5 w-5', repetir ? 'text-accent' : 'text-white/90')}
                  aria-hidden="true"
                />
              </BotonControl>

              <BotonControl
                onClick={alternarPantallaCompleta}
                etiqueta={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {pantallaCompleta ? (
                  <Minimize className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Maximize className="h-5 w-5" aria-hidden="true" />
                )}
              </BotonControl>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setControlesNativos((c) => !c)}
          aria-pressed={controlesNativos}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          {controlesNativos ? 'Controles propios' : 'Controles nativos'}
        </button>
      </div>
    </div>
  );
}
