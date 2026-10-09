import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from './errors.js';
import { AlibabaVideoProvider, readProviderEnv } from './provider.js';

const ENV = {
  apiKey: 'sk-test',
  region: 'ap-southeast-1',
  baseUrl: 'https://dashscope-intl.aliyuncs.com/api/v1',
};

function respuestaJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const entradaBase = {
  modelId: 'wan3.0-video' as const,
  prompt: 'Un castillo medieval al amanecer, plano aéreo cinematográfico.',
  duracionSegundos: 5,
  resolucion: '720p' as const,
  aspecto: '16:9',
  audio: true,
};

describe('readProviderEnv', () => {
  const originales = { ...process.env };

  beforeEach(() => {
    delete process.env.ALIBABA_API_KEY;
    delete process.env.ALIBABA_REGION;
    delete process.env.ALIBABA_WORKSPACE_ID;
    delete process.env.ALIBABA_API_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originales };
  });

  it('exige ALIBABA_API_KEY y lanza 500 MISSING_CONFIGURATION sin ella', () => {
    try {
      readProviderEnv();
      expect.unreachable('debería haber lanzado');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).estado).toBe(500);
      expect((err as HttpError).codigo).toBe('MISSING_CONFIGURATION');
    }
  });

  it('la base explícita ALIBABA_API_BASE_URL gana', () => {
    process.env.ALIBABA_API_KEY = 'sk-x';
    process.env.ALIBABA_API_BASE_URL = 'https://mi-proxy.example.com/dashscope/';
    const env = readProviderEnv();
    expect(env.baseUrl).toBe('https://mi-proxy.example.com/dashscope');
  });

  it('construye la URL desde ALIBABA_WORKSPACE_ID + ALIBABA_REGION', () => {
    process.env.ALIBABA_API_KEY = 'sk-x';
    process.env.ALIBABA_REGION = 'eu-central-1';
    process.env.ALIBABA_WORKSPACE_ID = 'ws123';
    const env = readProviderEnv();
    expect(env.baseUrl).toBe('https://ws123.eu-central-1.maas.aliyuncs.com/api/v1');
    expect(env.region).toBe('eu-central-1');
  });

  it('usa la URL legacy y la región por defecto si no hay nada más', () => {
    process.env.ALIBABA_API_KEY = 'sk-x';
    const env = readProviderEnv();
    expect(env.baseUrl).toBe('https://dashscope-intl.aliyuncs.com/api/v1');
    expect(env.region).toBe('ap-southeast-1');
  });
});

