import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErrorImagen,
  MAX_IMAGENES_REFERENCIA,
  MAX_LADO_PX,
  bytesAproximadosDataUrl,
  calcularDimensiones,
  comprimirImagen,
  esFormatoSoportado,
  validarArchivoImagen,
} from './imagenes.js';

describe('esFormatoSoportado', () => {
  it('acepta jpeg, png, webp y bmp por MIME', () => {
    expect(esFormatoSoportado({ type: 'image/jpeg', name: 'a.jpg' })).toBe(true);
    expect(esFormatoSoportado({ type: 'image/png', name: 'a.png' })).toBe(true);
    expect(esFormatoSoportado({ type: 'image/webp', name: 'a.webp' })).toBe(true);
    expect(esFormatoSoportado({ type: 'image/bmp', name: 'a.bmp' })).toBe(true);
  });

  it('rechaza gif, svg y otros formatos', () => {
    expect(esFormatoSoportado({ type: 'image/gif', name: 'a.gif' })).toBe(false);
    expect(esFormatoSoportado({ type: 'image/svg+xml', name: 'a.svg' })).toBe(false);
    expect(esFormatoSoportado({ type: 'video/mp4', name: 'a.mp4' })).toBe(false);
  });

  it('usa la extensión como respaldo cuando no hay MIME', () => {
    expect(esFormatoSoportado({ type: '', name: 'foto.JPG' })).toBe(true);
    expect(esFormatoSoportado({ name: 'foto.webp' })).toBe(true);
    expect(esFormatoSoportado({ name: 'foto.tiff' })).toBe(false);
  });
});

describe('validarArchivoImagen', () => {
  it('acepta un archivo válido', () => {
    expect(() => validarArchivoImagen({ type: 'image/jpeg', name: 'a.jpg', size: 1000 })).not.toThrow();
  });

  it('rechaza formatos no soportados', () => {
    expect(() => validarArchivoImagen({ type: 'image/gif', name: 'a.gif', size: 1000 })).toThrow(
      ErrorImagen,
    );
  });

  it('rechaza archivos de más de 20 MB', () => {
    expect(() =>
      validarArchivoImagen({ type: 'image/jpeg', name: 'a.jpg', size: 21 * 1024 * 1024 }),
    ).toThrow(/20 MB/);
  });

  it('rechaza archivos vacíos', () => {
    expect(() => validarArchivoImagen({ type: 'image/jpeg', name: 'a.jpg', size: 0 })).toThrow(
      ErrorImagen,
    );
  });
});

describe('calcularDimensiones', () => {
  it('reduce el lado mayor a MAX_LADO_PX manteniendo proporción', () => {
    expect(calcularDimensiones(4000, 3000, MAX_LADO_PX)).toEqual({ ancho: 1280, alto: 960 });
  });

  it('no amplía imágenes pequeñas', () => {
    expect(calcularDimensiones(800, 600, MAX_LADO_PX)).toEqual({ ancho: 800, alto: 600 });
  });

  it('maneja orientación vertical', () => {
    expect(calcularDimensiones(1000, 3000, MAX_LADO_PX)).toEqual({ ancho: 427, alto: 1280 });
  });

  it('rechaza dimensiones inválidas', () => {
    expect(() => calcularDimensiones(0, 100, MAX_LADO_PX)).toThrow(ErrorImagen);
    expect(() => calcularDimensiones(-5, 100, MAX_LADO_PX)).toThrow(ErrorImagen);
  });
});

describe('bytesAproximadosDataUrl', () => {
  it('estima los bytes del base64', () => {
    // 1000 caracteres base64 ≈ 750 bytes.
    expect(bytesAproximadosDataUrl('data:image/jpeg;base64,' + 'A'.repeat(1000))).toBe(750);
  });
});

describe('constantes', () => {
  it('el máximo de imágenes de referencia es 10 (límite oficial)', () => {
    expect(MAX_IMAGENES_REFERENCIA).toBe(10);
  });
});

describe('comprimirImagen (canvas simulado)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function simularCanvas(anchosFuente = { width: 2000, height: 1000 }) {
    const toDataURL = vi.fn((_mime: string, _calidad: number) => 'data:image/jpeg;base64,' + 'A'.repeat(1000));
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const contexto = { fillStyle: '', fillRect, drawImage };
    const lienzo = { width: 0, height: 0, getContext: vi.fn(() => contexto), toDataURL };
    vi.stubGlobal('createImageBitmap', async () => ({ ...anchosFuente, close: () => undefined }));
    vi.stubGlobal('document', { createElement: vi.fn(() => lienzo) });
    return { toDataURL, fillRect, drawImage, lienzo, contexto };
  }

  it('redimensiona, aplana con fondo blanco y devuelve JPEG', async () => {
    const { toDataURL, fillRect, lienzo, contexto } = simularCanvas();
    const archivo = new File(['x'.repeat(100)], 'foto.png', { type: 'image/png' });

    const resultado = await comprimirImagen(archivo);

    expect(resultado.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(resultado.nombre).toBe('foto.png');
    // 2000x1000 → lado mayor 1280.
    expect(lienzo.width).toBe(1280);
    expect(lienzo.height).toBe(640);
    // Fondo blanco antes de dibujar (aplana transparencias).
    expect(contexto.fillStyle).toBe('#ffffff');
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1280, 640);
    // Primera calidad intentada: 0.82.
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.82);
  });

  it('baja la calidad hasta quedar en ≤ 300 KB', async () => {
    // Primera pasada: 500 KB; segunda: 100 KB.
    const grande = 'data:image/jpeg;base64,' + 'A'.repeat(666_667);
    const pequena = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
    const toDataURL = vi
      .fn()
      .mockReturnValueOnce(grande)
      .mockReturnValue(pequena);
    const contexto = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const lienzo = { width: 0, height: 0, getContext: vi.fn(() => contexto), toDataURL };
    vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600, close: () => undefined }));
    vi.stubGlobal('document', { createElement: vi.fn(() => lienzo) });

    const archivo = new File(['x'.repeat(100)], 'foto.jpg', { type: 'image/jpeg' });
    const resultado = await comprimirImagen(archivo);

    expect(toDataURL).toHaveBeenCalledTimes(2);
    expect(toDataURL.mock.calls[0]?.[1]).toBe(0.82);
    expect(toDataURL.mock.calls[1]?.[1]).toBe(0.7);
    expect(resultado.dataUrl).toBe(pequena);
  });

  it('falla con mensaje claro si no se logra el objetivo', async () => {
    const grande = 'data:image/jpeg;base64,' + 'A'.repeat(666_667);
    const toDataURL = vi.fn(() => grande);
    const contexto = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const lienzo = { width: 0, height: 0, getContext: vi.fn(() => contexto), toDataURL };
    vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600, close: () => undefined }));
    vi.stubGlobal('document', { createElement: vi.fn(() => lienzo) });

    const archivo = new File(['x'.repeat(100)], 'foto.jpg', { type: 'image/jpeg' });
    await expect(comprimirImagen(archivo)).rejects.toThrow(ErrorImagen);
    await expect(comprimirImagen(archivo)).rejects.toThrow(/300 KB/);
    expect(toDataURL).toHaveBeenCalledTimes(8); // 4 calidades × 2 llamadas
  });

  it('rechaza antes de procesar si el formato no es válido', async () => {
    const archivo = new File(['x'], 'anim.gif', { type: 'image/gif' });
    await expect(comprimirImagen(archivo)).rejects.toThrow(/Formato no soportado/);
  });
});
