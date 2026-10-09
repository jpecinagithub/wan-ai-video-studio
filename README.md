# WAN AI Video Studio

Estudio serverless de generación de vídeo con inteligencia artificial: transforma
descripciones de texto en vídeos mediante los modelos **WAN 3.0 Video** (`wan3.0-video`) y
**WAN 3.0 Video Prime** (`wan3.0-video-prime`) de **Alibaba Cloud Model Studio**.

Interfaz en **español**, mobile-first, tema oscuro, instalable como PWA. Sin cuentas de
usuario: tus prompts, favoritos e historial viven únicamente en tu dispositivo.

> **Estado de la integración con el proveedor:** integración real con **Alibaba Cloud
> Model Studio** implementada y verificada contra la documentación oficial vigente
> (2026-10-09). `POST /api/video/generate` crea tareas reales de generación asíncrona;
> `GET /api/video/status/:taskId` consulta su estado hasta completarse.
>
> Por decisión expresa, este proyecto **no incluye modo demo**: solo existe el modo real.
> Las pruebas automatizadas usan respuestas simuladas del proveedor (mocks solo en tests).

## Características

- **Estudio de generación**: prompt, modelo, duración (2–30 s), resolución
  (480p / 720p / 1080p), relación de aspecto (16:9, 21:9, 9:16, 1:1, 4:3, 3:4, auto) y audio.
- **Estimación de coste** antes de generar (tarifa oficial por segundo × duración), siempre
  etiquetada como estimación.
- **Biblioteca de prompts**: 30 ejemplos en 10 categorías, con favoritos locales y
  reutilización con un clic.
- **Mis vídeos**: historial local de hasta 20 vídeos con reproducción inline, descarga
  (con nombre personalizable), reutilización del prompt, «nueva versión» y eliminación en
  dos pasos. Los enlaces del proveedor caducan a las 24h: la app lo indica y nunca promete
  reproducción tras la caducidad.
- **Reanudación de seguimiento**: si cierras el navegador durante una generación, puedes
  retomarla desde Mis vídeos.
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
- Una cuenta de Alibaba Cloud Model Studio con cuota disponible
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
# Edita .env.local y pon tu ALIBABA_API_KEY (solo servidor)
```

## Variables de entorno

Solo se usan en el servidor (funciones `api/`). Ninguna lleva el prefijo `VITE_`, que las
expondría en el código del cliente.

| Variable | Obligatoria | Defecto | Descripción |
|---|---|---|---|
| `ALIBABA_API_KEY` | **Sí** (solo servidor) | — | Clave de API de Model Studio. Créala en la consola de Model Studio. |
| `ALIBABA_REGION` | No | `ap-southeast-1` | Región de Model Studio. |
| `ALIBABA_WORKSPACE_ID` | No | — | Workspace ID; permite construir la URL base regional. |
| `ALIBABA_API_BASE_URL` | No | — | URL base completa de la API. **Prioridad máxima**: si está definida, sustituye a la construcción por región/workspace. |
| `VITE_APP_NAME` | No | — | Nombre público de la app (visible en el cliente, no sensible). |

**Orden de resolución de la URL base**: `ALIBABA_API_BASE_URL` → (región + workspace) → región
por defecto.

⚠️ **Importante**: el modelo, la clave y la región deben pertenecer a la misma región/scope
de Alibaba Cloud: una clave creada para otra región no funcionará. Si cambias de región,
regenera la clave en esa región.

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

- `ALIBABA_API_KEY` = tu clave de Model Studio
- `ALIBABA_REGION` = `ap-southeast-1` (o tu región)
- `ALIBABA_WORKSPACE_ID` = (opcional)
- `ALIBABA_API_BASE_URL` = (opcional, prioridad máxima)

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

```bash
# 1. Crear la tarea (responde 201 con el taskId, sin esperar al vídeo)
curl -X POST https://TU-DOMINIO/api/video/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "A cinematic aerial shot of a medieval castle at sunrise, slow camera movement.",
    "modelId": "wan3.0-video",
    "duration": 5,
    "resolution": "720p",
    "aspectRatio": "16:9",
    "audio": true
  }'

# Respuesta: { "taskId": "...", "estado": "pendiente", "mensaje": "..." }

# 2. Consultar el estado cada ~15 segundos hasta "completado"
curl https://TU-DOMINIO/api/video/status/TU_TASK_ID

