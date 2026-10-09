import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { cn } from '../utils/format';

/* ---------------- Botón ---------------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl2 px-5 py-2.5 text-sm font-semibold transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-accent text-white shadow-glow hover:bg-accent-strong active:scale-[0.98]',
        variant === 'secondary' && 'bg-surface-2 text-ink hover:bg-line active:scale-[0.98]',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-danger/15 text-danger hover:bg-danger/25',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------------- Tarjeta ---------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl2 border border-line bg-surface p-5 shadow-soft', className)}>
      {children}
    </section>
  );
}

/* ---------------- Etiqueta de campo ---------------- */

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-ink">
      {children}
    </label>
  );
}

/* ---------------- Interruptor ---------------- */

export function Toggle({
  checked,
  onChange,
  label,
  descripcion,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descripcion?: string;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {descripcion && <p className="text-xs text-muted">{descripcion}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </button>
    </div>
  );
}

/* ---------------- Aviso de error ---------------- */

export function ErrorBanner({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl2 border border-danger/40 bg-danger/10 p-4">
      <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-ink">{titulo}</p>
        <p className="mt-1 text-sm text-muted">{mensaje}</p>
      </div>
    </div>
  );
}

/* ---------------- Estado vacío ---------------- */

export function EmptyState({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: ReactNode;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl2 border border-dashed border-line bg-surface px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        {icono}
      </div>
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">{descripcion}</p>
      {accion && <div className="mt-6">{accion}</div>}
    </div>
  );
}

/* ---------------- Cargando ---------------- */

export function Loading({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      <p className="text-sm">{texto}</p>
    </div>
  );
}

/* ---------------- Modal ---------------- */

interface ModalProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  etiquetaCerrar?: string;
}

/**
 * Diálogo modal accesible: role="dialog", Escape para cerrar,
 * foco inicial en el primer botón y trampa de foco simple.
 */
export function Modal({ abierto, alCerrar, titulo, descripcion, children, etiquetaCerrar = 'Cerrar' }: ModalProps) {
  const dialogoRef = useRef<HTMLDivElement>(null);
  const ultimoFocoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    ultimoFocoRef.current = document.activeElement as HTMLElement | null;
    const dialogo = dialogoRef.current;

    const primerBoton = dialogo?.querySelector<HTMLElement>('button');
    (primerBoton ?? dialogo)?.focus();

    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        alCerrar();
        return;
      }
      if (e.key !== 'Tab' || !dialogo) return;
      const enfocables = dialogo.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPulsarTecla, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPulsarTecla, true);
      document.body.style.overflow = '';
      ultimoFocoRef.current?.focus();
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 shadow-soft outline-none sm:max-w-lg sm:rounded-xl2"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
            {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label={etiquetaCerrar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
