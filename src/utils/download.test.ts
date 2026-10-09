import { afterEach, describe, expect, it, vi } from 'vitest';
import { descargarVideo, sanitizarNombreArchivo } from './download';

describe('sanitizarNombreArchivo', () => {
  it('convierte a minúsculas, quita tildes y fuerza .mp4', () => {
    expect(sanitizarNombreArchivo('Mi Vídeo Épico 2026')).toBe('mi-video-epico-2026.mp4');
  });

  it('sustituye caracteres no alfanuméricos por guiones', () => {
    expect(sanitizarNombreArchivo('  hola/mundo: prueba!  ')).toBe('hola-mundo-prueba.mp4');
  });

  it('devuelve "video.mp4" para nombres vacíos', () => {
    expect(sanitizarNombreArchivo('   ')).toBe('video.mp4');
    expect(sanitizarNombreArchivo('---')).toBe('video.mp4');
  });

  it('no duplica la extensión .mp4', () => {
    expect(sanitizarNombreArchivo('clip.mp4')).toBe('clip.mp4');
  });

  it('limita la longitud del nombre', () => {
    expect(sanitizarNombreArchivo('a'.repeat(200)).length).toBeLessThanOrEqual(84);
  });
});

describe('descargarVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
  });

  it('descarga directa: fetch → blob → clic en enlace con download', async () => {
    const clic = vi.fn();
    const appendChild = vi.fn();
    const remove = vi.fn();
    const enlace = { href: '', download: '', click: clic, remove };
    (globalThis as Record<string, unknown>).document = {
      createElement: () => enlace,
      body: { appendChild },
    };
    (globalThis as Record<string, unknown>).URL = {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: vi.fn(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x']) }),
    );

    await descargarVideo('https://proveedor.example/v.mp4', 'Mi Vídeo');
    expect(enlace.download).toBe('mi-video.mp4');
    expect(appendChild).toHaveBeenCalledWith(enlace);
    expect(clic).toHaveBeenCalled();
  });

  it('fallback al proxy cuando la descarga directa falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS')));
    const location = { href: '' };
    (globalThis as Record<string, unknown>).window = { location };

    await descargarVideo('https://proveedor.example/v.mp4?x=1', 'Mi Vídeo');
    expect(location.href).toBe(
      '/api/video/download?url=' +
        encodeURIComponent('https://proveedor.example/v.mp4?x=1') +
        '&nombre=' +
        encodeURIComponent('mi-video.mp4'),
    );
  });

  it('lanza Error en español si ambas vías fallan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    // window.location.href que lanza al asignar: el proxy tampoco funciona.
    const location = {};
    Object.defineProperty(location, 'href', {
      set() {
        throw new Error('no se puede navegar');
      },
    });
    (globalThis as Record<string, unknown>).window = { location };

    await expect(descargarVideo('https://proveedor.example/v.mp4', 'x')).rejects.toThrow(
      /No se pudo descargar el vídeo/,
    );
  });
});
