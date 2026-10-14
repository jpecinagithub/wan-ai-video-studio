import { describe, expect, it } from 'vitest';
import { GenerateVideoBodySchema, MediaUploadBodySchema, MODEL_IDS } from './validation.js';

const cuerpoValido = {
  prompt: 'Un castillo medieval al amanecer, plano aéreo cinematográfico.',
  modelId: 'google/veo-3.1-fast',
  duration: 8,
  resolution: '720p',
  aspectRatio: '16:9',
  audio: true,
  seed: 123,
  imageUrls: ['https://media.pollinations.ai/abc123'],
};

describe('MODEL_IDS', () => {
  it('contiene los modelos de Pollinations y los gratuitos de Magic Hour', () => {
    expect([...MODEL_IDS]).toEqual([
      'bytedance/seedance-1-pro-fast',
      'google/veo-3.1-fast',
      'magichour/ltx-2.5',
      'magichour/minimax-h3',
    ]);
  });
});

describe('GenerateVideoBodySchema', () => {
  it('acepta un cuerpo válido completo', () => {
    const parsed = GenerateVideoBodySchema.safeParse(cuerpoValido);
    expect(parsed.success).toBe(true);
  });

  it('acepta un cuerpo mínimo (opcionales ausentes)', () => {
    const parsed = GenerateVideoBodySchema.safeParse({
      prompt: 'Hola',
      modelId: 'bytedance/seedance-1-pro-fast',
      duration: 5,
      resolution: '480p',
      aspectRatio: '9:16',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.audio).toBe(true); // default
      expect(parsed.data.seed).toBeUndefined();
      expect(parsed.data.imageUrls).toBeUndefined();
    }
  });

  it('rechaza modelos que no están en la lista cerrada', () => {
    const parsed = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, modelId: 'wan3.0-video' });
    expect(parsed.success).toBe(false);
  });

  it('acepta el modelo gratuito de Magic Hour', () => {
    const parsed = GenerateVideoBodySchema.safeParse({
      prompt: 'Un perro corriendo por la playa al atardecer.',
      modelId: 'magichour/ltx-2.5',
      duration: 30,
      resolution: '480p',
      aspectRatio: '9:16',
      audio: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('acepta prompts de hasta 5000 caracteres (Magic Hour va en JSON)', () => {
    const parsed = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      modelId: 'magichour/ltx-2.5',
      prompt: 'x'.repeat(5000),
    });
    expect(parsed.success).toBe(true);
  });

  it('rechaza prompts de más de 5000 caracteres', () => {
    const parsed = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      prompt: 'x'.repeat(5001),
    });
    expect(parsed.success).toBe(false);
  });

  it('rechaza duraciones fuera de [1,60]', () => {
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 0 }).success).toBe(false);
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 61 }).success).toBe(false);
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 30 }).success).toBe(true);
  });

  it('rechaza relaciones de aspecto no soportadas por los modelos', () => {
    const parsed = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, aspectRatio: '1:1' });
    expect(parsed.success).toBe(false);
  });

  it('el límite de 2000 caracteres de Pollinations ya no está en el esquema (lo aplica generate.ts)', () => {
    // El esquema admite hasta 5000 (Magic Hour va en JSON); el endpoint
    // /generate rechaza >2000 solo para los modelos de Pollinations.
    const parsed = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, prompt: 'x'.repeat(2001) });
    expect(parsed.success).toBe(true);
  });

  it('rechaza URLs de imagen que no sean https', () => {
    const parsed = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      imageUrls: ['http://example.com/a.jpg'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rechaza más de 2 imágenes', () => {
    const parsed = GenerateVideoBodySchema.safeParse({
      ...cuerpoValido,
      imageUrls: ['https://a.example/1.jpg', 'https://a.example/2.jpg', 'https://a.example/3.jpg'],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('MediaUploadBodySchema', () => {
  it('acepta un data URI de imagen válido', () => {
    const parsed = MediaUploadBodySchema.safeParse({
      dataUrl: 'data:image/jpeg;base64,aGk=',
    });
    expect(parsed.success).toBe(true);
  });

  it('rechaza URLs que no sean data URI', () => {
    const parsed = MediaUploadBodySchema.safeParse({
      dataUrl: 'https://example.com/foto.jpg',
    });
    expect(parsed.success).toBe(false);
  });

  it('rechaza data URIs gigantes', () => {
    const parsed = MediaUploadBodySchema.safeParse({
      dataUrl: `data:image/jpeg;base64,${'a'.repeat(500_000)}`,
    });
    expect(parsed.success).toBe(false);
  });
});
