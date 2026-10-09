import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturarPoster, tiempoCaptura } from './poster.js';

describe('tiempoCaptura', () => {
  it('devuelve 1s para vídeos de 2s o más', () => {
    expect(tiempoCaptura(15)).toBe(1);
    expect(tiempoCaptura(2)).toBe(1);
    expect(tiempoCaptura(30)).toBe(1);
  });

  it('devuelve la mitad para vídeos de menos de 2s', () => {
    expect(tiempoCaptura(1.5)).toBe(0.75);
    expect(tiempoCaptura(0.4)).toBe(0.2);
  });

  it('devuelve 0 ante duraciones inválidas', () => {
    expect(tiempoCaptura(0)).toBe(0);
    expect(tiempoCaptura(-3)).toBe(0);
    expect(tiempoCaptura(NaN)).toBe(0);
    expect(tiempoCaptura(Infinity)).toBe(0);
  });
});

/* ---------- Mocks de DOM ---------- */

interface VideoSimulado {
  _disparar: (evento: string) => void;
}

function crearVideoSimulado(opciones?: {
  duracion?: number;
  ancho?: number;
  alto?: number;
  fallaCarga?: boolean;
  fallaSeek?: boolean;
}): Record<string, unknown> & VideoSimulado {
  const duracion = opciones?.duracion ?? 10;
  const listeners: Record<string, Array<() => void>> = {};
  const video: Record<string, unknown> & VideoSimulado = {
    crossOrigin: '',
    preload: '',
    muted: false,
    duration: duracion,
    videoWidth: opciones?.ancho ?? 640,
    videoHeight: opciones?.alto ?? 360,
    addEventListener: (ev: string, fn: () => void) => {
      (listeners[ev] ??= []).push(fn);
    },
    removeEventListener: (ev: string, fn: () => void) => {
      listeners[ev] = (listeners[ev] ?? []).filter((f) => f !== fn);
    },
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
    _disparar: (ev: string) => {
      [...(listeners[ev] ?? [])].forEach((f) => f());
    },
  };
  let srcActual = '';
  Object.defineProperty(video, 'src', {
    get: () => srcActual,
    set: (v: string) => {
      srcActual = v;
      queueMicrotask(() =>
        video._disparar(opciones?.fallaCarga ? 'error' : 'loadeddata'),
      );
    },
  });
  let instanteActual = 0;
  Object.defineProperty(video, 'currentTime', {
    get: () => instanteActual,
    set: (v: number) => {
      instanteActual = v;
      queueMicrotask(() =>
        video._disparar(opciones?.fallaSeek ? 'error' : 'seeked'),
      );
    },
  });
  return video;
}

function crearDocumentoSimulado(video: unknown, canvas: unknown) {
  return {
    createElement: (tag: string) => (tag === 'video' ? video : canvas),
  };
}

function instalarDocumento(doc: unknown) {
  (globalThis as { document?: unknown }).document = doc;
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
  vi.restoreAllMocks();
});

describe('capturarPoster', () => {
  it('devuelve null sin DOM (entorno node)', async () => {
    await expect(capturarPoster('https://ejemplo.com/v.mp4')).resolves.toBe(null);
  });

  it('devuelve null con URL vacía', async () => {
    instalarDocumento(crearDocumentoSimulado({}, {}));
    await expect(capturarPoster('')).resolves.toBe(null);
  });

  it('captura el fotograma y lo devuelve como JPEG escalado', async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,AAA');
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL,
    };
    const video = crearVideoSimulado({ duracion: 10, ancho: 640, alto: 360 });
    instalarDocumento(crearDocumentoSimulado(video, canvas));

    const resultado = await capturarPoster('https://ejemplo.com/v.mp4', 320);

    expect(resultado).toBe('data:image/jpeg;base64,AAA');
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.7);
    expect(drawImage).toHaveBeenCalledTimes(1);
    // 640x360 escalado a 320 de ancho → 320x180
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(180);
    // Salta a ~1s en vídeos de 10s
    expect(video.currentTime).toBe(1);
  });

  it('salta a la mitad en vídeos cortos', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => 'data:image/jpeg;base64,AAA',
    };
    const video = crearVideoSimulado({ duracion: 1.2, ancho: 640, alto: 640 });
    instalarDocumento(crearDocumentoSimulado(video, canvas));

    await capturarPoster('https://ejemplo.com/v.mp4');
    expect(video.currentTime).toBe(0.6);
  });

  it('devuelve null si el vídeo emite error al cargar', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: vi.fn(),
    };
    instalarDocumento(crearDocumentoSimulado(crearVideoSimulado({ fallaCarga: true }), canvas));

    const resultado = await capturarPoster('https://ejemplo.com/v.mp4');
    expect(resultado).toBe(null);
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it('devuelve null si el canvas está tainted (toDataURL lanza)', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => {
        throw new DOMException('tainted', 'SecurityError');
      },
    };
    instalarDocumento(crearDocumentoSimulado(crearVideoSimulado(), canvas));

    await expect(capturarPoster('https://ejemplo.com/v.mp4')).resolves.toBe(null);
  });

  it('devuelve null si no hay contexto 2d', async () => {
    const canvas = { width: 0, height: 0, getContext: () => null, toDataURL: vi.fn() };
    instalarDocumento(crearDocumentoSimulado(crearVideoSimulado(), canvas));

    await expect(capturarPoster('https://ejemplo.com/v.mp4')).resolves.toBe(null);
  });

  it('devuelve null ante timeout (el vídeo nunca carga)', async () => {
    const listeners: Record<string, Array<() => void>> = {};
    const videoColgado = {
      crossOrigin: '',
      preload: '',
      muted: false,
      duration: 10,
      videoWidth: 640,
      videoHeight: 360,
      src: '',
      currentTime: 0,
      addEventListener: (ev: string, fn: () => void) => {
        (listeners[ev] ??= []).push(fn);
      },
      removeEventListener: () => undefined,
      setAttribute: () => undefined,
      removeAttribute: () => undefined,
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: vi.fn(),
    };
    instalarDocumento(crearDocumentoSimulado(videoColgado, canvas));

    await expect(capturarPoster('https://ejemplo.com/v.mp4', 320, 40)).resolves.toBe(null);
  }, 5000);

  it('nunca lanza aunque el documento sea defectuoso', async () => {
    instalarDocumento({
      createElement: () => {
        throw new Error('DOM roto');
      },
    });
    await expect(capturarPoster('https://ejemplo.com/v.mp4')).resolves.toBe(null);
  });
});
