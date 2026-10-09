import { urlDescargaProxy } from '../services/api';

/** Sanitiza un nombre de archivo: minúsculas, alfanuméricos y guiones, con extensión .mp4. */
export function sanitizarNombreArchivo(nombre: string): string {
  const sinExtension = nombre.toLowerCase().replace(/\.mp4$/, '');
  const base = sinExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const limpio = base.length > 0 ? base : 'video';
  return `${limpio}.mp4`;
}

/**
 * Descarga un vídeo MP4. Primero intenta la descarga directa del proveedor
 * (fetch → blob → enlace temporal); si falla por CORS o red, recurre al
 * proxy de la API, que reenvía el archivo en streaming. Lanza un Error con
 * mensaje en español si ninguna vía funciona.
 */
export async function descargarVideo(url: string, nombreArchivo: string): Promise<void> {
  const nombre = sanitizarNombreArchivo(nombreArchivo);

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }
    const blob = await respuesta.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const enlace = document.createElement('a');
      enlace.href = objectUrl;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    return;
  } catch (err) {
    if (typeof window === 'undefined') {
      throw new Error('No se pudo descargar el vídeo: el navegador no está disponible.');
    }
    try {
      window.location.href = urlDescargaProxy(url, nombre);
      return;
    } catch {
      throw new Error(
        'No se pudo descargar el vídeo. Comprueba tu conexión e inténtalo de nuevo.',
      );
    }
  }
}
