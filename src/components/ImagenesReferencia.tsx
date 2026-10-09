import { useRef, useState } from 'react';
import { ImagePlus, TextCursorInput, X } from 'lucide-react';
import { Button, Card, ErrorBanner } from './ui';
import { MAX_IMAGENES_REFERENCIA } from '../utils/imagenes';
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
  onInsertarEnPrompt: (etiqueta: string) => void;
  /** true mientras se comprimen imágenes. */
  procesando: boolean;
  error: string | null;
  deshabilitado?: boolean;
}

/**
 * Tarjeta de imágenes de referencia (opcional).
 * Hasta 10 fotos que el modelo usa como guía visual; en el prompt se
 * mencionan como "Image 1", "Image 2", ... (documentación oficial).
 */
export function ImagenesReferencia({
  imagenes,
  onAñadir,
  onEliminar,
  onInsertarEnPrompt,
  procesando,
  error,
  deshabilitado = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const lleno = imagenes.length >= MAX_IMAGENES_REFERENCIA;
  const inactivo = deshabilitado || procesando || lleno;

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
          {imagenes.length} / {MAX_IMAGENES_REFERENCIA} · opcional
        </span>
      </div>
      <p className="text-xs text-muted">
        Sube fotos de las personas que quieres que aparezcan y menciónalas en tu descripción como{' '}
        <span className="font-medium text-ink">«Image 1»</span>,{' '}
        <span className="font-medium text-ink">«Image 2»</span>, etc.
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
          {procesando
            ? 'Procesando imágenes…'
            : lleno
              ? `Máximo de ${MAX_IMAGENES_REFERENCIA} imágenes alcanzado`
              : 'Toca para elegir o arrastra fotos aquí'}
        </span>
        <span className="text-xs text-muted">JPG, PNG, WEBP o BMP · se comprimen en tu navegador</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
        multiple
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
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Imágenes de referencia añadidas">
          {imagenes.map((img, i) => {
            const etiqueta = `Image ${i + 1}`;
            return (
              <li
                key={img.id}
                className="group relative overflow-hidden rounded-xl2 border border-line bg-surface-2"
              >
                <img
                  src={img.dataUrl}
                  alt={`Foto de referencia ${i + 1}: ${img.nombre}`}
                  className="aspect-square w-full object-cover"
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
                <div className="p-1.5">
                  <Button
                    variant="ghost"
                    onClick={() => onInsertarEnPrompt(etiqueta)}
                    disabled={deshabilitado}
                    className="w-full !px-1 !py-1 text-[11px]"
                    aria-label={`Insertar ${etiqueta} en la descripción`}
                    title={`Añade "${etiqueta}" a tu descripción`}
                  >
                    <TextCursorInput className="h-3.5 w-3.5" aria-hidden="true" />
                    Usar en el prompt
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Las imágenes de referencia guían al modelo; el parecido con la persona es interpretativo, no
        una réplica exacta. Las imágenes no se guardan en el historial ni en la galería: consérvalas
        para reutilizarlas.
      </p>
    </Card>
  );
}
