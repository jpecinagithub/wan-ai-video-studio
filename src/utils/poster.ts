/**
 * Captura de póster (miniatura) a partir de la URL de un vídeo generado.
 *
 * Al completarse una generación se extrae un fotograma como JPEG en dataURL
 * (~10-30 KB) y se guarda junto al registro en IndexedDB, de modo que la
 * tarjeta de la galería sigue mostrando una imagen aunque la URL temporal
 * del proveedor haya caducado (24h).
 *
 * Diseñado para no romper nunca el flujo: ante CUALQUIER fallo (sin DOM,
 * error de red, CORS/tainted canvas, timeout) devuelve `null` sin lanzar.
 */

const TIMEOUT_POR_DEFECTO_MS = 15000;

/** Subconjunto del DOM que necesita la captura (inyectable en tests). */
interface DocumentoMinimo {
  createElement(tag: 'video'): HTMLVideoElement;
  createElement(tag: 'canvas'): HTMLCanvasElement;
}

/**
 * Instante (en segundos) del que se extrae el fotograma:
 * ~1s, o la mitad si el vídeo dura menos de 2s. 0 si la duración
 * no es válida (se captura el primer fotograma disponible).
 */
export function tiempoCaptura(duracionSegundos: number): number {
  if (!Number.isFinite(duracionSegundos) || duracionSegundos <= 0) return 0;
  return duracionSegundos < 2 ? duracionSegundos / 2 : 1;
}

function esperarEvento(objetivo: EventTarget, evento: string): Promise<void> {
  return new Promise<void>((resolver, rechazar) => {
    const limpiar = () => {
      objetivo.removeEventListener(evento, alCumplir);
      objetivo.removeEventListener('error', alFallar);
    };
    const alCumplir = () => {
      limpiar();
      resolver();
    };
    const alFallar = () => {
      limpiar();
      rechazar(new Error(`El vídeo emitió 'error' esperando '${evento}'.`));
    };
    objetivo.addEventListener(evento, alCumplir);
    objetivo.addEventListener('error', alFallar);
  });
}

async function intentarCaptura(
  doc: DocumentoMinimo,
  videoUrl: string,
  ancho: number,
): Promise<string | null> {
  const video = doc.createElement('video');
  // crossOrigin anónimo: si el proveedor no envía cabeceras CORS, el canvas
  // queda "tainted" y toDataURL lanza SecurityError → se captura y devuelve null.
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.setAttribute('playsinline', '');
  try {
    video.src = videoUrl;
    await esperarEvento(video, 'loadeddata');
    const instante = tiempoCaptura(video.duration);
    if (instante > 0) {
      video.currentTime = instante;
      await esperarEvento(video, 'seeked');
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || vw <= 0 || vh <= 0) return null;
    const escala = ancho / vw;
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(vw * escala));
    canvas.height = Math.max(1, Math.round(vh * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } finally {
    // Detiene la descarga en segundo plano del elemento temporal.
    video.removeAttribute('src');
  }
}

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const porTiempo = new Promise<null>((resolver) => {
    temporizador = setTimeout(() => resolver(null), ms);
  });
  const vigilada = promesa.then(
    (valor) => {
      if (temporizador !== undefined) clearTimeout(temporizador);
      return valor;
    },
    (error: unknown) => {
      if (temporizador !== undefined) clearTimeout(temporizador);
      throw error;
    },
  );
  return Promise.race([vigilada, porTiempo]);
}

/**
 * Captura un fotograma del vídeo como dataURL JPEG.
 * Nunca lanza: ante cualquier fallo devuelve `null`.
 */
export async function capturarPoster(
  videoUrl: string,
  ancho = 320,
  timeoutMs = TIMEOUT_POR_DEFECTO_MS,
): Promise<string | null> {
  try {
    const doc = (globalThis as { document?: DocumentoMinimo }).document;
    if (!doc || !videoUrl || ancho <= 0) return null;
    return await conTimeout(intentarCaptura(doc, videoUrl, ancho), timeoutMs);
  } catch {
    return null;
  }
}
