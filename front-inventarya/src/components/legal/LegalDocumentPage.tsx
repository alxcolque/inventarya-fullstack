import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button, Card, CardBody, Chip, Divider, Skeleton } from "@nextui-org/react";
import {
  LuArrowLeft,
  LuFileCheck2,
  LuFileText,
  LuMail,
  LuPrinter,
  LuShieldCheck,
} from "react-icons/lu";
import { getPublicConfiguration } from "@/api/landing/landingApi";
import type { IConfiguration } from "@/interface/landing.interface";
import { useSettingStore } from "@/modules/tenant/settings/store/settings/settings.store";
import { useSeo } from "@/hooks/useSeo";
import { isCentral } from "@/utils/tenant";

type LegalDocumentType = "terms" | "privacy";

interface LegalDocumentPageProps {
  type: LegalDocumentType;
}

interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
}

const LAST_REVIEW_DATE = "17 de septiembre de 2026";

const termsSections = (brandName: string, contactEmail: string): LegalSection[] => [
  {
    id: "acceptance",
    title: "1. Aceptación y alcance",
    paragraphs: [
      `Estos términos regulan el acceso y uso de ${brandName}, incluyendo sus módulos de inventario, almacenes, ventas, reportes y punto de venta. Al crear una cuenta o utilizar el servicio, el usuario confirma que ha leído y acepta estas condiciones.`,
      "La persona que registra una organización declara que cuenta con autorización suficiente para aceptar estas condiciones en su nombre.",
    ],
  },
  {
    id: "accounts",
    title: "2. Cuentas y seguridad",
    paragraphs: [
      "Cada usuario debe proporcionar información veraz, mantener sus credenciales bajo reserva y notificar cualquier acceso no autorizado. Las acciones realizadas desde una cuenta autenticada se consideran efectuadas por su titular hasta que se comunique un incidente de seguridad.",
      "Los administradores de cada organización son responsables de asignar roles y retirar accesos cuando una persona deja de requerirlos.",
    ],
  },
  {
    id: "service-use",
    title: "3. Uso permitido del servicio",
    paragraphs: [
      "El servicio debe utilizarse exclusivamente para actividades lícitas. No está permitido intentar vulnerar la plataforma, interferir con su disponibilidad, acceder a datos de terceros, introducir código malicioso ni utilizar recursos automatizados de forma abusiva.",
      "Podremos limitar temporalmente una cuenta cuando sea necesario para contener un riesgo de seguridad, prevenir fraude o cumplir una obligación legal.",
    ],
  },
  {
    id: "plans",
    title: "4. Planes, pagos y renovaciones",
    paragraphs: [
      "Las funciones, límites, precios y periodos de prueba dependen del plan contratado y de la propuesta comercial vigente. Los impuestos o cargos de terceros, cuando correspondan, se informarán antes de confirmar el pago.",
      "Una cancelación evita futuras renovaciones, pero no elimina de inmediato el acceso ya pagado, salvo que exista incumplimiento o se indique otra condición en la contratación.",
    ],
  },
  {
    id: "customer-data",
    title: "5. Datos y responsabilidades del cliente",
    paragraphs: [
      "La organización conserva la responsabilidad sobre la exactitud, legalidad y respaldo de la información que registra. La plataforma procesa esos datos para prestar el servicio y aplicar medidas técnicas de continuidad y seguridad.",
      "Antes de cargar información personal o comercial de terceros, el cliente debe contar con las autorizaciones que correspondan.",
    ],
  },
  {
    id: "availability",
    title: "6. Disponibilidad y mantenimiento",
    paragraphs: [
      "Trabajamos para mantener el servicio disponible y seguro. Pueden existir interrupciones por mantenimiento, actualizaciones, proveedores de infraestructura, fuerza mayor o incidentes fuera de control razonable.",
      "Cuando sea posible, los mantenimientos planificados de impacto relevante se comunicarán con anticipación.",
    ],
  },
  {
    id: "intellectual-property",
    title: "7. Propiedad intelectual",
    paragraphs: [
      `El software, diseño, marca, documentación y componentes de ${brandName} están protegidos por la normativa aplicable. El contrato concede un derecho de uso limitado, no exclusivo y no transferible mientras la cuenta permanezca habilitada.`,
    ],
  },
  {
    id: "changes-contact",
    title: "8. Cambios y contacto",
    paragraphs: [
      `Podremos actualizar estos términos para reflejar cambios funcionales, comerciales, técnicos o normativos. La versión vigente se publicará en esta página. Para consultas, escribe a ${contactEmail}.`,
    ],
  },
];

