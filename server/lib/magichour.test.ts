import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from './errors.js';
import {
  PREFIJO_TASK_MAGICHOUR,
  consultarEstadoMagicHour,
  crearVideoMagicHour,
  esModeloMagicHour,
  idRealMagicHour,
  mapearErrorMagicHour,
} from './magichour.js';

function respuestaJson(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function conClave(): void {
  process.env.MAGIC_HOUR_API_KEY = 'mh_test_123';
}

afterEach(() => {
  delete process.env.MAGIC_HOUR_API_KEY;
  vi.unstubAllGlobals();
});

describe('crearVideoMagicHour', () => {
  it('envía POST a /text-to-video con el cuerpo documentado y devuelve el taskId con prefijo', async () => {
    conClave();
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson({ id: 'cuid-abc', credits_charged: 450 }));
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await crearVideoMagicHour({
      prompt: 'Un perro corriendo por la playa.',
      duracion: 8,
      resolucion: '480p',
      aspecto: '16:9',
      audio: true,
    });

    expect(resultado.taskId).toBe(`${PREFIJO_TASK_MAGICHOUR}cuid-abc`);
    expect(resultado.creditosEstimados).toBe(450);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.magichour.ai/v1/text-to-video');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer mh_test_123');
    const cuerpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(cuerpo.end_seconds).toBe(8);
    expect(cuerpo.model).toBe('ltx-2.5');
    expect(cuerpo.aspect_ratio).toBe('16:9');
    expect(cuerpo.resolution).toBe('480p');
    expect(cuerpo.audio).toBe(true);
    expect((cuerpo.style as { prompt: string }).prompt).toBe('Un perro corriendo por la playa.');
  });

  it('sin MAGIC_HOUR_API_KEY lanza 500 MISSING_CONFIGURATION', async () => {
    try {
      await crearVideoMagicHour({
        prompt: 'x',
        duracion: 4,
        resolucion: '480p',
        aspecto: '16:9',
        audio: false,
      });
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).estado).toBe(500);
      expect((err as HttpError).codigo).toBe('MISSING_CONFIGURATION');
    }
  });

  it('sin id en la respuesta lanza 502 PROVIDER_ERROR', async () => {
    conClave();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson({ credits_charged: 0 })));
    try {
      await crearVideoMagicHour({
        prompt: 'x',
        duracion: 4,
        resolucion: '480p',
        aspecto: '16:9',
        audio: false,
      });
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(502);
    }
  });

  it('un 401 del proveedor se traduce a UNAUTHORIZED', async () => {
    conClave();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaJson({ message: 'Invalid API key' }, 401)),
    );
    try {
      await crearVideoMagicHour({
        prompt: 'x',
        duracion: 4,
        resolucion: '480p',
        aspecto: '16:9',
        audio: false,
      });
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(401);
      expect((err as HttpError).codigo).toBe('UNAUTHORIZED');
    }
  });
});

describe('consultarEstadoMagicHour', () => {
  it('queued → pendiente con mensaje', async () => {
    conClave();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson({ id: 'cuid-1', status: 'queued' })));
    const r = await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
    expect(r.estado).toBe('pendiente');
    expect(r.mensaje).toContain('cola');
  });

  it('rendering → procesando con mensaje', async () => {
    conClave();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson({ id: 'cuid-1', status: 'rendering' })));
    const r = await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
    expect(r.estado).toBe('procesando');
  });

  it('complete → completado con la URL de la primera descarga', async () => {
    conClave();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respuestaJson({
          id: 'cuid-1',
          status: 'complete',
          downloads: [{ url: 'https://videos.magichour.ai/cuid-1/output.mp4', expires_at: '2026-11-01T00:00:00Z' }],
        }),
      ),
    );
    const r = await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
    expect(r.estado).toBe('completado');
    expect(r.videoUrl).toBe('https://videos.magichour.ai/cuid-1/output.mp4');
  });

  it('complete sin URL lanza 502', async () => {
    conClave();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaJson({ id: 'cuid-1', status: 'complete', downloads: [] })),
    );
    try {
      await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(502);
    }
  });

  it('error → lanza 502 con el detalle del proveedor', async () => {
    conClave();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respuestaJson({ id: 'cuid-1', status: 'error', error: { message: 'Render failed' } }),
      ),
    );
    try {
      await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(502);
      expect((err as HttpError).message).toContain('Render failed');
    }
  });

  it('canceled → lanza 410', async () => {
    conClave();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson({ id: 'cuid-1', status: 'canceled' })));
    try {
      await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(410);
    }
  });

  it('estado desconocido → lanza 502', async () => {
    conClave();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaJson({ id: 'cuid-1', status: 'weird' })));
    try {
      await consultarEstadoMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-1`);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(502);
    }
  });
});

describe('idRealMagicHour', () => {
  it('extrae el id quitando el prefijo mh-', () => {
    expect(idRealMagicHour(`${PREFIJO_TASK_MAGICHOUR}cuid-xyz`)).toBe('cuid-xyz');
  });

  it('rechaza taskIds sin prefijo', () => {
    expect(() => idRealMagicHour('cuid-xyz')).toThrow(HttpError);
  });
});

describe('mapearErrorMagicHour', () => {
  it('402 → PAYMENT_REQUIRED (sin créditos)', () => {
    const err = mapearErrorMagicHour(402, { message: 'Not enough credits' });
    expect(err.estado).toBe(402);
    expect(err.codigo).toBe('PAYMENT_REQUIRED');
    expect(err.message).toContain('créditos');
  });

  it('400 → BAD_REQUEST con el detalle del proveedor', () => {
    const err = mapearErrorMagicHour(400, { message: 'Invalid end_seconds' });
    expect(err.estado).toBe(400);
    expect(err.codigo).toBe('BAD_REQUEST');
    expect(err.message).toContain('Invalid end_seconds');
  });

  it('429 → RATE_LIMITED', () => {
    const err = mapearErrorMagicHour(429, {});
    expect(err.estado).toBe(429);
    expect(err.codigo).toBe('RATE_LIMITED');
  });

  it('500 → PROVIDER_ERROR', () => {
    const err = mapearErrorMagicHour(500, {});
    expect(err.estado).toBe(502);
    expect(err.codigo).toBe('PROVIDER_ERROR');
  });
});

describe('esModeloMagicHour', () => {
  it('detecta los modelos de Magic Hour por prefijo', () => {
    expect(esModeloMagicHour('magichour/ltx-2.5')).toBe(true);
    expect(esModeloMagicHour('google/veo-3.1-fast')).toBe(false);
  });
});
