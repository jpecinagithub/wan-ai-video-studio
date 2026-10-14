# WAN AI Video Studio

Estudio serverless de generación de vídeo con inteligencia artificial: transforma
descripciones de texto en vídeos con modelos de **Pollinations** (Seedance Pro Fast de
ByteDance y Veo 3.1 Fast de Google, de pago) y de **Magic Hour** (LTX 2.5, gratuito con
créditos al registrarse, sin tarjeta).

Interfaz en **español**, mobile-first, tema oscuro, instalable como PWA. Sin cuentas de
usuario: tus prompts, favoritos e historial viven únicamente en tu dispositivo.

> **Estado de la integración con el proveedor:** integración real con **Pollinations**
> (gen.pollinations.ai) y con **Magic Hour** (api.magichour.ai), verificadas contra su
> documentación y su catálogo en vivo (2026-10-14).
>
> - **Pollinations** (pollen de pago): generación síncrona; `POST /api/video/generate`
>   devuelve el MP4 publicado o 202 para reintentar la petición idéntica sin refacturar.
> - **Magic Hour** (gratuito): generación asíncrona; `POST /api/video/generate` crea el
>   trabajo (201 + taskId) y `GET /api/video/status/:taskId` consulta su estado hasta
>   completarse. Si la generación falla, los créditos se devuelven.
>
> Por decisión expresa, este proyecto **no incluye modo demo**: solo existe el modo real.
> Las pruebas automatizadas usan respuestas simuladas del proveedor (mocks solo en tests).

## Características

- **Estudio de generación**: prompt, modelo, duración, resolución (480p / 720p / 1080p),
  relación de aspecto (16:9, 9:16), audio y semilla.
- **Dos proveedores**: Pollinations de pago (Seedance Pro Fast 2–10 s; Veo 3.1 Fast 4/6/8 s
  con audio) y Magic Hour **gratuito** (LTX 2.5: 4–30 s con audio, solo texto a vídeo).
- **Imagen a vídeo** (modelos de Pollinations): hasta 1 imagen (fotograma inicial) en
  Seedance y 2 (inicial + final) en Veo. Se comprimen en el navegador y se suben al
  almacenamiento del proveedor antes de generar.
- **Estimación de coste** en pollen antes de generar (tarifa por segundo × duración),
  siempre etiquetada como estimación. $1 ≈ 1 pollen. El modelo gratuito muestra «Gratis».
- **Reintentos y reanudación**: en Pollinations, si la generación tarda más que el
  timeout, el cliente reintente la petición idéntica sin volver a facturar; en Magic
  Hour, el cliente consulta el estado del trabajo. Puedes dejar de seguir y reanudar
  desde «Mis vídeos».
- **Biblioteca de prompts**: 30 ejemplos en 10 categorías, con favoritos locales y
  reutilización con un clic.
- **Mis vídeos**: historial local de hasta 20 vídeos con reproducción inline, descarga
  (con nombre personalizable), reutilización del prompt, «nueva versión» y eliminación en
  dos pasos. Los enlaces del almacenamiento caducan a los 30 días: la app lo indica y
  nunca promete reproducción tras la caducidad.
- **PWA instalable** con página offline honesta (generar vídeos requiere conexión).
- Telemetría mínima y anónima con Vercel Analytics: solo eventos genéricos
  (p. ej. `descarga`), nunca prompts ni URLs.

## Stack

- Vite 5 + React 18 + TypeScript + Tailwind CSS 3 + React Router 6 + lucide-react
- Backend: Vercel Functions (`api/`) con validación zod
- Persistencia local: IndexedDB para el historial de vídeos, localStorage para
  preferencias y favoritos
- Tests: Vitest · PWA: vite-plugin-pwa

## Requisitos

- Node.js 18 o superior (recomendado 20+)
- npm
- Al menos una de estas claves (puedes usar solo la gratuita):
  - **Magic Hour** (gratis): regístrate en https://magichour.ai/developer (sin tarjeta) y
    crea una API key → `MAGIC_HOUR_API_KEY`. Incluye créditos gratuitos.
  - **Pollinations** (pago): clave `sk_` en https://enter.pollinations.ai/keys →
    `POLLINATIONS_API_KEY`. El vídeo requiere Pollen de pago.
- Cuenta de Vercel (para el despliegue)

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd wan-ai-video-studio

# 2. Instalar dependencias
npm install

# 3. Copiar las variables de entorno para desarrollo local
cp .env.example .env.local
# Edita .env.local y pon tu MAGIC_HOUR_API_KEY (gratis) y/o tu POLLINATIONS_API_KEY (pago)
```

## Variables de entorno

Solo se usan en el servidor (funciones `api/`). Ninguna lleva el prefijo `VITE_`, que las
expondría en el código del cliente.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MAGIC_HOUR_API_KEY` | No* (solo servidor) | Clave gratuita de Magic Hour. Créala en magichour.ai/developer (sin tarjeta). |
| `POLLINATIONS_API_KEY` | No* (solo servidor) | Clave `sk_` de Pollinations. Créala en enter.pollinations.ai/keys. |
| `VITE_APP_NAME` | No | Nombre público de la app (visible en el cliente, no sensible). |

