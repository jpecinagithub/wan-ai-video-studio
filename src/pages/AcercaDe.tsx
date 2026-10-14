import { CheckCircle2, Cpu, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { Card } from '../components/ui';
import { MODELOS, textoPrecioModelo } from '../constants/models';

/**
 * Página «Acerca de»: qué es la app, los modelos, los costes,
 * la privacidad y quién la ha creado.
 */
export function AcercaDe() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">Acerca de</h1>
      <p className="mb-6 text-sm text-muted sm:text-base">
        WAN AI Video Studio es un estudio de creación audiovisual con inteligencia artificial que
        transforma descripciones de texto en vídeos, con una experiencia sencilla, elegante y
        profesional. Funciona en modo real contra Pollinations: cada generación consume Pollen de
        tu cuenta y puede tardar varios minutos.
      </p>

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Cpu className="h-5 w-5 text-accent" aria-hidden="true" /> Modelos
          </h2>
          <ul className="flex flex-col gap-3 text-sm text-muted">
            {MODELOS.map((m) => (
              <li key={m.id}>
                <strong className="text-ink">{m.nombre}</strong>
                <br />
                {m.descripcion}
                <br />
                <span className="text-xs">{textoPrecioModelo(m)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Wallet className="h-5 w-5 text-accent" aria-hidden="true" /> Costes
          </h2>
          <div className="flex flex-col gap-2 text-sm text-muted">
            <p>
              Pollinations factura en <strong className="text-ink">pollen</strong> por segundo de
              vídeo generado ($1 ≈ 1 pollen, según su FAQ oficial). Las peticiones fallidas no se
              facturan. Los modelos de vídeo requieren Pollen de pago: recarga saldo en{' '}
              <span className="font-medium text-ink">enter.pollinations.ai</span>.
            </p>
            <ul className="list-disc pl-5">
              <li>
                <strong className="text-ink">Seedance Pro Fast:</strong> 0,015 pollen/s (480p) ·
                0,025 pollen/s (720p) · 0,06 pollen/s (1080p)
              </li>
              <li>
                <strong className="text-ink">Veo 3.1 Fast:</strong> 0,08 pollen/s (720p) · 0,10
                pollen/s (1080p), más 0,02 pollen/s si generas con audio
              </li>
            </ul>
            <p>
              Ejemplo: 8 segundos en 720p con Veo 3.1 y audio ≈ 0,80 pollen (≈ $0,80 USD); con
              Seedance Pro Fast ≈ 0,20 pollen (≈ $0,20 USD). Antes de generar, el Estudio muestra
              una estimación.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" /> Privacidad
          </h2>
          <p className="text-sm text-muted">
            No hay cuentas de usuario, registro ni inicio de sesión. Tus prompts, favoritos e
            historial se guardan únicamente en tu dispositivo. La clave de API del proveedor vive
            solo en el servidor y nunca se expone en el código del cliente. Las imágenes de
            referencia se alojan de forma no listada en el almacenamiento del proveedor para
            generar el vídeo y no se guardan en tu historial. La telemetría anónima (Vercel
            Analytics) registra solo eventos genéricos, nunca tus prompts ni tus URLs.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Smartphone className="h-5 w-5 text-accent" aria-hidden="true" /> Instalable
          </h2>
          <p className="text-sm text-muted">
            La aplicación es instalable como PWA y funciona en ordenador, tablet y móvil. Ten en
            cuenta que generar vídeos requiere conexión a internet. Los enlaces de los vídeos
            generados caducan a los 30 días: descárgalos antes.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" /> Estado de la
            integración
          </h2>
          <p className="text-sm text-muted">
            Integración con Pollinations (gen.pollinations.ai) en modo real. No se ha inventado
            ningún endpoint, parámetro ni tarifa: todo proviene de su documentación y de su
            catálogo en vivo.
          </p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-muted">Creado con esmero por</p>
          <p className="mt-1 text-lg font-bold">Created by Jon Peciña Iturbe</p>
          <p className="mt-2 text-xs text-muted">WAN AI Video Studio · versión 0.2.0</p>
        </Card>
      </div>
    </div>
  );
}
