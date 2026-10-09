/**
 * Registro en memoria de tareas (por instancia serverless).
 *
 * - Idempotencia: si una petición llega dos veces con la misma clave,
 *   se devuelve la respuesta original (201 → 200) sin crear otra tarea
 *   en el proveedor. TTL de 10 minutos.
 * - Simultaneidad: como máximo 2 tareas no terminales a la vez; el resto
 *   de peticiones reciben 429. Las entradas caducan a las 24h (el proveedor
 *   caduca las tareas en ese plazo).
 *
 * Nota: en serverless este registro solo vive dentro de cada instancia
 * cálida; es una protección de buena fe, no una garantía distribuida.
 */

export interface RespuestaCreacion {
  taskId: string;
  estado: 'pendiente';
  mensaje: string;
}

export const MAX_SIMULTANEAS = 2;
const TTL_IDEMPOTENCIA_MS = 10 * 60 * 1000;
const TTL_ACTIVA_MS = 24 * 60 * 60 * 1000;

interface EntradaIdempotencia {
  respuesta: RespuestaCreacion;
  expiraEn: number;
}

const activas = new Map<string, number>();
const idempotencia = new Map<string, EntradaIdempotencia>();

function podarActivas(): void {
  const ahora = Date.now();
  for (const [taskId, creada] of activas) {
    if (ahora - creada > TTL_ACTIVA_MS) activas.delete(taskId);
  }
}

function podarIdempotencia(): void {
  const ahora = Date.now();
  for (const [clave, entrada] of idempotencia) {
    if (ahora > entrada.expiraEn) idempotencia.delete(clave);
  }
}

/** Devuelve la respuesta guardada para una clave de idempotencia (o undefined). */
export function obtenerRespuestaIdempotente(clave: string): RespuestaCreacion | undefined {
  const entrada = idempotencia.get(clave);
  if (!entrada) return undefined;
  if (Date.now() > entrada.expiraEn) {
    idempotencia.delete(clave);
    return undefined;
  }
  return entrada.respuesta;
}

/** Guarda la respuesta de una creación para futuras repeticiones con la misma clave. */
export function guardarRespuestaIdempotente(clave: string, respuesta: RespuestaCreacion): void {
  podarIdempotencia();
  idempotencia.set(clave, { respuesta, expiraEn: Date.now() + TTL_IDEMPOTENCIA_MS });
}

/** Número de tareas activas (no terminales) registradas. */
export function contarActivas(): number {
  podarActivas();
  return activas.size;
}

/** ¿Hay hueco para crear otra generación? */
export function hayHuecoSimultaneidad(): boolean {
  return contarActivas() < MAX_SIMULTANEAS;
}

/** Registra una tarea recién creada como activa. */
export function registrarActiva(taskId: string): void {
  podarActivas();
  activas.set(taskId, Date.now());
}

/** Marca una tarea como terminal: libera su hueco de simultaneidad. */
export function marcarTerminal(taskId: string): void {
  activas.delete(taskId);
}

/** Limpia todo el registro (pensado para tests). */
export function limpiarRegistro(): void {
  activas.clear();
  idempotencia.clear();
}