\* Al menos una de las dos debe estar configurada para generar vídeos.

## Desarrollo local

```bash
npm run dev
```

Abre http://localhost:5173. Las funciones de `api/` se sirven con `vercel dev`
(si tienes la CLI de Vercel) o contra el despliegue de Vercel. En desarrollo local sin la
API configurada, las llamadas al servidor devuelven el error de configuración
correspondiente (honesto, sin modo demo).

## Build

```bash
npm run build   # tsc --noEmit + vite build
```

El directorio `dist/` resultante es el que se despliega en Vercel.

## Tests

```bash
npm test           # vitest run
npm run typecheck  # tsc --noEmit
```

## Crear el repositorio en GitHub

```bash
git init
git add .
git commit -m "WAN AI Video Studio: versión inicial"
gh repo create wan-ai-video-studio --public --source=. --push
```

Nunca subas `.env.local` ni ninguna clave al repositorio (están en `.gitignore`).

## Conectar con Vercel

1. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repositorio.
2. Framework preset: **Vite**. Build command: `npm run build`. Output: `dist`.
3. Despliega. Las funciones de `api/` se despliegan automáticamente como Vercel Functions.

## Variables en Vercel (Production)

En el panel del proyecto → **Settings → Environment Variables**, añade para el entorno
**Production** (y Preview si quieres probar ramas):

- `MAGIC_HOUR_API_KEY` = tu clave gratuita de Magic Hour (para el modelo LTX 2.5)
- `POLLINATIONS_API_KEY` = tu clave `sk_` de Pollinations (para Seedance y Veo; opcional)

Tras guardarlas, **redeploy** el proyecto para que las funciones las recojan.

## Verificación de endpoints

Con el despliegue activo (sustituye `TU-DOMINIO`):

```bash
# Modelos disponibles (sin secretos)
curl https://TU-DOMINIO/api/video/models

# Límites y estado de la integración (sin secretos)
curl https://TU-DOMINIO/api/video/config
```

Ambos responden JSON sin exponer ninguna variable de entorno.

## Prueba real de generación

**Modelo gratuito (Magic Hour):**

```bash
# 1. Crear el trabajo (responde 201 con el taskId)
curl -X POST https://TU-DOMINIO/api/video/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "A dog running on the beach at sunset, cinematic.",
    "modelId": "magichour/ltx-2.5",
    "duration": 8,
    "resolution": "480p",
    "aspectRatio": "16:9",
    "audio": true
  }'

# Respuesta: { "estado": "pendiente", "taskId": "mh-...", ... }

# 2. Consultar el estado cada ~8 segundos hasta "completado"
curl https://TU-DOMINIO/api/video/status/mh-TU_TASK_ID

# 3. Cuando estado = "completado", la respuesta incluye "videoUrl"
```

**Modelo de pago (Pollinations):**

```bash
# Generar un vídeo (la respuesta puede tardar ~1 min; ante un 202,
# reintente la MISMA petición: el proveedor la retoma sin volver a facturar)
curl -X POST https://TU-DOMINIO/api/video/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "A cinematic aerial shot of a medieval castle at sunrise, slow camera movement.",
    "modelId": "bytedance/seedance-1-pro-fast",
    "duration": 8,
    "resolution": "720p",
    "aspectRatio": "16:9",
    "audio": true,
    "seed": 123456
  }'

# Respuesta 200: { "estado": "completado", "videoUrl": "https://media.pollinations.ai/…",
#   "expiraEn": "…", "costePollen": 0.2, … }
# Respuesta 202: { "estado": "procesando", "mensaje": "…" } → reintentar idéntico.
```

> La generación tarda varios minutos. El vídeo real de extremo a extremo se prueba
> tras el despliegue en Vercel, con las claves configuradas (para Pollinations además
> necesitas saldo de Pollen de pago).

Notas:

- Las URLs de vídeo del almacenamiento **caducan a los 30 días**: descarga el resultado
  en cuanto esté listo. La app muestra «Enlace válido hasta …» y avisa cuando ha caducado.
- Las peticiones fallidas **no se facturan**.

## Costes

Tarifas en **pollen por segundo de vídeo generado**, verificadas contra el catálogo en
vivo de Pollinations (2026-10-14). $1 ≈ 1 pollen (FAQ oficial).

| Modelo | 480p | 720p | 1080p | Audio |
|---|---|---|---|---|
| Seedance Pro Fast (`bytedance/seedance-1-pro-fast`) | 0,015/s | 0,025/s | 0,06/s | — |
| Veo 3.1 Fast (`google/veo-3.1-fast`) | — | 0,08/s | 0,10/s | +0,02/s |