describe('AlibabaVideoProvider (fetch simulado)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crearTareaVideo OK: devuelve task_id con las cabeceras y el mapeo oficiales', async () => {
    const fetchMock = vi.fn(async () =>
      respuestaJson({ output: { task_id: 'task-abc', task_status: 'PENDING' }, request_id: 'req-1' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const proveedor = new AlibabaVideoProvider(ENV);

    const tarea = await proveedor.crearTareaVideo({
      ...entradaBase,
      resolucion: '480p',
      aspecto: 'auto',
      semilla: 42,
      mejoraPrompt: true,
      marcaAgua: false,
    });

    expect(tarea.taskId).toBe('task-abc');
    expect(tarea.estado).toBe('pending');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    );
    const cabeceras = init.headers as Record<string, string>;
    expect(cabeceras['X-DashScope-Async']).toBe('enable');
    expect(cabeceras['Authorization']).toBe('Bearer sk-test');
    expect(cabeceras['Content-Type']).toBe('application/json');

    const cuerpo = JSON.parse(init.body as string) as Record<string, any>;
    expect(cuerpo.model).toBe('wan3.0-video');
    expect(cuerpo.input.prompt).toBe(entradaBase.prompt);
    expect(cuerpo.parameters).toMatchObject({
      resolution: '480P', // 480p → 480P
      ratio: 'adaptive', // auto → adaptive
      duration: 5,
      audio: true,
      seed: 42,
      prompt_extend: true,
      watermark: false,
    });
  });

  it('crearTareaVideo NO envía seed/prompt_extend/watermark si no están definidos', async () => {
    const fetchMock = vi.fn(async () =>
      respuestaJson({ output: { task_id: 'task-x', task_status: 'PENDING' }, request_id: 'req-2' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const proveedor = new AlibabaVideoProvider(ENV);

    await proveedor.crearTareaVideo(entradaBase);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const params = JSON.parse(init.body as string).parameters as Record<string, unknown>;
    expect(params).not.toHaveProperty('seed');
    expect(params).not.toHaveProperty('prompt_extend');
    expect(params).not.toHaveProperty('watermark');
  });

  it('obtenerTareaVideo: transición PENDING → RUNNING → SUCCEEDED con video_url y usage', async () => {
    const respuestas = [
      respuestaJson({ output: { task_status: 'PENDING' }, request_id: 'r1' }),
      respuestaJson({ output: { task_status: 'RUNNING' }, request_id: 'r2' }),
      respuestaJson({
        output: {
          task_status: 'SUCCEEDED',
          video_url: 'https://video.aliyuncs.com/x.mp4',
          usage: { video_count: 1, duration: 5, fps: 24, ratio: '16:9' },
        },
        request_id: 'r3',
      }),
    ];
    const fetchMock = vi.fn(async () => respuestas.shift() as Response);
    vi.stubGlobal('fetch', fetchMock);
    const proveedor = new AlibabaVideoProvider(ENV);

    const t1 = await proveedor.obtenerTareaVideo('task-abc');
    expect(t1.estado).toBe('pending');

    const t2 = await proveedor.obtenerTareaVideo('task-abc');
    expect(t2.estado).toBe('processing');

    const t3 = await proveedor.obtenerTareaVideo('task-abc');
    expect(t3.estado).toBe('succeeded');
    expect(t3.videoUrl).toBe('https://video.aliyuncs.com/x.mp4');
    expect(t3.uso).toEqual({ duracion: 5, fps: 24, ratio: '16:9' });
    expect(t3.expiraEn).toBeDefined();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dashscope-intl.aliyuncs.com/api/v1/tasks/task-abc');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test');
  });

  it('obtenerTareaVideo: reintenta una vez ante un 500 y tiene éxito', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(respuestaJson({ output: { task_status: 'RUNNING' } }));
    vi.stubGlobal('fetch', fetchMock);
    const proveedor = new AlibabaVideoProvider(ENV);

    const tarea = await proveedor.obtenerTareaVideo('task-abc');
    expect(tarea.estado).toBe('processing');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('401 InvalidApiKey mapea al mensaje de región', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaJson(
          { code: 'InvalidApiKey', message: 'Invalid API-key provided.', request_id: 'r' },
          401,
        ),
      ),
    );
    const proveedor = new AlibabaVideoProvider(ENV);

    await expect(proveedor.crearTareaVideo(entradaBase)).rejects.toMatchObject({
      estado: 401,
      message:
        'La API key no es válida o no corresponde a la región configurada. Revisa ALIBABA_API_KEY y ALIBABA_REGION.',
    });
  });

  it('429 mapea a RATE_LIMITED con mensaje que invita a reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaJson({ code: 'Throttling', message: 'Request was denied due to request throttling.', request_id: 'r' }, 429),
      ),
    );
    const proveedor = new AlibabaVideoProvider(ENV);

    await expect(proveedor.obtenerTareaVideo('task-abc')).rejects.toMatchObject({
      estado: 429,
      codigo: 'RATE_LIMITED',
      message: 'Límite de peticiones alcanzado. Espera unos segundos e inténtalo de nuevo.',
    });
  });

  it('el timeout aborta la petición y devuelve 502 sin exponer la key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }),
    );
    const proveedor = new AlibabaVideoProvider(ENV);

    await expect(proveedor.crearTareaVideo(entradaBase)).rejects.toMatchObject({
      estado: 502,
      message: 'No se pudo contactar con Alibaba Cloud Model Studio.',
    });
  });

  it('UNKNOWN del proveedor (tarea caducada) se normaliza a "unknown"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaJson({ output: { task_status: 'UNKNOWN' }, request_id: 'r' })),
    );
    const proveedor = new AlibabaVideoProvider(ENV);

    const tarea = await proveedor.obtenerTareaVideo('task-vieja');
    expect(tarea.estado).toBe('unknown');
  });
});
