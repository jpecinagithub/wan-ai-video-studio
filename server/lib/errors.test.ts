import { describe, expect, it } from 'vitest';
import { mapProviderError } from './errors.js';

describe('mapProviderError (Pollinations)', () => {
  it('401 → UNAUTHORIZED con mención a POLLINATIONS_API_KEY', () => {
    const err = mapProviderError(401, 'INVALID_KEY', 'Bad key');
    expect(err.estado).toBe(401);
    expect(err.codigo).toBe('UNAUTHORIZED');
    expect(err.message).toContain('POLLINATIONS_API_KEY');
    expect(err.message).toContain('Código del proveedor: INVALID_KEY.');
  });

  it('402 → PAYMENT_REQUIRED con mención al saldo de Pollen', () => {
    const err = mapProviderError(402, 'INSUFFICIENT_POLLEN', 'Not enough pollen');
    expect(err.estado).toBe(402);
    expect(err.codigo).toBe('PAYMENT_REQUIRED');
    expect(err.message).toContain('Pollen');
    expect(err.message).toContain('enter.pollinations.ai');
  });

  it('403 → FORBIDDEN', () => {
    const err = mapProviderError(403, 'FORBIDDEN_MODEL', 'No access');
    expect(err.estado).toBe(403);
    expect(err.codigo).toBe('FORBIDDEN');
  });

  it('404 → NOT_FOUND', () => {
    const err = mapProviderError(404, 'NOT_FOUND', 'No model');
    expect(err.estado).toBe(404);
    expect(err.codigo).toBe('NOT_FOUND');
  });

  it('429 → RATE_LIMITED', () => {
    const err = mapProviderError(429, 'RATE_LIMITED', 'Slow down');
    expect(err.estado).toBe(429);
    expect(err.codigo).toBe('RATE_LIMITED');
  });

  it('400 → BAD_REQUEST con el mensaje del proveedor', () => {
    const err = mapProviderError(400, 'BAD_REQUEST', 'Duration out of range');
    expect(err.estado).toBe(400);
    expect(err.codigo).toBe('BAD_REQUEST');
    expect(err.message).toContain('Duration out of range');
  });

  it('500 del proveedor → 502 PROVIDER_ERROR', () => {
    const err = mapProviderError(500, 'INTERNAL', 'Boom');
    expect(err.estado).toBe(502);
    expect(err.codigo).toBe('PROVIDER_ERROR');
  });
});