**Fórmula**: `coste estimado ≈ duración (s) × tarifa del modelo y resolución (+ audio)`.

Ejemplos:

- 8 s, 720p, Seedance Pro Fast → 8 × 0,025 = **≈ 0,20 pollen (≈ $0,20 USD)**
- 8 s, 720p, Veo 3.1 Fast con audio → 8 × (0,08 + 0,02) = **≈ 0,80 pollen (≈ $0,80 USD)**

### Magic Hour (gratis)

Al registrarte en magichour.ai/developer (sin tarjeta) recibes créditos gratuitos y una
clave de API. El modelo **LTX 2.5** (el `default` del plan gratuito) genera clips de
4 a 30 segundos en 480p/720p/1080p con audio incluido sin coste extra. Si la generación
falla, los créditos se devuelven. Límites verificados en docs.magichour.ai (2026-10-14).

## PWA

La app es instalable (manifest + service worker generados con vite-plugin-pwa). La página
`public/offline.html` avisa de que generar vídeos requiere conexión a internet: el proceso
ocurre en la nube y no puede funcionar sin conexión.

## Estructura del proyecto

```
api/
  video/
    config.ts    # GET  /api/video/config   — límites y estado (sin secretos)
    generate.ts  # POST /api/video/generate — Pollinations: genera (200) o 202 para reintentar idéntico; Magic Hour: crea el trabajo (201 + taskId)
    status.ts    # GET  /api/video/status/:taskId — estado de un trabajo de Magic Hour
    media.ts     # POST /api/video/media    — sube una imagen de referencia
    models.ts    # GET  /api/video/models   — modelos y capacidades (sin secretos)
    download.ts  # GET  /api/video/download — proxy de descarga (lista cerrada de hosts)
server/
  lib/
    provider.ts    # Integración real con Pollinations (vídeo + almacenamiento)
    magichour.ts   # Integración real con Magic Hour (crear + consultar estado)
    validation.ts  # Esquemas zod de entrada
    errors.ts      # Errores HTTP honestos (mapeo de los proveedores)
    capabilities.ts# Modelos, validación de combinaciones, coste en pollen
src/
  pages/
    Studio.tsx      # Pantalla principal: configurar y generar
    MisVideos.tsx   # Historial local (IndexedDB), reproducir/descargar/reutilizar
    Biblioteca.tsx  # 30 prompts en 10 categorías, favoritos locales
    AcercaDe.tsx    # Qué es, modelos, costes, privacidad, autor
  components/
    Layout.tsx      # Navegación y estructura
    VideoPlayer.tsx # Reproductor de vídeo
    ui.tsx          # Botones, tarjetas, estados vacíos, banners
  constants/
    models.ts       # Ficha de los 2 modelos (precios verificados 2026-10-14)
    capabilities.ts # Límites, estimación de coste en pollen, urlVigente()
    prompts.ts      # PROMPTS y CATEGORIAS de la biblioteca
  utils/
    db.ts           # Historial de vídeos (evicción a 20 registros)
    download.ts     # Descarga directa con fallback a proxy serverless
    format.ts       # cn, formatSeconds, formatFecha, truncate
    imagenes.ts     # Compresión de imágenes de referencia en el navegador
  services/api.ts   # Cliente HTTP del frontend
  hooks/            # useGeneracion (reintentos idempotentes en Pollinations, consulta de estado en Magic Hour), useLocalStorage, useTheme
public/
  offline.html      # Página sin conexión
```

## Notas de seguridad

- **Ningún secreto lleva el prefijo `VITE_`**: todo lo que empiece por `VITE_` se incrusta
  en el bundle del cliente. La `POLLINATIONS_API_KEY` solo existe en el servidor.
- **Límite de 256 KB** en el cuerpo de `POST /api/video/generate` y **1 MB** en
  `POST /api/video/media`: las imágenes viajan como URLs ya alojadas, nunca como base64
  en la generación.
- **Idempotencia por diseño**: la petición de generación (parámetros + seed + URLs de
  imagen) es su propio identificador; reintentarla no duplica la facturación.
- El proxy de descarga solo acepta el host `media.pollinations.ai` (lista cerrada).
- Los endpoints públicos (`/models`, `/config`) **nunca devuelven secretos** ni variables
  de entorno.
- El historial de vídeos y los favoritos se guardan solo en el dispositivo del usuario
  (IndexedDB / localStorage); el servidor no persiste datos de usuario.
- La telemetría (Vercel Analytics) registra únicamente eventos genéricos
  (`descarga` con el modelo): nunca prompts ni URLs.

---

Created by Jon Peciña Iturbe · WAN AI Video Studio v0.3.0
