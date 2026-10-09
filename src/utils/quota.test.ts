import { describe, expect, it } from 'vitest';
import {
  aplicarAjuste,
  aplicarExito,
  clampCuota,
  cuotaCaducada,
  estadoInicialCuota,
  expiraCuotaDe,
  formatearFechaCorta,
  normalizarMapaCuota,
  totalCuotaDe,
} from './quota.js';

describe('estadoInicialCuota', () => {
  it('inicia cada modelo con su total del panel del usuario', () => {
    const inicial = estadoInicialCuota();
    expect(inicial['wan3.0-video'].restantes).toBe(30);
    expect(inicial['wan3.0-video-prime'].restantes).toBe(30);
  });
});

describe('totalCuotaDe / expiraCuotaDe', () => {
  it('devuelve los datos de la cuota gratuita configurada', () => {
    expect(totalCuotaDe('wan3.0-video')).toBe(30);
    expect(expiraCuotaDe('wan3.0-video')).toBe('2026-11-04');
    expect(totalCuotaDe('wan3.0-video-prime')).toBe(30);
    expect(expiraCuotaDe('wan3.0-video-prime')).toBe('2026-11-20');
  });
});

describe('aplicarExito', () => {
  it('decrementa en 1 ante una generación completada', () => {
    const prev = estadoInicialCuota();
    const next = aplicarExito(prev, 'wan3.0-video');
    expect(next['wan3.0-video'].restantes).toBe(29);
    expect(next['wan3.0-video-prime'].restantes).toBe(30);
  });

  it('nunca baja de 0', () => {
    let mapa = estadoInicialCuota();
    for (let i = 0; i < 40; i++) mapa = aplicarExito(mapa, 'wan3.0-video-prime');
    expect(mapa['wan3.0-video-prime'].restantes).toBe(0);
  });

  it('no muta el estado previo', () => {
    const prev = estadoInicialCuota();
    aplicarExito(prev, 'wan3.0-video');
    expect(prev['wan3.0-video'].restantes).toBe(30);
  });
});

describe('aplicarAjuste', () => {
  it('permite corregir el contador manualmente', () => {
    const next = aplicarAjuste(estadoInicialCuota(), 'wan3.0-video', 12);
    expect(next['wan3.0-video'].restantes).toBe(12);
  });

  it('recorta valores por encima del total y por debajo de 0', () => {
    expect(aplicarAjuste(estadoInicialCuota(), 'wan3.0-video', 99)['wan3.0-video'].restantes).toBe(
      30,
    );
    expect(aplicarAjuste(estadoInicialCuota(), 'wan3.0-video', -5)['wan3.0-video'].restantes).toBe(0);
  });
});

describe('clampCuota', () => {
  it('trunca decimales y gestiona valores no finitos', () => {
    expect(clampCuota(12.9, 30)).toBe(12);
    expect(clampCuota(Number.NaN, 30)).toBe(0);
    expect(clampCuota(Number.POSITIVE_INFINITY, 30)).toBe(0);
  });
});

describe('normalizarMapaCuota', () => {
  it('rellena modelos ausentes y recorta valores corruptos', () => {
    const normalizado = normalizarMapaCuota({
      'wan3.0-video': { restantes: 7 },
      'wan3.0-video-prime': { restantes: 500 },
    });
    expect(normalizado['wan3.0-video'].restantes).toBe(7);
    expect(normalizado['wan3.0-video-prime'].restantes).toBe(30);
  });

  it('devuelve el inicial ante datos inservibles', () => {
    expect(normalizarMapaCuota(null)['wan3.0-video'].restantes).toBe(30);
    expect(normalizarMapaCuota('basura')['wan3.0-video-prime'].restantes).toBe(30);
    expect(normalizarMapaCuota(undefined)['wan3.0-video'].restantes).toBe(30);
  });
});

describe('cuotaCaducada', () => {
  it('no caduca antes del último día válido', () => {
    expect(cuotaCaducada('2026-11-04', new Date(2026, 9, 1))).toBe(false);
  });

  it('sigue válida durante el último día (inclusive)', () => {
    expect(cuotaCaducada('2026-11-04', new Date(2026, 10, 4, 23, 59, 59))).toBe(false);
  });

  it('caduca a partir del día siguiente', () => {
    expect(cuotaCaducada('2026-11-04', new Date(2026, 10, 5, 0, 0, 1))).toBe(true);
    expect(cuotaCaducada('2026-11-04', new Date(2027, 0, 1))).toBe(true);
  });

  it('un formato desconocido nunca se considera caducado', () => {
    expect(cuotaCaducada('no-es-fecha', new Date(2030, 0, 1))).toBe(false);
    expect(cuotaCaducada('', new Date(2030, 0, 1))).toBe(false);
  });
});

describe('formatearFechaCorta', () => {
  it('formatea en español corto: "4 nov 2026"', () => {
    expect(formatearFechaCorta('2026-11-04')).toBe('4 nov 2026');
    expect(formatearFechaCorta('2026-11-20')).toBe('20 nov 2026');
  });

  it('devuelve el texto original si no es una fecha válida', () => {
    expect(formatearFechaCorta('basura')).toBe('basura');
  });
});
