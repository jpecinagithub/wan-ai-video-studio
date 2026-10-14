import { describe, expect, it } from 'vitest';
import { HttpError } from './errors.js';
import { MODELOS, MONEDA_PRECIOS, estimarCostePollen, validarCombinacion } from './capabilities.js';

describe('registro de modelos', () => {
  it('expone los dos modelos de Pollinations y los dos gratuitos de Magic Hour', () => {
    expect(MONEDA_PRECIOS).toBe('pollen');
    expect(MODELOS.map((m) => m.id)).toEqual([
      'bytedance/seedance-1-pro-fast',
      'google/veo-3.1-fast',
      'magichour/ltx-2.5',
      'magichour/minimax-h3',
    ]);
  });

  it('Veo admite duraciones 4/6/8, 720p/1080p y 2 imágenes', () => {
    const veo = MODELOS.find((m) => m.id === 'google/veo-3.1-fast')!;
    expect(veo.duraciones).toEqual([4, 6, 8]);
    expect(veo.resoluciones).toEqual(['720p', '1080p']);
    expect(veo.maxImagenes).toBe(2);
    expect(veo.generaAudio).toBe(true);
  });

  it('Seedance admite 2-10 s, 480p/720p/1080p y 1 imagen', () => {
    const seedance = MODELOS.find((m) => m.id === 'bytedance/seedance-1-pro-fast')!;
    expect(seedance.duraciones).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(seedance.resoluciones).toEqual(['480p', '720p', '1080p']);
    expect(seedance.maxImagenes).toBe(1);
    expect(seedance.generaAudio).toBe(false);
  });

  it('LTX 2.5 (Magic Hour) es gratis, sin imágenes y con audio', () => {
    const ltx = MODELOS.find((m) => m.id === 'magichour/ltx-2.5')!;
    expect(ltx.tipoCoste).toBe('gratis');
    expect(ltx.maxImagenes).toBe(0);
    expect(ltx.generaAudio).toBe(true);
    expect(ltx.duraciones).toEqual([4, 6, 8, 10, 15, 20, 30]);
    expect(ltx.resoluciones).toEqual(['480p', '720p', '1080p']);
  });

  it('MiniMax H3 (Magic Hour) es gratis, admite 1 imagen y tiene audio', () => {
    const minimax = MODELOS.find((m) => m.id === 'magichour/minimax-h3')!;
    expect(minimax.tipoCoste).toBe('gratis');
    expect(minimax.maxImagenes).toBe(1);
    expect(minimax.generaAudio).toBe(true);
    expect(minimax.duraciones).toEqual([3, 4, 6, 8, 10, 15, 20, 30]);
    expect(minimax.resoluciones).toEqual(['480p', '720p', '1080p']);
  });

  it('los modelos de Pollinations son de pago', () => {
    for (const id of ['bytedance/seedance-1-pro-fast', 'google/veo-3.1-fast'] as const) {
      expect(MODELOS.find((m) => m.id === id)!.tipoCoste).toBe('pago');
    }
  });
});

describe('validarCombinacion', () => {
  it('acepta combinaciones válidas', () => {
    expect(() =>
      validarCombinacion('google/veo-3.1-fast', 8, '720p', 2),
    ).not.toThrow();
    expect(() =>
      validarCombinacion('bytedance/seedance-1-pro-fast', 5, '480p', 1),
    ).not.toThrow();
  });

  it('rechaza duraciones no permitidas por el modelo', () => {
    try {
      validarCombinacion('google/veo-3.1-fast', 5, '720p', 0);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).estado).toBe(400);
      expect((err as HttpError).message).toContain('4, 6, 8');
    }
  });

  it('rechaza resoluciones no permitidas por el modelo', () => {
    try {
      validarCombinacion('google/veo-3.1-fast', 8, '480p', 0);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).message).toContain('720p, 1080p');
    }
  });

  it('rechaza más imágenes de las admitidas', () => {
    try {
      validarCombinacion('bytedance/seedance-1-pro-fast', 8, '720p', 2);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).message).toContain('1 imagen');
    }
  });

  it('LTX 2.5 rechaza cualquier imagen (solo texto a vídeo)', () => {
    try {
      validarCombinacion('magichour/ltx-2.5', 8, '480p', 1);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(400);
    }
  });

  it('LTX 2.5 acepta 30 s en 480p sin imágenes', () => {
    expect(() => validarCombinacion('magichour/ltx-2.5', 30, '480p', 0)).not.toThrow();
  });
});

describe('estimarCostePollen', () => {
  it('Veo 8s 720p con audio: 8 × (0,08 + 0,02) = 0,80 pollen', () => {
    expect(estimarCostePollen('google/veo-3.1-fast', '720p', 8, true)).toBeCloseTo(0.8, 10);
  });

  it('Veo 8s 720p sin audio: 8 × 0,08 = 0,64 pollen', () => {
    expect(estimarCostePollen('google/veo-3.1-fast', '720p', 8, false)).toBeCloseTo(0.64, 10);
  });

  it('Veo 8s 1080p con audio: 8 × (0,10 + 0,02) = 0,96 pollen', () => {
    expect(estimarCostePollen('google/veo-3.1-fast', '1080p', 8, true)).toBeCloseTo(0.96, 10);
  });

  it('Seedance 8s 720p: 8 × 0,025 = 0,20 pollen (el audio no suma)', () => {
    expect(estimarCostePollen('bytedance/seedance-1-pro-fast', '720p', 8, true)).toBeCloseTo(0.2, 10);
  });

  it('Seedance 5s 480p: 5 × 0,015 = 0,075 pollen', () => {
    expect(estimarCostePollen('bytedance/seedance-1-pro-fast', '480p', 5, false)).toBeCloseTo(
      0.075,
      10,
    );
  });
});
