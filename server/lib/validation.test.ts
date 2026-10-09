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

describe('GenerateVideoBodySchema: media (imágenes de referencia)', () => {
  const dataUri = (mime = 'image/jpeg', tamano = 100) =>
    `data:${mime};base64,${'A'.repeat(tamano)}`;
  const mediaValida = [{ type: 'reference_image' as const, url: dataUri() }];

  it('acepta la petición sin media (comportamiento actual intacto)', () => {
    const resultado = GenerateVideoBodySchema.safeParse(cuerpoValido);
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.media).toBeUndefined();
  });

  it('acepta hasta 10 imágenes de referencia válidas', () => {
    const media = Array.from({ length: 10 }, (_, i) => ({
      type: 'reference_image' as const,
      url: dataUri('image/png', 50 + i),
    }));
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, media });
    expect(resultado.success).toBe(true);
  });

  it('rechaza más de 10 imágenes', () => {
    const media = Array.from({ length: 11 }, () => ({
      type: 'reference_image' as const,
      url: dataUri(),
    }));
    const resultado = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, media });
    expect(resultado.success).toBe(false);
  });

  it('rechaza type distinto de reference_image', () => {
    const resultado = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      media: [{ type: 'first_frame', url: dataUri() }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza URL que no es data URI de imagen', () => {
    const resultado = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      media: [{ type: 'reference_image', url: 'https://example.com/foto.jpg' }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza MIME no soportado (gif)', () => {
    const resultado = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      media: [{ type: 'reference_image', url: dataUri('image/gif') }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza data URI con caracteres fuera del alfabeto base64', () => {
    const resultado = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      media: [{ type: 'reference_image', url: 'data:image/jpeg;base64,!!!no-base64!!!' }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza imágenes demasiado grandes', () => {
    const resultado = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      media: [{ type: 'reference_image', url: dataUri('image/jpeg', 500_000) }],
    });
    expect(resultado.success).toBe(false);
  });

  it('acepta jpeg, png, webp y bmp', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']) {
      const resultado = GenerateVideoBodySchema.safeParse({
        ...cuerpoValido,
        media: [{ type: 'reference_image', url: dataUri(mime) }],
      });
      expect(resultado.success).toBe(true);
    }
  });
});

describe('StatusQuerySchema', () => {  it('acepta un taskId válido', () => {
    expect(StatusQuerySchema.safeParse({ taskId: 'abc-123' }).success).toBe(true);
  });

  it('rechaza un taskId vacío o ausente', () => {
    expect(StatusQuerySchema.safeParse({ taskId: '' }).success).toBe(false);
    expect(StatusQuerySchema.safeParse({}).success).toBe(false);
  });
});
