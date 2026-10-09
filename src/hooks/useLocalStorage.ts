import { useState } from 'react';

/**
 * Estado sincronizado con localStorage (preferencias ligeras).
 * Los vídeos nunca se guardan aquí; solo metadatos pequeños.
 */
export function useLocalStorage<T>(clave: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const crudo = window.localStorage.getItem(clave);
      return crudo !== null ? (JSON.parse(crudo) as T) : inicial;
    } catch {
      return inicial;
    }
  });

  const guardar = (nuevo: T | ((previo: T) => T)) => {
    setValor((previo) => {
      const resuelto = typeof nuevo === 'function' ? (nuevo as (p: T) => T)(previo) : nuevo;
      try {
        window.localStorage.setItem(clave, JSON.stringify(resuelto));
      } catch {
        // Cuota llena o sin acceso: se mantiene solo en memoria.
      }
      return resuelto;
    });
  };

  return [valor, guardar] as const;
}
