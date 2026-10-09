import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Tema = 'dark' | 'light';

const ThemeContext = createContext<{ tema: Tema; alternar: () => void }>({
  tema: 'dark',
  alternar: () => undefined,
});

const CLAVE = 'wan-studio-tema';

/** Tema oscuro predeterminado, con modo claro opcional persistido. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      return guardado === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try {
      window.localStorage.setItem(CLAVE, tema);
    } catch {
      // Sin almacenamiento disponible: se mantiene solo en memoria.
    }
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return <ThemeContext.Provider value={{ tema, alternar }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
