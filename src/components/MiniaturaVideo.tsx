import { Film } from 'lucide-react';
import type { AspectRatio } from '../types';
import { cn } from '../utils/format';

const CLASE_ASPECTO: Record<AspectRatio, string> = {
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
  '21:9': 'aspect-[21/9]',
  auto: 'aspect-video',
};

interface MiniaturaVideoProps {
  /** Póster JPEG guardado al completarse (sobrevive a la caducidad de la URL). */
  poster?: string;
  videoUrl?: string;
  /** true si la URL temporal del proveedor sigue siendo válida. */
  urlVigente: boolean;
  aspecto: AspectRatio;
  /** Texto alternativo descriptivo. */
  alt: string;
}

/**
 * Miniatura de la tarjeta de galería, con degradado robusto:
 * póster guardado > vídeo en vivo (muestra el primer fotograma) > icono.
 */
export function MiniaturaVideo({
  poster,
  videoUrl,
  urlVigente,
  aspecto,
  alt,
}: MiniaturaVideoProps) {
  const base =
    'w-full overflow-hidden rounded-xl border border-line bg-surface-2 object-cover';
  const claseAspecto = CLASE_ASPECTO[aspecto] ?? 'aspect-video';

  if (poster) {
    return <img src={poster} alt={alt} loading="lazy" className={cn(base, claseAspecto)} />;
  }

  if (urlVigente && videoUrl) {
    return (
      <video
        src={videoUrl}
        preload="metadata"
        muted
        playsInline
        aria-label={alt}
        className={cn(base, claseAspecto)}
      />
    );
  }

  return (
    <div
      className={cn(base, claseAspecto, 'flex items-center justify-center')}
      role="img"
      aria-label={alt}
    >
      <Film className="h-8 w-8 text-muted" aria-hidden="true" />
    </div>
  );
}
