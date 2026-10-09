/** Une clases CSS ignorando valores falsos. */
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ');
}

/** Formatea segundos como m:ss (p. ej. 65 -> "1:05"). */
export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const minutos = Math.floor(t / 60);
  const segundos = t % 60;
  return `${minutos}:${segundos.toString().padStart(2, '0')}`;
}

/** Formatea una fecha ISO en español (p. ej. "9 oct 2026, 18:40"). */
export function formatFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no válida';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

/** Recorta un texto a un máximo de caracteres con elipsis. */
export function truncate(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

/** Genera un identificador único para peticiones del cliente. */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
