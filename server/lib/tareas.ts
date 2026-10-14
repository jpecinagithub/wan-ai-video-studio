/**
 * Registro en memoria de tareas (por instancia serverless).
 *
 * - Idempotencia: si una petición llega dos veces con la misma clave,
 *   se devuelve la respuesta original (201 → 200) sin crear otra tarea
 *   en el proveedor. TTL de 10 minutos.
 * - Simultaneidad: como máximo 2 tareas no terminales a la vez. Antes de
 *   rechazar por falta de hueco se reconcilian los huecos consultando el
 *   estado real en el proveedor (las tareas que ya terminaron allí liberan
 *   su hueco aunque el navegador se cerrara a mitad del polling). Como
 *   red de seguridad, los huecos más antiguos de 90 minutos se consideran
 *   caducados: la generación típica tarda minutos y este registro solo es
 *   una puerta de creación, no afecta al seguimiento de tareas existentes.
 *
 * Nota: en serverless este registro solo vive dentro de cada instancia
 * cálida; es una protección de buena fe, no una garantía distribuida.
 */

import type { EstadoTareaProveedor } from './provider.js';

export interface RespuestaCreacion {
  taskId: string;
  estado: 'pendiente';
  mensaje: string;
}

export const MAX_SIMULTANEAS = 2;
const TTL_IDEMPOTENCIA_MS = 10 * 60 * 1000;
const TTL_ACTIVA_MS = 90 * 60 * 1000;

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

/** Lista los identificadores de tareas activas (tras podar caducadas). */
export function obtenerActivas(): string[] {
  podarActivas();
  return [...activas.keys()];
}

/** ¿El estado del proveedor es terminal (la tarea ya no va a cambiar)? */
export function esEstadoTerminal(estado: EstadoTareaProveedor): boolean {
  return estado === 'succeeded' || estado === 'failed' || estado === 'cancelled' || estado === 'unknown';
}

/**
 * Reconcilia los huecos de simultaneidad con la realidad del proveedor:
 * consulta el estado de cada tarea activa y libera las que ya terminaron.
 * Si el proveedor no responde para una tarea, se conserva su hueco.
 */
export async function reconciliarActivas(
  obtenerEstado: (taskId: string) => Promise<{ estado: EstadoTareaProveedor }>,
): Promise<void> {
  const ids = obtenerActivas();
  await Promise.all(
    ids.map(async (taskId) => {
      try {
        const info = await obtenerEstado(taskId);
        if (esEstadoTerminal(info.estado)) marcarTerminal(taskId);
      } catch {
        /* Proveedor inaccesible para esta tarea: se conserva el hueco. */
      }
    }),
  );
}

/** Limpia todo el registro (pensado para tests). */
export function limpiarRegistro(): void {
  activas.clear();
  idempotencia.clear();
}
