import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Card, ErrorBanner } from './ui';
import { cn } from '../utils/format';

export interface ImagenReferenciaItem {
  id: string;
  dataUrl: string;
  nombre: string;
}

interface Props {
  imagenes: ImagenReferenciaItem[];
  onAñadir: (archivos: File[]) => void;
  onEliminar: (id: string) => void;
  /** Máximo permitido por el modelo activo (1 = solo inicial, 2 = inicial + final). */
  maxImagenes: number;
  /** true mientras se comprimen imágenes. */
  procesando: boolean;
  /** true mientras se suben al almacenamiento del proveedor. */
  subiendo?: boolean;
  error: string | null;
  deshabilitado?: boolean;
}

function etiquetaRol(indice: number, maxImagenes: number): string {
  if (indice === 0) return 'Fotograma inicial';
  return maxImagenes > 1 ? 'Fotograma final' : `Imagen ${indice + 1}`;
}

/**
 * Tarjeta de imágenes de referencia (opcional).
 * La primera imagen es el fotograma inicial del vídeo; la segunda
 * (solo en Veo 3.1) es el fotograma final. Se suben al almacenamiento
 * del proveedor antes de generar.
 */
export function ImagenesReferencia({
  imagenes,
  onAñadir,
  onEliminar,
  maxImagenes,
  procesando,
  subiendo = false,
  error,
  deshabilitado = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const lleno = imagenes.length >= maxImagenes;
  const ocupado = procesando || subiendo;
  const inactivo = deshabilitado || ocupado || lleno;

  const manejarArchivos = (lista: FileList | null) => {
    if (!lista || inactivo) return;
    onAñadir(Array.from(lista));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold">Imágenes de referencia</h2>
        <span className="text-xs text-muted">
          {imagenes.length} / {maxImagenes} · opcional
        </span>
      </div>
      <p className="text-xs text-muted">
        La primera imagen será el <span className="font-medium text-ink">fotograma inicial</span>{' '}
        del vídeo
        {maxImagenes > 1 && (
          <>
            {' '}
            y la segunda el <span className="font-medium text-ink">fotograma final</span> (opcional)
          </>
        )}
        .
      </p>

      {/* Zona de subida */}
      <button
        type="button"
        disabled={inactivo}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!inactivo) setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          manejarArchivos(e.dataTransfer.files);
        }}
        className={cn(
          'mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed p-5 text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          arrastrando
            ? 'border-accent bg-accent-soft'
            : 'border-line bg-surface-2 hover:border-muted',
          inactivo && 'cursor-not-allowed opacity-50',
        )}
        aria-label="Añadir imágenes de referencia"
      >
        <ImagePlus className="h-7 w-7 text-accent" aria-hidden="true" />
        <span className="text-sm font-medium">
          {ocupado
            ? subiendo
              ? 'Subiendo imágenes…'
              : 'Procesando imágenes…'
            : lleno
              ? `Máximo de ${maxImagenes} ${maxImagenes === 1 ? 'imagen alcanzado' : 'imágenes alcanzado'}`
              : 'Toca para elegir o arrastra fotos aquí'}
        </span>
        <span className="text-xs text-muted">JPG, PNG, WEBP o BMP · se comprimen en tu navegador</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
        multiple={maxImagenes > 1}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => manejarArchivos(e.target.files)}
      />

      {error && (
        <div className="mt-3">
          <ErrorBanner titulo="No se pudo añadir la imagen" mensaje={error} />
        </div>
      )}

      {/* Miniaturas */}
      {imagenes.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3" aria-label="Imágenes de referencia añadidas">
          {imagenes.map((img, i) => {
            const etiqueta = etiquetaRol(i, maxImagenes);
            return (
              <li
                key={img.id}
                className="group relative overflow-hidden rounded-xl2 border border-line bg-surface-2"
              >
                <img
                  src={img.dataUrl}
                  alt={`${etiqueta}: ${img.nombre}`}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {etiqueta}
                </span>
                <button
                  type="button"
                  onClick={() => onEliminar(img.id)}
                  aria-label={`Eliminar ${etiqueta}`}
                  disabled={deshabilitado}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white transition-colors hover:bg-danger focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Las imágenes guían al modelo; el parecido es interpretativo, no una réplica exacta. No se
        guardan en el historial ni en la galería: consérvalas para reutilizarlas.
      </p>
    </Card>
  );
}
