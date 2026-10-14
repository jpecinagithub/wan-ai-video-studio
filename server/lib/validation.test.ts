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
  it('solo contiene los modelos de vídeo de Pollinations', () => {
    expect([...MODEL_IDS]).toEqual([
      'bytedance/seedance-1-pro-fast',
      'google/veo-3.1-fast',
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

  it('rechaza duraciones fuera de [2,10]', () => {
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 1 }).success).toBe(false);
    expect(GenerateVideoBodySchema.safeParse({ ...cuerpoValido, duration: 30 }).success).toBe(false);
  });

  it('rechaza relaciones de aspecto no soportadas por los modelos', () => {
    const parsed = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, aspectRatio: '1:1' });
    expect(parsed.success).toBe(false);
  });

  it('rechaza prompts de más de 2000 caracteres (límite de la URL)', () => {
    const parsed = GenerateVideoBodySchema.safeParse({ ...cuerpoValido, prompt: 'x'.repeat(2001) });
    expect(parsed.success).toBe(false);
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
