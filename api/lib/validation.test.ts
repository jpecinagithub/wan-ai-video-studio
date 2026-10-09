import { describe, expect, it } from 'vitest';
import { GenerateVideoBodySchema, StatusQuerySchema, MODEL_IDS } from './validation.js';

const cuerpoValido = {
  prompt: 'Un castillo medieval al amanecer, plano aéreo cinematográfico.',
  modelId: 'wan3.0-video',
  duration: 5,
  resolution: '720p',
  aspectRatio: '16:9',
  audio: true,
};

describe('GenerateVideoBodySchema', () => {
  it('acepta una petición válida', () => {
    const resultado = GenerateVideoBodySchema.safeParse(cuerpoValido);
    expect(resultado.success).toBe(true);
  });

  it('acepta el segundo modelo permitido', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, modelId: 'wan3.0-video-prime' });
    expect(resultado.success).toBe(true);
  });

  it('rechaza el prompt vacío', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, prompt: '   ' });
    expect(resultado.success).toBe(false);
  });

  it('acepta un prompt de exactamente 20000 caracteres', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, prompt: 'x'.repeat(20000) });
    expect(resultado.success).toBe(true);
  });

  it('rechaza el prompt demasiado largo (20001 caracteres)', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, prompt: 'x'.repeat(20001) });
    expect(resultado.success).toBe(false);
  });

  it('acepta el ratio 21:9', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, aspectRatio: '21:9' });
    expect(resultado.success).toBe(true);
  });

  it('acepta el ratio auto', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, aspectRatio: 'auto' });
    expect(resultado.success).toBe(true);
  });

  it('rechaza un modelo fuera de la lista cerrada', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, modelId: 'otro-modelo' });
    expect(resultado.success).toBe(false);
  });

  it('rechaza duraciones fuera del rango 2–30', () => {
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 1 }).success).toBe(false);
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 31 }).success).toBe(false);
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 2.5 }).success).toBe(false);
  });

  it('rechaza resoluciones no soportadas', () => {
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, resolution: '4k' });
    expect(resultado.success).toBe(false);
  });

  it('la lista cerrada contiene exactamente los dos modelos del proyecto', () => {
    expect([...MODEL_IDS]).toEqual(['wan3.0-video', 'wan3.0-video-prime']);
  });
});

describe('StatusQuerySchema', () => {
  it('acepta un taskId válido', () => {
    expect(StatusQuerySchema.safeParse({ taskId: 'abc-123' }).success).toBe(true);
  });

  it('rechaza un taskId vacío o ausente', () => {
    expect(StatusQuerySchema.safeParse({ taskId: '' }).success).toBe(false);
    expect(StatusQuerySchema.safeParse({}).success).toBe(false);
  });
});
