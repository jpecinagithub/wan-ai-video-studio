/**
 * Compresión de imágenes de referencia en el navegador.
 *
 * Las imágenes se envían al proveedor como data URI base64 (documentación
 * oficial de Model Studio: `data:{MIME};base64,...`), así que se comprimen
 * en el cliente para no superar el límite de cuerpo de la función serverless.
 *
 * Límites oficiales del proveedor (verificados 2026-10-09):
 * JPEG/JPG/PNG (sin transparencia)/BMP/WEBP; 240–8000 px por lado;
 * aspecto ≤ 8:1; ≤ 20 MB por imagen.
 */

/** Error con mensaje en español listo para mostrar al usuario. */
export class ErrorImagen extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorImagen';
  }
}

/** Límite oficial del proveedor para la imagen original. */
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
/** Lado máximo tras redimensionar. */
export const MAX_LADO_PX = 1280;
/** Objetivo de tamaño por imagen comprimida (margen bajo el límite del body). */
export const OBJETIVO_BYTES = 300 * 1024;
/** Máximo de imágenes de referencia (límite oficial). */
export const MAX_IMAGENES_REFERENCIA = 10;

const MIME_SOPORTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
const EXTENSION_A_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

/** Comprueba que el formato está entre los aceptados por el proveedor. */
export function esFormatoSoportado(archivo: { type?: string; name?: string }): boolean {
  const mime = (archivo.type ?? '').toLowerCase();
  if (MIME_SOPORTADOS.includes(mime)) return true;
  const ext = (archivo.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  return ext in EXTENSION_A_MIME;
}

/** Valida tipo y tamaño del archivo original. Lanza ErrorImagen si no vale. */
export function validarArchivoImagen(archivo: { type?: string; name?: string; size: number }): void {
  if (!esFormatoSoportado(archivo)) {
    throw new ErrorImagen(
      `Formato no soportado (${archivo.name || 'archivo'}). Usa JPG, PNG, WEBP o BMP.`,
    );
  }
  if (archivo.size > MAX_ORIGINAL_BYTES) {
    throw new ErrorImagen(
      `La imagen supera los 20 MB permitidos (${archivo.name || 'archivo'}). Usa una imagen más pequeña.`,
    );
  }
  if (archivo.size <= 0) {
    throw new ErrorImagen('El archivo de imagen está vacío.');
  }
}

/** Dimensiones resultantes al encajar dentro de maxLado, manteniendo proporción. */
export function calcularDimensiones(
  ancho: number,
  alto: number,
  maxLado: number,
): { ancho: number; alto: number } {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    throw new ErrorImagen('La imagen no tiene dimensiones válidas.');
  }
  const escala = Math.min(1, maxLado / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

/** Tamaño aproximado en bytes de un data URI base64. */
export function bytesAproximadosDataUrl(dataUrl: string): number {
  const coma = dataUrl.indexOf(',');
  const b64 = coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

export interface ImagenComprimida {
  dataUrl: string;
  nombre: string;
  tamanoBytes: number;
}

interface FuenteImagen {
  width: number;
  height: number;
}

/** Carga el archivo como imagen decodificable (createImageBitmap o <img>). */
async function cargarFuente(archivo: Blob): Promise<{ fuente: FuenteImagen; cerrar: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(archivo);
    return { fuente: bitmap, cerrar: () => bitmap.close() };
  }
  // Fallback para navegadores sin createImageBitmap.
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ErrorImagen('No se pudo leer la imagen.'));
      el.src = url;
    });
    return { fuente: img, cerrar: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function crearLienzo(ancho: number, alto: number): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  return lienzo;
}

/**
 * Comprime una imagen: redimensiona a 1280 px máx. por lado, fondo blanco
 * (aplana transparencias PNG) y JPEG con calidad decreciente hasta
 * quedar en ≤ 300 KB. Lanza ErrorImagen con mensaje en español si falla.
 */
export async function comprimirImagen(archivo: File): Promise<ImagenComprimida> {
  validarArchivoImagen(archivo);

  let fuente: FuenteImagen | undefined;
  let cerrar: () => void = () => undefined;
  try {
    const cargada = await cargarFuente(archivo);
    fuente = cargada.fuente;
    cerrar = cargada.cerrar;

    const { ancho, alto } = calcularDimensiones(fuente.width, fuente.height, MAX_LADO_PX);
    const lienzo = crearLienzo(ancho, alto);
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new ErrorImagen('Tu navegador no permite procesar imágenes.');

    // Fondo blanco: aplana la transparencia (el proveedor no la admite).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(fuente as CanvasImageSource, 0, 0, ancho, alto);

    const calidades = [0.82, 0.7, 0.6, 0.5];
    for (const calidad of calidades) {
      const dataUrl = lienzo.toDataURL('image/jpeg', calidad);
      const tamano = bytesAproximadosDataUrl(dataUrl);
      if (tamano <= OBJETIVO_BYTES) {
        return { dataUrl, nombre: archivo.name, tamanoBytes: tamano };
      }
    }
    throw new ErrorImagen(
      `No se pudo comprimir "${archivo.name}" por debajo de 300 KB. Usa una imagen más sencilla o pequeña.`,
    );
  } catch (err) {
    if (err instanceof ErrorImagen) throw err;
    throw new ErrorImagen(`No se pudo procesar la imagen "${archivo.name}".`);
  } finally {
    cerrar();
  }
}
