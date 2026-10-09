import { describe, expect, it } from 'vitest';
import { urlDescargaProxy } from './api';

describe('urlDescargaProxy', () => {
  it('construye la URL del proxy con parámetros codificados', () => {
    const url = 'https://proveedor.example/v.mp4?token=abc&x=1';
    const nombre = 'mi-video.mp4';
    expect(urlDescargaProxy(url, nombre)).toBe(
      `/api/video/download?url=${encodeURIComponent(url)}&nombre=${encodeURIComponent(nombre)}`,
    );
  });

  it('codifica espacios y caracteres especiales del nombre', () => {
    expect(urlDescargaProxy('https://a.example/v.mp4', 'mi vídeo final.mp4')).toBe(
      '/api/video/download?url=https%3A%2F%2Fa.example%2Fv.mp4&nombre=mi%20v%C3%ADdeo%20final.mp4',
    );
  });
});
