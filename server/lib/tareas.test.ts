import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  contarActivas,
  esEstadoTerminal,
  hayHuecoSimultaneidad,
  limpiarRegistro,
  marcarTerminal,
  obtenerActivas,
  reconciliarActivas,
  registrarActiva,
} from './tareas.js';
import type { EstadoTareaProveedor } from './provider.js';

beforeEach(() => {
  limpiarRegistro();
  vi.restoreAllMocks();
});

describe('esEstadoTerminal', () => {
  it.each([
    ['succeeded', true],
    ['failed', true],
    ['cancelled', true],
    ['unknown', true],
    ['pending', false],
    ['processing', false],
  ] as Array<[EstadoTareaProveedor, boolean]>)('%s → %s', (estado, esperado) => {
    expect(esEstadoTerminal(estado)).toBe(esperado);
  });
});

describe('límite de simultaneidad', () => {
  it('hay hueco con 0 y 1 tareas activas', () => {
    expect(hayHuecoSimultaneidad()).toBe(true);
    registrarActiva('t1');
    expect(hayHuecoSimultaneidad()).toBe(true);
  });

  it('no hay hueco con 2 tareas activas', () => {
    registrarActiva('t1');
    registrarActiva('t2');
    expect(hayHuecoSimultaneidad()).toBe(false);
    expect(contarActivas()).toBe(2);
  });

  it('marcarTerminal libera el hueco', () => {
    registrarActiva('t1');
    registrarActiva('t2');
    expect(hayHuecoSimultaneidad()).toBe(false);
    marcarTerminal('t1');
    expect(hayHuecoSimultaneidad()).toBe(true);
    expect(obtenerActivas()).toEqual(['t2']);
  });
});

describe('reconciliarActivas', () => {
  it('libera las tareas que ya terminaron en el proveedor', async () => {
    registrarActiva('t-ok');
    registrarActiva('t-fallo');
    const obtenerEstado = vi.fn(async (taskId: string) => ({
      estado: (taskId === 't-ok' ? 'succeeded' : 'failed') as EstadoTareaProveedor,
    }));
    await reconciliarActivas(obtenerEstado);
    expect(hayHuecoSimultaneidad()).toBe(true);
    expect(contarActivas()).toBe(0);
  });

  it('conserva las tareas que siguen en curso', async () => {
    registrarActiva('t1');
    registrarActiva('t2');
    const obtenerEstado = vi.fn(async () => ({ estado: 'processing' as EstadoTareaProveedor }));
    await reconciliarActivas(obtenerEstado);
    expect(hayHuecoSimultaneidad()).toBe(false);
    expect(obtenerEstado).toHaveBeenCalledTimes(2);
  });

  it('libera unknown (tarea caducada o inexistente en el proveedor)', async () => {
    registrarActiva('t-vieja');
    await reconciliarActivas(async () => ({ estado: 'unknown' as EstadoTareaProveedor }));
    expect(hayHuecoSimultaneidad()).toBe(true);
  });

  it('si el proveedor no responde, conserva los huecos sin lanzar', async () => {
    registrarActiva('t1');
    registrarActiva('t2');
    await expect(
      reconciliarActivas(async () => {
        throw new Error('red caída');
      }),
    ).resolves.toBeUndefined();
    expect(hayHuecoSimultaneidad()).toBe(false);
    expect(contarActivas()).toBe(2);
  });

  it('no hace nada sin tareas activas', async () => {
    const obtenerEstado = vi.fn();
    await reconciliarActivas(obtenerEstado);
    expect(obtenerEstado).not.toHaveBeenCalled();
    expect(hayHuecoSimultaneidad()).toBe(true);
  });
});
