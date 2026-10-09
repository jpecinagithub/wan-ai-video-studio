import { describe, expect, it } from 'vitest';
import { MODELOS } from './capabilities.js';

describe('cuota gratuita en el registro de modelos', () => {
  it('expone la cuota gratuita de cada modelo (no es sensible)', () => {
    const base = MODELOS.find((m) => m.id === 'wan3.0-video');
    const prime = MODELOS.find((m) => m.id === 'wan3.0-video-prime');
    expect(base?.cuotaGratis).toEqual({ total: 30, expira: '2026-11-04' });
    expect(prime?.cuotaGratis).toEqual({ total: 30, expira: '2026-11-20' });
  });
});
