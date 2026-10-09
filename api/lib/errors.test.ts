import { describe, expect, it } from 'vitest';
import { mapProviderError } from './errors.js';

describe('mapProviderError', () => {
  it('401 InvalidApiKey → mensaje de región', () => {
    const err = mapProviderError(401, 'InvalidApiKey', 'Invalid API-key provided.');
    expect(err.estado).toBe(401);
    expect(err.codigo).toBe('UNAUTHORIZED');
    expect(err.message).toBe(
      'La API key no es válida o no corresponde a la región configurada. Revisa ALIBABA_API_KEY y ALIBABA_REGION.',
    );
  });

  it('401 con otro código → mensaje de configuración del servidor', () => {
    const err = mapProviderError(401, 'Other', 'x');
    expect(err.estado).toBe(401);
    expect(err.message).toBe(
      'No autorizado: comprueba la configuración del servidor (región/workspace).',
    );
  });

  it('403 Unpurchased → cuota no habilitada o agotada', () => {
    const err = mapProviderError(403, 'Unpurchased', 'Service not purchased.');
    expect(err.estado).toBe(403);
    expect(err.codigo).toBe('FORBIDDEN');
    expect(err.message).toBe('El servicio no está habilitado o la cuota gratuita se ha agotado.');
  });

  it('403 FreeTierOnly → cuota no habilitada o agotada', () => {
    const err = mapProviderError(403, 'FreeTierOnly', 'Free tier only.');
    expect(err.message).toBe('El servicio no está habilitado o la cuota gratuita se ha agotado.');
  });

  it('403 genérico → mensaje de permisos del modelo', () => {
    const err = mapProviderError(403, 'AccessDenied', 'Denied.');
    expect(err.message).toBe(
      'El proveedor rechazó la petición (403). Revisa los permisos del modelo en Model Studio.',
    );
  });

  it('404 → modelo no encontrado en la región', () => {
    const err = mapProviderError(404, 'NotFound', 'Model not found.');
    expect(err.estado).toBe(404);
    expect(err.codigo).toBe('NOT_FOUND');
    expect(err.message).toBe('Modelo no encontrado en la región configurada.');
  });

  it('429 → límite de peticiones con invitación a reintentar', () => {
    const err = mapProviderError(429, 'Throttling', 'Too many requests.');
    expect(err.estado).toBe(429);
    expect(err.codigo).toBe('RATE_LIMITED');
    expect(err.message).toBe(
      'Límite de peticiones alcanzado. Espera unos segundos e inténtalo de nuevo.',
    );
  });

  it('400 InvalidParameter → adjunta el mensaje del proveedor', () => {
    const err = mapProviderError(400, 'InvalidParameter', 'duration must be between 2 and 30.');
    expect(err.estado).toBe(400);
    expect(err.codigo).toBe('BAD_REQUEST');
    expect(err.message).toBe('Parámetros no válidos: duration must be between 2 and 30.');
  });

  it('500 del proveedor → 502 con mensaje genérico', () => {
    const err = mapProviderError(500, 'InternalError', 'boom');
    expect(err.estado).toBe(502);
    expect(err.codigo).toBe('PROVIDER_ERROR');
    expect(err.message).toBe('Error interno del proveedor. Inténtalo de nuevo más tarde.');
  });
});