# 3. Cuando estado = "completado", la respuesta incluye "videoUrl"
#    (enlace temporal del proveedor, válido 24h): descárgalo cuanto antes.
```

> La generación tarda varios minutos. El vídeo real de extremo a extremo se prueba
> tras el despliegue en Vercel, con `ALIBABA_API_KEY` configurada.

Notas:

- La generación tarda **varios minutos**: consulta el estado con pausas de ~15 s.
- Las URLs de vídeo del proveedor **caducan a las 24h**: descarga el resultado en cuanto
  esté listo. La app muestra «Enlace válido hasta …» y avisa cuando ha caducado.

## Costes

Tarifas oficiales de Model Studio por segundo de vídeo generado (text-to-video: se
factura la duración de salida), región **Singapur / scope internacional**, verificadas el
2026-10-09. El audio no afecta al precio y las peticiones fallidas no se facturan.

| Modelo | 480p | 720p | 1080p |
|---|---|---|---|
| WAN 3.0 Video (`wan3.0-video`) | $0,05/s | $0,10/s | $0,20/s |
| WAN 3.0 Video Prime (`wan3.0-video-prime`) | $0,068/s | $0,14/s | $0,28/s |

**Fórmula**: `coste estimado ≈ duración (s) × tarifa del modelo y resolución`.

Ejemplos:

- 5 s, 720p, WAN 3.0 Video → 5 × $0,10 = **≈ $0,50 USD**
- 10 s, 1080p, WAN 3.0 Video Prime → 10 × $0,28 = **≈ $2,80 USD**

Existe un descuento promocional del 30% anunciado por el proveedor sin fecha de fin
publicada; la app usa la tarifa de lista como estimación conservadora. Además, cada
cuenta dispone de **cuota gratuita** (30 generaciones en cada modelo, con fecha de
caducidad visible en tu panel de Model Studio).

## PWA

La app es instalable (manifest + service worker generados con vite-plugin-pwa). La página
`public/offline.html` avisa de que generar vídeos requiere conexión a internet: el proceso
ocurre en la nube y no puede funcionar sin conexión.

## Estructura del proyecto

```
api/
  video/
    config.ts    # GET  /api/video/config   — límites y estado (sin secretos)
    generate.ts  # POST /api/video/generate — valida y crea la tarea (202 + taskId)
    models.ts    # GET  /api/video/models   — modelos y capacidades (sin secretos)
    status.ts    # GET  /api/video/status/:taskId — estado normalizado de la tarea
  lib/
    provider.ts    # Integración real con Alibaba Cloud Model Studio
    validation.ts  # Esquemas zod de entrada
    errors.ts      # Errores HTTP honestos
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
    models.ts       # Ficha de los 2 modelos (tarifas verificadas 2026-10-09)
    capabilities.ts # Límites, estimación de coste, urlVigente()
    prompts.ts      # PROMPTS y CATEGORIAS de la biblioteca
  utils/
    db.ts           # Historial de vídeos (evicción a 20 registros)
    download.ts     # Descarga directa con fallback a proxy serverless
    format.ts       # cn, formatSeconds, formatFecha, truncate
  services/api.ts   # Cliente HTTP del frontend
  hooks/            # useLocalStorage, useTheme
public/
  offline.html      # Página sin conexión
```

## Notas de seguridad

- **Ningún secreto lleva el prefijo `VITE_`**: todo lo que empiece por `VITE_` se incrusta
  en el bundle del cliente. La `ALIBABA_API_KEY` solo existe en el servidor.
- **Límite de 64 KB** en el cuerpo de `POST /api/video/generate`: peticiones mayores se
  rechazan antes de validar.
- **Idempotencia**: envía `clientRequestId` (UUID) en la generación; el servidor lo usa
  para deduplicar reintentos del cliente.
- Los endpoints públicos (`/models`, `/config`) **nunca devuelven secretos** ni variables
  de entorno.
- El historial de vídeos y los favoritos se guardan solo en el dispositivo del usuario
  (IndexedDB / localStorage); el servidor no persiste datos de usuario.
- La telemetría (Vercel Analytics) registra únicamente eventos genéricos
  (`descarga` con el modelo): nunca prompts, URLs ni identificadores de tarea.

---

Created by Jon Peciña Iturbe · WAN AI Video Studio v0.1.0
