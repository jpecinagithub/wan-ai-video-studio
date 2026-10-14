import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from './errors.js';
import {
  PollinationsVideoProvider,
  decodificarDataUrl,
  readProviderEnv,
} from './provider.js';

const ENV = { apiKey: 'sk_test_123' };

function respuestaVideo(bytes: Uint8Array, status = 200): Response {
  return new Response(bytes, {
    status,
    headers: { 'Content-Type': 'video/mp4' },
  });
}

function respuestaErrorJson(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ status, success: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const entradaBase = {
  modelId: 'google/veo-3.1-fast' as const,
  prompt: 'Un castillo medieval al amanecer, plano aéreo cinematográfico.',
  duracionSegundos: 8,
  resolucion: '720p' as const,
  aspecto: '16:9' as const,
  audio: true,
  semilla: 42,
  imagenes: ['https://media.pollinations.ai/abc1', 'https://media.pollinations.ai/abc2'],
};

describe('readProviderEnv', () => {
  const originales = { ...process.env };

  beforeEach(() => {
    delete process.env.POLLINATIONS_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originales };
  });

  it('exige POLLINATIONS_API_KEY y lanza 500 MISSING_CONFIGURATION sin ella', () => {
    try {
      readProviderEnv();
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).estado).toBe(500);
      expect((err as HttpError).codigo).toBe('MISSING_CONFIGURATION');
      expect((err as HttpError).message).toContain('POLLINATIONS_API_KEY');
    }
  });

  it('devuelve la key cuando está configurada', () => {
    process.env.POLLINATIONS_API_KEY = 'sk_test_123';
    expect(readProviderEnv()).toEqual({ apiKey: 'sk_test_123' });
  });
});

describe('urlGeneracion', () => {
  it('construye la URL determinista con todos los parámetros', () => {
    const proveedor = new PollinationsVideoProvider(ENV);
    const url = new URL(proveedor.urlGeneracion(entradaBase));
    expect(url.origin + url.pathname).toBe(
      'https://gen.pollinations.ai/video/' + encodeURIComponent(entradaBase.prompt),
    );
    expect(url.searchParams.get('model')).toBe('google/veo-3.1-fast');
    expect(url.searchParams.get('duration')).toBe('8');
    expect(url.searchParams.get('resolution')).toBe('720p');
    expect(url.searchParams.get('aspectRatio')).toBe('16:9');
    expect(url.searchParams.get('audio')).toBe('true');
    expect(url.searchParams.get('seed')).toBe('42');
    expect(url.searchParams.get('image')).toBe(
      'https://media.pollinations.ai/abc1|https://media.pollinations.ai/abc2',
    );
  });

  it('omite seed e image cuando no se proporcionan', () => {
    const proveedor = new PollinationsVideoProvider(ENV);
    const url = new URL(
      proveedor.urlGeneracion({ ...entradaBase, semilla: undefined, imagenes: undefined }),
    );
    expect(url.searchParams.has('seed')).toBe(false);
    expect(url.searchParams.has('image')).toBe(false);
  });

  it('dos entradas iguales generan la misma URL (idempotencia)', () => {
    const proveedor = new PollinationsVideoProvider(ENV);
    expect(proveedor.urlGeneracion(entradaBase)).toBe(proveedor.urlGeneracion({ ...entradaBase }));
  });
});

describe('generarVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve los bytes del MP4 cuando el proveedor responde 200', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue(respuestaVideo(bytes));
    vi.stubGlobal('fetch', fetchMock);

    const proveedor = new PollinationsVideoProvider(ENV);
    const resultado = await proveedor.generarVideo(entradaBase);

    expect(resultado.estado).toBe('completado');
    if (resultado.estado === 'completado') {
      expect(Buffer.from(resultado.datos).equals(Buffer.from(bytes))).toBe(true);
      expect(resultado.contentType).toBe('video/mp4');
    }
    // La key viaja en la cabecera Authorization, nunca en la URL.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_123');
    expect(fetchMock.mock.calls[0][0] as string).not.toContain('sk_test_123');
  });

  it('un timeout propio devuelve estado procesando (el cliente reintentará)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Timeout', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);

    const proveedor = new PollinationsVideoProvider(ENV);
    const resultado = await proveedor.generarVideo(entradaBase);
    expect(resultado).toEqual({ estado: 'procesando' });
  });

  it('un fallo de red lanza 502 PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const proveedor = new PollinationsVideoProvider(ENV);
    try {
      await proveedor.generarVideo(entradaBase);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).estado).toBe(502);
    }
  });

  it('402 del proveedor → PAYMENT_REQUIRED con mención al Pollen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaErrorJson(402, 'INSUFFICIENT_POLLEN', 'Not enough pollen')),
    );
    const proveedor = new PollinationsVideoProvider(ENV);
    try {
      await proveedor.generarVideo(entradaBase);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).estado).toBe(402);
      expect((err as HttpError).codigo).toBe('PAYMENT_REQUIRED');
      expect((err as HttpError).message).toContain('Pollen');
    }
  });

  it('401 del proveedor → UNAUTHORIZED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuestaErrorJson(401, 'INVALID_KEY', 'Bad key')),
    );
    const proveedor = new PollinationsVideoProvider(ENV);
    try {
      await proveedor.generarVideo(entradaBase);
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(401);
      expect((err as HttpError).codigo).toBe('UNAUTHORIZED');
    }
  });
});

describe('subirMedio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve la URL pública del almacenamiento', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'xyz123',
          url: 'https://media.pollinations.ai/xyz123',
          contentType: 'video/mp4',
          size: 1234,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const proveedor = new PollinationsVideoProvider(ENV);
    const url = await proveedor.subirMedio(Buffer.from([1, 2, 3]), 'video/mp4', 'video-1.mp4');
    expect(url).toBe('https://media.pollinations.ai/xyz123');
    const [destino, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(destino).toBe('https://media.pollinations.ai/upload');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('video/mp4');
  });

  it('sin URL en la respuesta lanza 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'x' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const proveedor = new PollinationsVideoProvider(ENV);
    try {
      await proveedor.subirMedio(Buffer.from([1]), 'video/mp4', 'v.mp4');
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(502);
    }
  });
});

describe('decodificarDataUrl', () => {
  it('decodifica un data URI JPEG válido', () => {
    const original = Buffer.from([10, 20, 30, 40]);
    const dataUrl = `data:image/jpeg;base64,${original.toString('base64')}`;
    const { datos, contentType } = decodificarDataUrl(dataUrl);
    expect(contentType).toBe('image/jpeg');
    expect(Buffer.from(datos).equals(original)).toBe(true);
  });

  it('normaliza image/jpg a image/jpeg', () => {
    const { contentType } = decodificarDataUrl('data:image/jpg;base64,aGk=');
    expect(contentType).toBe('image/jpeg');
  });

  it('rechaza un data URI inválido con 400', () => {
    try {
      decodificarDataUrl('https://example.com/foto.jpg');
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect((err as HttpError).estado).toBe(400);
    }
  });
});
