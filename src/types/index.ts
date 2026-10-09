/**
 * Tipos compartidos del frontend de WAN AI Video Studio.
 * No contienen secretos ni lógica de proveedor.
 *
 * Fuente de verdad de capacidades: documentación oficial de
 * Alibaba Cloud Model Studio (verificada 2026-10-09).
 */

export type VideoStatus = 'pendiente' | 'procesando' | 'completado' | 'error' | 'cancelado';

export type ModelId = 'wan3.0-video' | 'wan3.0-video-prime';

/** Etiquetas de la UI. El backend las mapea a '480P' | '720P' | '1080P' (formato oficial). */
export type Resolution = '480p' | '720p' | '1080p';

/**
 * Relaciones de aspecto de la UI.
 * 'auto' se mapea en el backend a 'adaptive' (valor oficial).
 * El resto se envía tal cual ('16:9', '9:16', '1:1', '4:3', '3:4', '21:9').
 */
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'auto';

export interface GenerationRequest {
  prompt: string;
  modelId: ModelId;
  duration: number;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  audio: boolean;
  seed?: number;
  enhancePrompt?: boolean;
  watermark?: boolean;
  clientRequestId: string;
}

export interface GenerationResponse {
  taskId: string;
  estado: VideoStatus;
  mensaje: string;
}

export interface TaskUsage {
  duracion?: number;
  fps?: number;
  ratio?: string;
}

export interface TaskStatusResponse {
  taskId: string;
  estado: VideoStatus;
  videoUrl?: string;
  mensaje?: string;
  error?: string;
  /** Fecha ISO estimada de caducidad de la URL temporal (24h desde la finalización). */
  expiraEn?: string;
  metadatos?: {
    modelo?: ModelId;
    duracion?: number;
    resolucion?: Resolution;
    aspecto?: AspectRatio;
    uso?: TaskUsage;
  };
}

/** Indicador orientativo de velocidad de generación. */
export type SpeedHint = 'rápida' | 'muy rápida';

/**
 * Tarifas oficiales por segundo de vídeo generado (text-to-video:
 * se factura la duración de salida). Región: Singapur (scope internacional).
 * Fuente: página oficial de precios de Model Studio (2026-10-09).
 * Nota: existe un "30% de descuento por tiempo limitado" sin fecha de fin
 * publicada; se usa la tarifa de lista como estimación conservadora.
 */
export type PricePerSecond = Record<Resolution, number>;

export interface ModelCapability {
  id: ModelId;
  nombre: string;
  descripcion: string;
  caracteristicas: string[];
  velocidad: SpeedHint;
  resoluciones: Resolution[];
  duracionMin: number;
  duracionMax: number;
  /** Tarifas oficiales en USD/segundo por resolución. */
  precioPorSegundo: PricePerSecond;
  estadoIntegracion: 'disponible';
}

export interface AppConfig {
  limites: {
    promptMax: number;
    duracionMin: number;
    duracionMax: number;
    resoluciones: Resolution[];
    generacionesSimultaneas: number;
  };
  integracion: {
    estado: 'disponible';
    /** Este proyecto NO tiene modo demo por decisión expresa del usuario. */
    modoDemo: false;
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
  /** Fecha ISO de caducidad estimada de la URL temporal (24h). */
  expiraEn?: string;
  nombre: string;
  taskIdRemoto?: string;
  /** true si el usuario dejó de seguir el polling (la tarea puede seguir en el proveedor). */
  seguimientoDetenido?: boolean;
}
