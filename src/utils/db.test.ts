import { beforeEach, describe, expect, it } from 'vitest';
import type { VideoRecord } from '../types';
import { eliminarVideo, guardarVideo, listarVideos, obtenerVideo } from './db';

/* ------------------------------------------------------------------ */
/* Fake mínimo de IndexedDB en memoria (solo el subconjunto que usa    */
/* src/utils/db.ts: open con onupgradeneeded, put/get/getAll/delete).  */
/* ------------------------------------------------------------------ */

type Manejador = ((this: unknown, ev: { target: unknown }) => void) | null;

class PeticionFalsa<T> {
  result: T | undefined;
  error: unknown = null;
  onsuccess: Manejador = null;
  onerror: Manejador = null;
  constructor(
    ejecutar: () => T,
    tx: TransaccionFalsa | null = null,
  ) {
    tx?.registrar();
    setTimeout(() => {
      try {
        this.result = ejecutar();
        this.onsuccess?.call(this, { target: this });
      } catch (e) {
        this.error = e;
        this.onerror?.call(this, { target: this });
      } finally {
        // El chequeo de fin de transacción se programa DESPUÉS de onsuccess:
        // los microtasks (el await de db.ts que asigna tx.oncomplete) corren antes.
        tx?.completada();
      }
    }, 0);
  }
}

class TransaccionFalsa {
  oncomplete: Manejador = null;
  onerror: Manejador = null;
  onabort: Manejador = null;
  private esperadas = 0;
  private terminadas = 0;
  constructor(private tienda: TiendaFalsa) {}
  objectStore(): TiendaFalsa {
    return this.tienda;
  }
  registrar(): void {
    this.esperadas += 1;
  }
  completada(): void {
    this.terminadas += 1;
    setTimeout(() => {
      if (this.terminadas >= this.esperadas && this.esperadas > 0) {
        this.oncomplete?.call(this, { target: this });
      }
    }, 0);
  }
}

class TiendaFalsa {
  private datos = new Map<string, VideoRecord>();
  put(registro: VideoRecord): PeticionFalsa<string> {
    return new PeticionFalsa(() => {
      this.datos.set(registro.id, { ...registro });
      return registro.id;
    }, TiendaFalsa.txActual);
  }
  get(id: string): PeticionFalsa<VideoRecord | undefined> {
    return new PeticionFalsa(() => this.datos.get(id), TiendaFalsa.txActual);
  }
  getAll(): PeticionFalsa<VideoRecord[]> {
    return new PeticionFalsa(() => [...this.datos.values()], TiendaFalsa.txActual);
  }
  delete(id: string): PeticionFalsa<undefined> {
    return new PeticionFalsa(() => {
      this.datos.delete(id);
      return undefined;
    }, TiendaFalsa.txActual);
  }
  // La transacción en curso se inyecta antes de cada operación (ver BaseDatosFalsa).
  static txActual: TransaccionFalsa | null = null;
}

class BaseDatosFalsa {
  objectStoreNames = { contains: (nombre: string) => this.tiendas.has(nombre) };
  private tiendas = new Map<string, TiendaFalsa>();
  createObjectStore(nombre: string): TiendaFalsa {
    const tienda = new TiendaFalsa();
    this.tiendas.set(nombre, tienda);
    return tienda;
  }
  transaction(nombre: string): TransaccionFalsa {
    const tienda = this.tiendas.get(nombre);
    if (!tienda) throw new Error(`Tienda desconocida: ${nombre}`);
    const tx = new TransaccionFalsa(tienda);
    TiendaFalsa.txActual = tx;
    return tx;
  }
  close(): void {
    /* sin-op */
  }
}

class FabricaFalsa {
  private bases = new Map<string, BaseDatosFalsa>();
  open(nombre: string): {
    result: BaseDatosFalsa | undefined;
    error: unknown;
    onsuccess: Manejador;
    onerror: Manejador;
    onupgradeneeded: Manejador;
  } {
    const primeraVez = !this.bases.has(nombre);
    if (primeraVez) this.bases.set(nombre, new BaseDatosFalsa());
    const bd = this.bases.get(nombre)!;
    const req = {
      result: undefined as BaseDatosFalsa | undefined,
      error: null as unknown,
      onsuccess: null as Manejador,
      onerror: null as Manejador,
      onupgradeneeded: null as Manejador,
    };
    setTimeout(() => {
      try {
        req.result = bd;
        if (primeraVez) req.onupgradeneeded?.call(req, { target: req });
        req.onsuccess?.call(req, { target: req });
      } catch (e) {
        req.error = e;
        req.onerror?.call(req, { target: req });
      }
    }, 0);
    return req;
  }
}

function registroBase(id: string, fecha: string): VideoRecord {
  return {
    id,
    fecha,
    prompt: `prompt ${id}`,
    modelId: 'wan3.0-video',
    duracion: 5,
    resolucion: '720p',
    aspecto: '16:9',
    estado: 'pendiente',
    nombre: `video-${id}`,
  };
}

beforeEach(() => {
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = new FabricaFalsa();
});

describe('db (IndexedDB)', () => {
  it('guarda y recupera un registro por id', async () => {
    await guardarVideo(registroBase('a', '2026-10-09T10:00:00.000Z'));
    const leido = await obtenerVideo('a');
    expect(leido?.prompt).toBe('prompt a');
    expect(leido?.estado).toBe('pendiente');
  });

  it('devuelve undefined para un id inexistente', async () => {
    expect(await obtenerVideo('no-existe')).toBeUndefined();
  });

  it('listarVideos devuelve los más recientes primero', async () => {
    await guardarVideo(registroBase('viejo', '2026-10-08T10:00:00.000Z'));
    await guardarVideo(registroBase('nuevo', '2026-10-09T10:00:00.000Z'));
    const lista = await listarVideos();
    expect(lista.map((r) => r.id)).toEqual(['nuevo', 'viejo']);
  });

  it('eliminarVideo borra el registro', async () => {
    await guardarVideo(registroBase('x', '2026-10-09T10:00:00.000Z'));
    await eliminarVideo('x');
    expect(await obtenerVideo('x')).toBeUndefined();
  });

  it('no guarda más de 20 registros: elimina los más antiguos', async () => {
    for (let i = 0; i < 22; i++) {
      const fecha = new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString();
      await guardarVideo(registroBase(`v${i}`, fecha));
    }
    const lista = await listarVideos();
    expect(lista).toHaveLength(20);
    expect(lista.map((r) => r.id)).not.toContain('v0');
    expect(lista.map((r) => r.id)).not.toContain('v1');
    expect(lista[0].id).toBe('v21');
  });

  it('actualizar un registro existente no duplica (put por id)', async () => {
    await guardarVideo(registroBase('u', '2026-10-09T10:00:00.000Z'));
    await guardarVideo({ ...registroBase('u', '2026-10-09T10:00:00.000Z'), estado: 'completado' });
    const lista = await listarVideos();
    expect(lista).toHaveLength(1);
    expect(lista[0].estado).toBe('completado');
  });
});
