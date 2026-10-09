import { NavLink } from 'react-router-dom';
import { BookOpen, Clapperboard, Film, Info, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../utils/format';

const ENLACES = [
  { to: '/', etiqueta: 'Estudio', icono: Clapperboard, fin: true },
  { to: '/mis-videos', etiqueta: 'Mis vídeos', icono: Film, fin: false },
  { to: '/biblioteca', etiqueta: 'Biblioteca', icono: BookOpen, fin: false },
  { to: '/acerca-de', etiqueta: 'Acerca de', icono: Info, fin: false },
];

function Marca() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5" aria-label="WAN AI Video Studio — inicio">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
        <Clapperboard className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-base font-bold tracking-tight text-ink">
        WAN AI <span className="text-accent">Video Studio</span>
      </span>
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { tema, alternar } = useTheme();

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      {/* Cabecera */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Marca />
          <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
            {ENLACES.map(({ to, etiqueta, fin }) => (
              <NavLink
                key={to}
                to={to}
                end={fin}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink',
                  )
                }
              >
                {etiqueta}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={alternar}
            aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {tema === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12">
        {children}
      </main>

      {/* Navegación inferior en móvil */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-4">
          {ENLACES.map(({ to, etiqueta, icono: Icono, fin }) => (
            <NavLink
              key={to}
              to={to}
              end={fin}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              <Icono className="h-5 w-5" aria-hidden="true" />
              {etiqueta}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Pie */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center sm:px-6">
          <p className="text-sm text-muted">Created by Jon Peciña Iturbe</p>
          <p className="text-xs text-muted/70">
            Proyecto personal · Sin cuentas de usuario · Tus datos permanecen en tu dispositivo
          </p>
        </div>
      </footer>
    </div>
  );
}
