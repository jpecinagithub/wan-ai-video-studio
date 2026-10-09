import type { VideoRecord } from '../types';

const NOMBRE_BD = 'wan-ai-video-studio';
const NOMBRE_STORE = 'videos';
const VERSION = 1;
const MAX_REGISTROS = 20;

function fabrica(): IDBFactory {
  const f = globalThis.indexedDB;
  if (!f) {
    throw new Error('IndexedDB no está disponible en este entorno.');
  }
  return f;
}

function promesaPeticion<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () =>
      rechazar(peticion.error ?? new Error('Error en IndexedDB.'));
  });
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = fabrica().open(NOMBRE_BD, VERSION);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      if (!bd.objectStoreNames.contains(NOMBRE_STORE)) {
        bd.createObjectStore(NOMBRE_STORE, { keyPath: 'id' });
      }
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () =>
      rechazar(peticion.error ?? new Error('No se pudo abrir la base de datos local.'));
  });
}

async function conStore<T>(
  modo: IDBTransactionMode,
  operacion: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const bd = await abrir();
  try {
    const tx = bd.transaction(NOMBRE_STORE, modo);
    const store = tx.objectStore(NOMBRE_STORE);
    const resultado = await promesaPeticion(operacion(store));
    await new Promise<void>((resolver, rechazar) => {
      tx.oncomplete = () => resolver();
      tx.onerror = () => rechazar(tx.error ?? new Error('Error en la transacción.'));
      tx.onabort = () => rechazar(tx.error ?? new Error('Transacción abortada.'));
    });
    return resultado;
  } finally {
    bd.close();
  }
}

/**
 * Guarda un registro de vídeo. Si ya hay más de MAX_REGISTROS,
 * elimina los más antiguos hasta quedarse en el límite.
 */
export async function guardarVideo(registro: VideoRecord): Promise<void> {
  await conStore('readwrite', (store) => store.put(registro));
  const todos = await conStore('readonly', (store) => store.getAll());
  const registros = todos as VideoRecord[];
  if (registros.length > MAX_REGISTROS) {
    const antiguos = [...registros]
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(0, registros.length - MAX_REGISTROS);
    await Promise.all(antiguos.map((r) => conStore('readwrite', (store) => store.delete(r.id))));
  }
}

/** Devuelve los registros, más recientes primero. */
export async function listarVideos(): Promise<VideoRecord[]> {
  const todos = (await conStore('readonly', (store) => store.getAll())) as VideoRecord[];
  return [...todos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export async function obtenerVideo(id: string): Promise<VideoRecord | undefined> {
  const registro = (await conStore('readonly', (store) => store.get(id))) as
    | VideoRecord
    | undefined;
  return registro;
}

export async function eliminarVideo(id: string): Promise<void> {
  await conStore('readwrite', (store) => store.delete(id));
}