const privacySections = (brandName: string, contactEmail: string): LegalSection[] => [
  {
    id: "controller",
    title: "1. Responsable y alcance",
    paragraphs: [
      `${brandName} trata información necesaria para operar la plataforma, atender solicitudes y proteger las cuentas. Esta política explica qué información se procesa, para qué se utiliza y qué opciones tienen los usuarios.`,
    ],
  },
  {
    id: "collected-data",
    title: "2. Información que recopilamos",
    paragraphs: [
      "Podemos tratar datos de identificación y contacto, información de la organización, credenciales protegidas, registros técnicos de acceso, dispositivos, actividad dentro del servicio y comunicaciones con soporte.",
      "Los datos operativos —como productos, existencias, clientes, proveedores y ventas— son proporcionados y administrados por cada organización usuaria.",
    ],
  },
  {
    id: "purposes",
    title: "3. Finalidades del tratamiento",
    paragraphs: [
      "Utilizamos la información para autenticar usuarios, prestar las funciones contratadas, procesar operaciones, brindar soporte, enviar avisos transaccionales, prevenir fraude, diagnosticar errores y mejorar la seguridad y rendimiento del servicio.",
      "Las comunicaciones comerciales se enviarán únicamente cuando exista una base válida y podrán cancelarse mediante el mecanismo indicado en cada mensaje.",
    ],
  },
  {
    id: "sharing",
    title: "4. Proveedores y divulgación",
    paragraphs: [
      "Podemos utilizar proveedores de infraestructura, almacenamiento, correo, mensajería, analítica o procesamiento de pagos bajo obligaciones de confidencialidad y seguridad. No vendemos datos personales.",
      "La información también podrá comunicarse cuando una autoridad competente lo requiera o cuando resulte necesario para proteger derechos, seguridad e integridad del servicio.",
    ],
  },
  {
    id: "security",
    title: "5. Seguridad y conservación",
    paragraphs: [
      "Aplicamos controles técnicos y organizativos razonables, incluyendo gestión de acceso, protección de credenciales, registros de auditoría y respaldos según el servicio contratado.",
      "Conservamos la información durante el tiempo necesario para prestar el servicio, cumplir obligaciones, resolver disputas y proteger la plataforma. Después se elimina o anonimiza conforme a los ciclos operativos aplicables.",
    ],
  },
  {
    id: "rights",
    title: "6. Derechos y opciones",
    paragraphs: [
      `Los usuarios pueden solicitar acceso, corrección, actualización o eliminación de sus datos, sujeto a las obligaciones de conservación aplicables. Las solicitudes deben enviarse a ${contactEmail} e incluir información suficiente para verificar la identidad.`,
      "Las organizaciones administradoras controlan los datos operativos de sus empleados, clientes y proveedores; por ello, algunas solicitudes deben dirigirse primero a la organización correspondiente.",
    ],
  },
  {
    id: "cookies",
    title: "7. Cookies y almacenamiento local",
    paragraphs: [
      "La aplicación puede usar cookies o almacenamiento local estrictamente necesarios para mantener la sesión, recordar preferencias, reforzar la seguridad y habilitar capacidades sin conexión. Las tecnologías no esenciales deberán informarse y gestionarse según corresponda.",
    ],
  },
  {
    id: "updates-contact",
    title: "8. Actualizaciones y contacto",
    paragraphs: [
      `Esta política puede actualizarse cuando cambien nuestras prácticas o requisitos aplicables. Publicaremos la versión vigente en esta página. Para consultas de privacidad, escribe a ${contactEmail}.`,
    ],
  },
];

const isConfiguredDocument = (value: string | null | undefined): value is string => {
  if (!value || value.trim().length < 120) return false;
  return !/\.{3}\s*$/.test(value.trim());
};

