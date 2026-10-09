import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from './ui.js';
import { cn } from '../utils/format.js';
import { formatearFechaCorta } from '../utils/quota.js';

interface CuotaModeloProps {
  restantes: number;
  total: number;
  expiraISO: string;
  caducada: boolean;
  onAjustar: (valor: number) => void;
}

/**
 * Bloque "Cuota gratuita" de la tarjeta de modelo: X de 30 restantes,
 * barra de progreso, fecha de validez y ajuste manual del contador local.
 */
export function CuotaModelo({ restantes, total, expiraISO, caducada, onAjustar }: CuotaModeloProps) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');

  const porcentaje = total > 0 ? Math.round((restantes / total) * 100) : 0;
  const fecha = formatearFechaCorta(expiraISO);
  const agotada = !caducada && restantes === 0;

  const empezarEdicion = () => {
    setValor(String(restantes));
    setEditando(true);
  };

  const guardar = () => {
    const n = Math.floor(Number(valor));
    if (!Number.isNaN(n)) onAjustar(n);
    setEditando(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cuota gratuita</p>
        {!editando && (
          <button
            type="button"
            onClick={empezarEdicion}
            title="Contador local: ajústalo si generas vídeos fuera de esta app"
            aria-label="Ajustar contador de cuota gratuita"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {editando ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={total}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-label="Generaciones gratuitas restantes"
            className="w-24 rounded-xl2 border border-line bg-bg p-2 text-sm text-ink focus:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          />
          <Button variant="secondary" onClick={guardar} className="min-h-[40px] px-4 py-2">
            Guardar
          </Button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="rounded-lg px-2 py-2 text-xs font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-bg"
            role="progressbar"
            aria-valuenow={restantes}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Cuota gratuita restante"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                caducada || agotada ? 'bg-muted' : 'bg-accent',
              )}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {caducada ? (
              <>Cuota gratuita caducada el {fecha}.</>
            ) : agotada ? (
              <>Cuota gratuita agotada.</>
            ) : (
              <>
                {restantes} de {total} restantes · Válida hasta el {fecha}.
              </>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted/70">Contador local</p>
        </>
      )}
    </div>
  );
}
