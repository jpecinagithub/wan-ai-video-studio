import { CheckCircle2, Cpu, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { Card } from '../components/ui';
import { MODELOS } from '../constants/models';

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
        profesional. Funciona en modo real contra Alibaba Cloud Model Studio: cada generación
        consume recursos del proveedor y tarda varios minutos.
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
              El proveedor factura por segundo de vídeo generado (duración de salida × tarifa
              oficial por segundo, región Singapur). El audio no afecta al precio y las peticiones
              fallidas no se facturan. Antes de generar, el Estudio muestra una estimación.
            </p>
            <ul className="list-disc pl-5">
              <li>
                <strong className="text-ink">WAN 3.0 Video:</strong> $0,05/s (480p) · $0,10/s (720p)
                · $0,20/s (1080p)
              </li>
              <li>
                <strong className="text-ink">WAN 3.0 Video Prime:</strong> $0,068/s (480p) ·
                $0,14/s (720p) · $0,28/s (1080p)
              </li>
            </ul>
            <p>
              Ejemplo: 5 segundos en 720p con WAN 3.0 Video ≈ $0,50 USD. Además, tu cuenta
              dispone de cuota gratuita: 30 generaciones en cada modelo (vigentes hasta
              noviembre de 2026 según tu panel de Model Studio).
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
            solo en el servidor y nunca se expone en el código del cliente. La telemetría
            anónima (Vercel Analytics) registra solo eventos genéricos, nunca tus prompts ni tus
            URLs.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Smartphone className="h-5 w-5 text-accent" aria-hidden="true" /> Instalable
          </h2>
          <p className="text-sm text-muted">
            La aplicación es instalable como PWA y funciona en ordenador, tablet y móvil. Ten en
            cuenta que generar vídeos requiere conexión a internet.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" /> Estado de la
            integración
          </h2>
          <p className="text-sm text-muted">
            Integración con Alibaba Cloud Model Studio en modo real. No se ha inventado ningún
            endpoint, parámetro ni tarifa: todo proviene de la documentación oficial vigente.
          </p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-muted">Creado con esmero por</p>
          <p className="mt-1 text-lg font-bold">Created by Jon Peciña Iturbe</p>
          <p className="mt-2 text-xs text-muted">WAN AI Video Studio · versión 0.1.0</p>
        </Card>
      </div>
    </div>
  );
}