const formatReviewDate = (value?: string | null): string => {
  if (!value) return LAST_REVIEW_DATE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return LAST_REVIEW_DATE;

  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

export const LegalDocumentPage = ({ type }: LegalDocumentPageProps) => {
  const central = isCentral();
  const tenantCompany = useSettingStore((state) => state.systemData);
  const getSystemData = useSettingStore((state) => state.getSystemData);
  const [centralConfig, setCentralConfig] = useState<IConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(central);

  useEffect(() => {
    if (!central) {
      void getSystemData();
      return;
    }

    let active = true;
    setIsLoading(true);
    getPublicConfiguration()
      .then((configuration) => {
        if (active) setCentralConfig(configuration);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [central, getSystemData]);

  const brandName = central
    ? centralConfig?.name || "Inventarya"
    : tenantCompany?.business_name || tenantCompany?.name || "Mi Tienda";
  const contactEmail = central
    ? centralConfig?.email || "contacto@inventarya.com"
    : tenantCompany?.email || "contacto@inventarya.com";
  const configuredText = central
    ? type === "terms"
      ? centralConfig?.terms
      : centralConfig?.privacy
    : type === "terms"
      ? tenantCompany?.terms
      : tenantCompany?.policy;
  const updatedAt = central ? centralConfig?.updated_at : tenantCompany?.updated_at;
  const isTerms = type === "terms";
  const title = isTerms ? "Términos y condiciones" : "Política de privacidad";
  const description = isTerms
    ? `Consulta las condiciones de acceso y uso de ${brandName}.`
    : `Conoce cómo ${brandName} recopila, utiliza y protege la información.`;
  const canonicalPath = isTerms ? "/terms" : "/policy";

  const sections = useMemo<LegalSection[]>(() => {
    if (isConfiguredDocument(configuredText)) {
      return [
        {
          id: "official-document",
          title: "Documento vigente",
          paragraphs: configuredText
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean),
        },
      ];
    }

    return isTerms
      ? termsSections(brandName, contactEmail)
      : privacySections(brandName, contactEmail);
  }, [brandName, configuredText, contactEmail, isTerms]);

  useSeo({
    title,
    description,
    path: canonicalPath,
    siteName: brandName,
    image: centralConfig?.logo || tenantCompany?.logo || "/branding/logo-inventarya.png",
    type: "article",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: `${typeof window !== "undefined" ? window.location.origin : ""}${canonicalPath}`,
      isPartOf: {
        "@type": "WebSite",
        name: brandName,
        url: typeof window !== "undefined" ? window.location.origin : "",
      },
      dateModified: updatedAt || "2026-09-17",
      inLanguage: "es-BO",
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-44 rounded-3xl" />
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-[520px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          as={RouterLink}
          to="/"
          variant="light"
          startContent={<LuArrowLeft size={17} />}
          className="text-default-600"
        >
          Volver al inicio
        </Button>
        <Button
          variant="flat"
          startContent={<LuPrinter size={17} />}
          onPress={() => window.print()}
        >
          Imprimir documento
        </Button>
      </div>

      <header className="relative overflow-hidden rounded-3xl border border-divider bg-content1 px-6 py-9 shadow-sm sm:px-10 sm:py-12">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-primary/10 to-transparent" />
        <div className="relative max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-2xl bg-primary/10 p-3 text-primary">
              {isTerms ? <LuFileCheck2 size={28} /> : <LuShieldCheck size={28} />}
            </span>
            <Chip color="success" variant="flat" size="sm">Documento vigente</Chip>
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-default-500 sm:text-base">
            {description} Lee este documento antes de utilizar la plataforma.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-default-400">
            <span><strong className="text-default-600">Responsable:</strong> {brandName}</span>
            <span><strong className="text-default-600">Última revisión:</strong> {formatReviewDate(updatedAt)}</span>
          </div>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="no-print space-y-4 lg:sticky lg:top-24">
          <Card className="border border-divider shadow-sm">
            <CardBody className="gap-1 p-4">
              <p className="mb-2 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-default-500">
                <LuFileText size={15} /> Contenido
              </p>
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-lg px-2 py-2 text-sm text-default-600 transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {section.title}
                </a>
              ))}
            </CardBody>
          </Card>

          <Card className="border border-primary/20 bg-primary/5 shadow-none">
            <CardBody className="gap-3 p-5">
              <span className="w-fit rounded-xl bg-primary/10 p-2 text-primary"><LuMail size={19} /></span>
              <div>
                <p className="font-semibold">¿Tienes alguna consulta?</p>
                <p className="mt-1 text-xs leading-relaxed text-default-500">Nuestro equipo puede ayudarte con este documento.</p>
              </div>
              <Button
                as="a"
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Consulta sobre ${title}`)}`}
                size="sm"
                color="primary"
                variant="flat"
              >
                {contactEmail}
              </Button>
            </CardBody>
          </Card>
        </aside>

        <article className="overflow-hidden rounded-3xl border border-divider bg-content1 shadow-sm">
          <div className="space-y-0 px-6 sm:px-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 py-8 sm:py-10">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-default-600 sm:text-[15px]">
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={`${section.id}-${paragraphIndex}`} className="whitespace-pre-line">{paragraph}</p>
                  ))}
                </div>
                {index < sections.length - 1 && <Divider className="mt-8 sm:mt-10" />}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
};
