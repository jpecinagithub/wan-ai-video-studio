import { describe, expect, it } from 'vitest';
import { cn, formatFecha, formatSeconds, truncate } from './format.js';

describe('formatSeconds', () => {
  it('formatea segundos como m:ss', () => {
    expect(formatSeconds(5)).toBe('0:05');
    expect(formatSeconds(65)).toBe('1:05');
    expect(formatSeconds(600)).toBe('10:00');
  });

  it('nunca devuelve valores negativos', () => {
    expect(formatSeconds(-3)).toBe('0:00');
  });
});

describe('formatFecha', () => {
  it('formatea una fecha ISO en español', () => {
    const texto = formatFecha('2026-10-09T18:40:00+02:00');
    expect(texto).toContain('2026');
    expect(texto.length).toBeGreaterThan(8);
  });

  it('gestiona fechas no válidas', () => {
    expect(formatFecha('no-es-una-fecha')).toBe('Fecha no válida');
  });
});

describe('truncate', () => {
  it('recorta textos largos con elipsis', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('deja intactos los textos cortos', () => {
    expect(truncate('hola', 10)).toBe('hola');
  });
});

describe('cn', () => {
  it('une clases ignorando valores falsos', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
