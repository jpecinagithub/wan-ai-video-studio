/**
 * Tipos compartidos del frontend de WAN AI Video Studio.
 * No contienen secretos ni lógica de proveedor.
 *
 * Fuente de verdad de capacidades: catálogo en vivo de Pollinations
 * (GET /video/models, verificado 2026-10-14). Precios en pollen;
 * $1 ≈ 1 pollen (FAQ oficial de Pollinations).
 */

export type VideoStatus = 'pendiente' | 'procesando' | 'completado' | 'error' | 'cancelado';

export type ModelId = 'bytedance/seedance-1-pro-fast' | 'google/veo-3.1-fast';

/** Resoluciones de la UI (cada modelo admite un subconjunto). */
export type Resolution = '480p' | '720p' | '1080p';

/**
 * Relaciones de aspecto de la UI.
 * Los modelos de vídeo de Pollinations soportan 16:9 y 9:16.
 */
export type AspectRatio = '16:9' | '9:16';

export interface GenerationRequest {
  prompt: string;
  modelId: ModelId;
  duration: number;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  audio: boolean;
  /** Semilla explícita: hace que los reintentos sean peticiones idénticas. */
  seed?: number;
  /**
   * URLs públicas https de imágenes ya alojadas (vía /api/video/media).
   * [0] = fotograma inicial, [1] = fotograma final (solo Veo).
   * No se persisten en el historial.
   */
  imageUrls?: string[];
}

/**
 * Respuesta de POST /api/video/generate.
 * - 'completado': el vídeo está listo (videoUrl pública, 30 días).
 * - 'procesando': el proveedor sigue generando; el cliente debe reintentar
 *   la petición IDÉNTICA (el proveedor la retoma sin volver a facturar).
 */
export interface GenerationResponse {
  estado: 'completado' | 'procesando';
  videoUrl?: string;
  /** Fecha ISO de caducidad estimada de la URL (30 días). */
  expiraEn?: string;
  mensaje?: string;
  /** Coste estimado en pollen (solo cuando está completado). */
  costePollen?: number;
  metadatos?: {
    modelo?: ModelId;
    nombreModelo?: string;
    duracion?: number;
    resolucion?: Resolution;
    aspecto?: AspectRatio;
  };
}

/** Indicador orientativo de velocidad de generación. */
export type SpeedHint = 'rápida' | 'muy rápida';

/** Pollen por segundo de vídeo generado, por resolución. */
export type PricePerSecond = Record<Resolution, number>;

export interface ModelCapability {
  id: ModelId;
  nombre: string;
  descripcion: string;
  caracteristicas: string[];
  velocidad: SpeedHint;
  resoluciones: Resolution[];
  resolucionDefecto: Resolution;
  /** Duraciones permitidas en segundos (lista cerrada por modelo). */
  duraciones: number[];
  duracionDefecto: number;
  /** 1 = solo fotograma inicial; 2 = inicial + final. */
  maxImagenes: number;
  /** El modelo puede generar pista de audio. */
  generaAudio: boolean;
  /** Pollen por segundo de vídeo, por resolución. */
  precioVideoPorSegundo: PricePerSecond;
  /** Pollen por segundo de audio (0 si no aplica). */
  precioAudioPorSegundo: number;
  estadoIntegracion: 'disponible';
}

export interface AppConfig {
  limites: {
    promptMax: number;
    resoluciones: Resolution[];
    relacionesAspecto: AspectRatio[];
    modelos: Array<{
      id: ModelId;
      duraciones: number[];
      resoluciones: Resolution[];
      maxImagenes: number;
    }>;
  };
  integracion: {
    estado: 'disponible';
    /** Este proyecto NO tiene modo demo por decisión expresa del usuario. */
    modoDemo: false;
    proveedor: string;
    modelos: ModelId[];
  };
}

export interface PromptExample {
  id: string;
  titulo: string;
  categoria: PromptCategory;
  descripcion: string;
  prompt: string;
}

export type PromptCategory =
  | 'Cinematográfico'
  | 'Naturaleza y paisajes'
  | 'Historia y época medieval'
  | 'Ciencia ficción'
  | 'Fantasía'
  | 'Animación'
  | 'Publicidad y productos'
  | 'Documentales'
  | 'Viajes'
  | 'Arquitectura';

export interface VideoRecord {
  id: string;
  fecha: string; // ISO
  prompt: string;
  modelId: ModelId;
  duracion: number;
  resolucion: Resolution;
  aspecto: AspectRatio;
  estado: VideoStatus;
  videoUrl?: string;
  /** Fecha ISO de caducidad estimada de la URL (30 días). */
  expiraEn?: string;
  nombre: string;
  /**
   * Solicitud exacta de generación (para reanudar el seguimiento o
   * reintentar de forma idéntica sin volver a facturar).
   */
  solicitud?: GenerationRequest;
  /** true si el usuario dejó de seguir la generación (puede seguir en el proveedor). */
  seguimientoDetenido?: boolean;
  /**
   * Miniatura JPEG en dataURL capturada al completarse (~10-30 KB).
   * Sobrevive a la caducidad de la URL (30 días). Opcional:
   * los registros anteriores a esta funcionalidad no la tienen.
   */
  poster?: string;
}
