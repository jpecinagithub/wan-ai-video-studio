import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Heart, LibraryBig, Play } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { CATEGORIAS, PROMPTS } from '../constants/prompts';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { cn, truncate } from '../utils/format';

type VistaFiltro = 'todas' | 'favoritos';

/** Longitud a partir de la cual el prompt se muestra truncado con opción de expandir. */
const LONGITUD_TRUNCADO = 220;

/**
 * Biblioteca de prompts cinematográficos reutilizables.
 * Contenido 100 % local: no requiere llamadas a modelos de IA.
 */
export function Biblioteca() {
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState<'Todas' | (typeof CATEGORIAS)[number]>('Todas');
  const [vista, setVista] = useState<VistaFiltro>('todas');
  const [favoritos, setFavoritos] = useLocalStorage<string[]>('wan-studio-favoritos', []);
  const [expandidos, setExpandidos] = useState<string[]>([]);

  const ejemplos = useMemo(() => {
    return PROMPTS.filter((e) => {
      if (vista === 'favoritos' && !favoritos.includes(e.id)) return false;
      if (categoria !== 'Todas' && e.categoria !== categoria) return false;
      return true;
    });
  }, [categoria, vista, favoritos]);

  const alternarFavorito = (id: string) => {
    setFavoritos((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const alternarExpandido = (id: string) => {
    setExpandidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const usarPrompt = (prompt: string) => {
    navigate('/', { state: { prompt } });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <LibraryBig className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Biblioteca de prompts</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Inspiración cinematográfica lista para usar. Pulsa «Utilizar prompt» para llevarlo al
            estudio y generar tu vídeo.
          </p>
        </div>
      </div>

      {/* Vista: todos / favoritos */}
      <div className="mb-3 flex gap-2" role="group" aria-label="Vista de la biblioteca">
        <button
          type="button"
          onClick={() => setVista('todas')}
          aria-pressed={vista === 'todas'}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2',
            vista === 'todas'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-muted hover:text-ink',
          )}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setVista('favoritos')}
          aria-pressed={vista === 'favoritos'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2',
            vista === 'favoritos'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-muted hover:text-ink',
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', vista === 'favoritos' && 'fill-current')} aria-hidden="true" />
          Favoritos
          <span className="rounded-full bg-surface-2 px-1.5 text-[10px] tabular-nums" aria-hidden="true">
            {favoritos.length}
          </span>
        </button>
      </div>

      {/* Filtros por categoría */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
        {(['Todas', ...CATEGORIAS] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            aria-pressed={categoria === c}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2',
              categoria === c
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Contador */}
      <p className="mb-4 text-xs text-muted" role="status" aria-live="polite">
        {ejemplos.length === PROMPTS.length
          ? `${PROMPTS.length} ejemplos en la biblioteca`
          : `${ejemplos.length} de ${PROMPTS.length} ejemplos`}
      </p>

      {/* Tarjetas */}
      {ejemplos.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-line p-8 text-center text-sm text-muted">
          No hay prompts en esta vista. Explora otras categorías o quita el filtro de favoritos.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ejemplos.map((e) => {
            const esFavorito = favoritos.includes(e.id);
            const expandido = expandidos.includes(e.id);
            const necesitaTruncado = e.prompt.length > LONGITUD_TRUNCADO;
            const textoPrompt = expandido || !necesitaTruncado ? e.prompt : truncate(e.prompt, LONGITUD_TRUNCADO);
            return (
              <Card key={e.id} className="flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                    {e.categoria}
                  </span>
                  <button
                    type="button"
                    onClick={() => alternarFavorito(e.id)}
                    aria-label={esFavorito ? `Quitar "${e.titulo}" de favoritos` : `Guardar "${e.titulo}" en favoritos`}
                    aria-pressed={esFavorito}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2',
                      esFavorito ? 'text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Heart className={cn('h-5 w-5', esFavorito && 'fill-current')} aria-hidden="true" />
                  </button>
                </div>
                <h2 className="font-semibold">{e.titulo}</h2>
                <p className="mt-1 text-xs text-muted">{e.descripcion}</p>
                <blockquote className="mt-3 flex-1 rounded-lg bg-bg p-3 text-xs leading-relaxed text-muted">
                  <p>“{textoPrompt}”</p>
                  {necesitaTruncado && (
                    <button
                      type="button"
                      onClick={() => alternarExpandido(e.id)}
                      aria-expanded={expandido}
                      className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline focus-visible:outline-2"
                    >
                      {expandido ? (
                        <>
                          Ver menos <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          Ver completo <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  )}
                </blockquote>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => usarPrompt(e.prompt)}>
                  <Play className="h-4 w-4" aria-hidden="true" /> Utilizar prompt
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
