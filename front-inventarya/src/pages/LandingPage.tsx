import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Chip,
  Accordion,
  AccordionItem,
  Skeleton,
} from '@nextui-org/react';
import {
  LuStore,
  LuBarChart3,
  LuUsers,
  LuLayers,
  LuCheckCircle2,
  LuShieldCheck,
  LuTrendingUp,
  LuWarehouse,
  LuLaptop,
  LuCheck,
  LuWrench,
  LuRefreshCw,
  LuPhone,
  LuMail,
  LuArrowRight,
  LuSmartphone,
  LuReceipt,
  LuClock,
  LuSparkles,
  LuZap,
} from 'react-icons/lu';
import { FaWhatsapp, FaBarcode } from 'react-icons/fa6';
import { getLandingData } from '@/api/landing/landingApi';
import { IConfiguration, ILandingPlan, IFaq, ICarousel } from '@/interface/landing.interface';
import { LandingBottomBar, scrollToSection } from '@/components/navbar/LandingWebappMenu';
import { TenantSearchSection } from '@/components/landing/TenantSearchSection';
import { LandingPlanCard } from '@/components/landing/LandingPlanCard';
import { HeroCarousel } from '@/components/carousel/HeroCarousel';
import { useSeo } from '@/hooks/useSeo';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [config, setConfig] = useState<IConfiguration | null>(null);
  const [plans, setPlans] = useState<ILandingPlan[]>([]);
  const [faqs, setFaqs] = useState<IFaq[]>([]);
  const [carousels, setCarousels] = useState<ICarousel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchData = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await getLandingData();
      if (!data || !data.configuration) { setIsError(true); return; }
      setConfig(data.configuration);
      setPlans(data.plans || []);
      setFaqs(data.faqs || []);
      setCarousels(data.carousels || []);
    } catch (err) {
      console.error('Error fetching landing data:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openWhatsApp = (customMessage?: string) => {
    const rawPhone = config?.phone;
    const cleanPhone = rawPhone?.replace(/[^0-9]/g, '');
    const brandName = config?.name || 'Inventarya';
    const message =
      customMessage ||
      `¡Hola! 👋 Quisiera solicitar más información y una demostración personalizada del Sistema de Inventarios ${brandName}.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.location.href = url;
  };

  const handlePlanWhatsApp = (plan: ILandingPlan) => {
    const brandName = config?.name || 'Inventarya';
    const priceText = `${plan.price} USD / mes · ${plan.yearly_price} USD / año`;
    const storesText =
      plan.max_stores === null || plan.max_stores === undefined || plan.max_stores >= 999
        ? 'Ilimitadas' : `${plan.max_stores}`;
    const usersText =
      plan.max_users === null || plan.max_users === undefined || plan.max_users >= 999
        ? 'Ilimitados' : `${plan.max_users}`;
    const message = `¡Hola! 👋 Vengo de la plataforma *${brandName} - Sistema de Inventarios*.\nEstoy interesado en adquirir o activar el *Plan ${plan.name}* (${priceText}).\nIncluye: ${storesText} sucursales, ${usersText} usuarios y ${plan.trial_days} días de prueba gratuita.\n¿Podrían asesorarme para comenzar de inmediato?`;
    openWhatsApp(message);
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    faqs.forEach((f) => { if (f.category) cats.add(f.category); });
    return ['all', ...Array.from(cats)];
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    if (selectedCategory === 'all') return faqs;
    return faqs.filter((f) => f.category === selectedCategory);
  }, [faqs, selectedCategory]);

  const brandName = config?.name || 'Inventarya';
  const brandDescription =
    config?.description ||
    'Plataforma integral cloud para controlar inventarios, almacenes, sucursales y ventas con terminal POS táctil en tiempo real. Optimizado para Web y Android.';

  const structuredData = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://inventarya.com';
    const schemas: Record<string, unknown>[] = [
      {
        '@context': 'https://schema.org', '@type': 'Organization', name: brandName,
        url: `${origin}/`, logo: config?.logo || `${origin}/favicon.ico`,
        email: config?.email || undefined, telephone: config?.phone || undefined,
        sameAs: ['https://facebook.com', 'https://instagram.com'],
      },
      {
        '@context': 'https://schema.org', '@type': 'WebSite',
        name: `${brandName} - Sistema de Inventarios y POS`, url: `${origin}/`,
        inLanguage: 'es-BO',
        potentialAction: { '@type': 'SearchAction', target: `${origin}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
      },
      {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: brandName,
        applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android (Capacitor)',
        description: brandDescription, url: `${origin}/`,
        offers: plans.length > 0 ? {
          '@type': 'AggregateOffer', lowPrice: String(plans[0]?.price || 0),
          priceCurrency: 'USD', offerCount: plans.length,
        } : undefined,
      },
    ];
    if (faqs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.slice(0, 10).map((faq) => ({
          '@type': 'Question', name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      });
    }
    return schemas;
  }, [brandDescription, brandName, config?.email, config?.logo, config?.phone, faqs, plans]);

  useSeo({
    title: `${brandName} — Sistema de Inventarios, Múltiples Almacenes y Punto de Venta POS Cloud`,
    description: brandDescription,
    path: '/',
    siteName: brandName,
    image: config?.logo || '/favicon.ico',
    structuredData,
  });

  // ─── ERROR STATE ───────────────────────────────────────────────
  if (isError) {
    return (
      <main className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 rounded-3xl bg-danger-50 dark:bg-danger-900/20 text-danger border border-danger-200 dark:border-danger-800 mb-5 animate-pulse">
          <LuWrench className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Sistema en Mantenimiento</h1>
        <p className="text-default-500 text-sm max-w-md mt-3 leading-relaxed">
          No pudimos conectar con la base de datos central. Por favor, reintenta en unos instantes.
        </p>
        <Button
          color="primary" variant="flat" className="mt-6 font-bold"
          startContent={<LuRefreshCw className="w-4 h-4" />} onPress={fetchData}
        >
          Reintentar conexión
        </Button>
      </main>
    );
  }

  // ─── SKELETON LOADER ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-5/6 rounded-xl" />
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <div className="flex gap-3 mt-1">
              <Skeleton className="h-10 w-32 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <main className="text-foreground bg-background selection:bg-primary selection:text-primary-foreground overflow-x-hidden pb-16 md:pb-8">

      {/* ═══════════════════════════════════════════════════════════
          HERO — Carrusel 16:7, sin desbordamiento
      ═══════════════════════════════════════════════════════════ */}
      <section
        id="inicio"
        className="scroll-mt-0 w-full max-w-[100vw] overflow-hidden"
      >
        {/* ── Mobile (< lg): carousel full-width 16:7, then text below ── */}
        <div className="flex flex-col lg:hidden">
          {/* Carousel: full width, ratio drives height automatically */}
          <div className="w-full">
            <HeroCarousel slides={carousels} />
          </div>

          {/* Text panel below */}
          <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold w-fit">
              <LuSparkles className="w-3 h-3 animate-pulse" />
              <span>SaaS Cloud · Web & Android 2026</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground leading-[1.1]">
              Control de <span className="text-primary">Inventarios</span>,
              Sucursales y{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">POS Táctil</span>
            </h1>
            <p className="text-xs text-default-500 leading-relaxed line-clamp-3">
              {brandDescription}
            </p>

            {/* Feature chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: <LuZap className="w-3 h-3" />, label: 'POS Real' },
                { icon: <LuShieldCheck className="w-3 h-3" />, label: 'Roles' },
                { icon: <LuTrendingUp className="w-3 h-3" />, label: 'Kardex' },
                { icon: <FaBarcode className="w-3 h-3" />, label: 'Barras' },
              ].map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-content1 border border-divider text-[10px] font-bold text-foreground">
                  {c.icon}{c.label}
                </span>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm" color="primary" className="font-bold flex-1 min-w-[120px] shadow-md shadow-primary/20"
                onPress={() => scrollToSection('planes')} endContent={<LuArrowRight className="w-3.5 h-3.5" />}
              >
                Ver Planes
              </Button>
              <Button
                size="sm" variant="flat" color="secondary"
                className="font-bold flex-1 min-w-[120px]" onPress={() => scrollToSection('buscar-tienda')}
                startContent={<LuStore className="w-3.5 h-3.5" />}
              >
                Mi Tienda
              </Button>
              <Button
                size="sm" variant="bordered" isIconOnly
                className="border-default-200 hover:border-success shrink-0"
                onPress={() => openWhatsApp()} aria-label="WhatsApp"
              >
                <FaWhatsapp className="w-4 h-4 text-success" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Desktop (≥ lg): 2-col split, carousel right at 16:7, text left matches height ── */}
        <div className="hidden lg:flex lg:flex-row w-full items-stretch">
          {/* Left: text panel — stretches to match carousel height */}
          <div className="flex flex-col justify-center gap-4 px-8 xl:px-12 border-r border-divider/40 flex-1 min-w-0 py-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold w-fit">
              <LuSparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>SaaS Cloud · Versión 2026</span>
              <span className="text-default-300">|</span>
              <span className="font-semibold text-default-500">Web & Android</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-foreground leading-[1.08]">
              Control Total de{' '}<span className="text-primary">Inventarios</span>,
              Sucursales y{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">POS Táctil</span>
            </h1>

            <p className="text-sm text-default-500 leading-relaxed max-w-md">
              {brandDescription}
            </p>

            {/* Feature chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: <LuZap className="w-3.5 h-3.5 text-warning" />, label: 'POS en Tiempo Real' },
                { icon: <LuShieldCheck className="w-3.5 h-3.5 text-success" />, label: 'Roles & Permisos' },
                { icon: <LuTrendingUp className="w-3.5 h-3.5 text-secondary" />, label: 'Kardex Auto' },
                { icon: <FaBarcode className="w-3.5 h-3.5 text-primary" />, label: 'Lector Barras' },
              ].map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-content1 border border-divider text-xs font-bold text-foreground">
                  {c.icon}{c.label}
                </span>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-row flex-wrap gap-2.5">
              <Button
                size="md" color="primary"
                className="font-extrabold px-6 shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                onPress={() => scrollToSection('planes')} endContent={<LuArrowRight className="w-4 h-4" />}
              >
                Ver Planes & Precios
              </Button>
              <Button
                size="md" variant="flat" color="secondary"
                className="font-bold px-5 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                onPress={() => scrollToSection('buscar-tienda')} startContent={<LuStore className="w-4 h-4" />}
              >
                Buscar mi Tienda
              </Button>
              <Button
                size="md" variant="bordered"
                className="font-bold px-5 border-default-200 hover:border-success transition-all hover:scale-[1.02]"
                onPress={() => openWhatsApp()} startContent={<FaWhatsapp className="w-4 h-4 text-success" />}
              >
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Right: carousel — width=50%, height auto from 16:7 ratio */}
          <div className="w-1/2 shrink-0 p-4 xl:p-5">
            <HeroCarousel slides={carousels} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TENANT SEARCH SECTION
      ═══════════════════════════════════════════════════════════ */}
      <TenantSearchSection />

      {/* ═══════════════════════════════════════════════════════════
          APP ANDROID / CAPACITOR SHOWCASE — compact
      ═══════════════════════════════════════════════════════════ */}
      <section className="py-10 border-y border-divider bg-gradient-to-r from-primary/5 via-content1 to-secondary/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold w-fit border border-success/20">
                <LuSmartphone className="w-4 h-4" />
                <span>Compatible con Web, Android & POS Portátil</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
                Lleva tu Punto de Venta e Inventario en tu Teléfono o Tablet
              </h2>
              <p className="text-default-500 text-sm leading-relaxed">
                Diseñado para operar fluidamente en computadoras de escritorio y terminales Android mediante Capacitor. Escanea productos con la cámara, usa lectores ópticos USB/Bluetooth e imprime tickets al instante.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { icon: <FaBarcode className="w-4 h-4 text-primary shrink-0" />, label: 'Escaneo Móvil' },
                  { icon: <LuReceipt className="w-4 h-4 text-success shrink-0" />, label: 'Tickets Térmicos' },
                  { icon: <LuClock className="w-4 h-4 text-warning shrink-0" />, label: 'Modo Offline Local' },
                  { icon: <LuSparkles className="w-4 h-4 text-secondary shrink-0" />, label: 'Cero Latencia' },
                ].map((f, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-content1 border border-divider flex items-center gap-2">
                    {f.icon}
                    <span className="text-xs font-bold text-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup */}
            <div className="p-5 rounded-3xl bg-content1 border border-divider shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-divider">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warning-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-success-400" />
                  <span className="text-xs font-bold text-default-500 ml-2">Terminal POS Android & Web</span>
                </div>
                <Chip size="sm" color="success" variant="flat" className="h-5 text-[10px] font-bold">En Línea</Chip>
              </div>
              <div className="p-3.5 rounded-2xl bg-default-100/70 border border-default-200/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Cobro Rápido en Mostrador</p>
                  <p className="text-[11px] text-default-400">Total calculado con descuentos e impuestos</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-default-400">Total Venta</p>
                  <p className="text-lg font-black text-primary">$ 145.00</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  { label: 'Caja', value: 'Abierta', color: 'text-foreground' },
                  { label: 'Lector', value: 'Activo', color: 'text-success' },
                  { label: 'Sync', value: 'Auto', color: 'text-foreground' },
                ].map((s, i) => (
                  <div key={i} className="p-2 rounded-xl bg-content2 border border-divider">
                    <p className="text-default-400 text-[10px]">{s.label}</p>
                    <p className={`font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          MÓDULOS DEL SISTEMA — Compact 3-col grid
      ═══════════════════════════════════════════════════════════ */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <Chip color="primary" variant="flat" size="sm" className="font-bold uppercase tracking-wider mb-2">
            Módulos Integrales
          </Chip>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Todo lo que tu empresa necesita en un solo software
          </h2>
          <p className="text-default-500 text-sm mt-2">
            Herramientas modulares para pequeñas, medianas y grandes empresas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <LuWarehouse className="w-5 h-5" />, color: 'bg-primary/10 text-primary',
              title: 'Almacenes & Kardex', desc: 'Registro detallado de entradas, salidas, mermas, traslados y valorización en tiempo real.',
              tag: 'Trazabilidad completa por producto',
            },
            {
              icon: <LuLaptop className="w-5 h-5" />, color: 'bg-success/10 text-success',
              title: 'POS Táctil', desc: 'Cobro ágil con lector de barras, ticketera térmica, descuentos y arqueos de caja.',
              tag: 'Cobro ultra veloz en mostrador',
            },
            {
              icon: <LuStore className="w-5 h-5" />, color: 'bg-warning/10 text-warning',
              title: 'Multi-Sucursal', desc: 'Control de distintas tiendas y bodegas con stocks independientes y sincronización central.',
              tag: 'Traslados y despachos controlados',
            },
            {
              icon: <LuBarChart3 className="w-5 h-5" />, color: 'bg-secondary/10 text-secondary',
              title: 'Reportes & Analíticas', desc: 'Márgenes de ganancia, productos de mayor rotación e historial de ventas por cajero.',
              tag: 'Exportación instantánea',
            },
            {
              icon: <LuUsers className="w-5 h-5" />, color: 'bg-danger/10 text-danger',
              title: 'Roles & Seguridad', desc: 'Permisos estrictos entre cajeros, supervisores, encargados de inventario y administradores.',
              tag: 'Protección de costos y compras',
            },
            {
              icon: <LuLayers className="w-5 h-5" />, color: 'bg-primary/10 text-primary',
              title: 'Catálogo & Barras', desc: 'Categorías multinivel, marcas, unidades y generación de etiquetas QR y barras.',
              tag: 'Etiquetado para estantes y productos',
            },
          ].map((mod, i) => (
            <Card
              key={i}
              className="border border-divider p-1.5 shadow-none rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardBody className="p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className={`w-10 h-10 rounded-xl ${mod.color} flex items-center justify-center mb-3`}>
                    {mod.icon}
                  </div>
                  <h3 className="text-sm font-extrabold text-foreground mb-1">{mod.title}</h3>
                  <p className="text-xs text-default-500 leading-relaxed">{mod.desc}</p>
                </div>
                <div className="pt-2.5 border-t border-divider flex items-center gap-2 text-xs text-default-600 font-semibold">
                  <LuCheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span>{mod.tag}</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          PLANES Y PRECIOS
      ═══════════════════════════════════════════════════════════ */}
      <section id="planes" className="scroll-mt-20 py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-divider">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <Chip color="primary" variant="flat" size="sm" className="font-bold uppercase tracking-wider mb-2">
            Planes y Precios Transparentes
          </Chip>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Elige el plan ideal para tu negocio
          </h2>
          <p className="text-default-500 text-sm mt-2">
            Todos los planes incluyen soporte técnico, actualizaciones automáticas y prueba sin compromiso.
          </p>

        </div>

        {plans.length === 0 ? (
          <div className="text-center py-10 text-default-400 text-sm">
            Actualmente se están actualizando los planes comerciales. Por favor, contáctanos directamente.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => (
              <LandingPlanCard
                key={plan.id}
                plan={plan}
                onContact={handlePlanWhatsApp}
              />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FAQS — Compact
      ═══════════════════════════════════════════════════════════ */}
      <section id="faqs" className="scroll-mt-20 py-12 bg-content2/30 border-t border-divider">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <Chip color="primary" variant="flat" size="sm" className="font-bold uppercase tracking-wider mb-2">
              Soporte y Preguntas
            </Chip>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Preguntas Frecuentes
            </h2>
            <p className="text-default-500 text-sm mt-1">
              Todo lo que necesitas saber antes de empezar.
            </p>

            {categories.length > 2 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {categories.map((cat) => (
                  <button
                    key={cat} type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${selectedCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-content1 text-default-500 hover:text-foreground border border-divider'}`}
                  >
                    {cat === 'all' ? 'Todas' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredFaqs.length === 0 ? (
            <p className="text-center text-default-400 py-6 text-sm">
              No hay preguntas frecuentes registradas actualmente.
            </p>
          ) : (
            <Accordion variant="bordered" className="gap-3">
              {filteredFaqs.map((faq) => (
                <AccordionItem
                  key={faq.id}
                  aria-label={faq.question}
                  title={<span className="text-sm font-bold text-foreground">{faq.question}</span>}
                  subtitle={faq.category ? <span className="text-[11px] text-default-400 font-medium">{faq.category}</span> : undefined}
                  className="bg-content1 border border-divider rounded-2xl px-4 py-1"
                >
                  <p className="text-default-600 text-xs sm:text-sm leading-relaxed pb-3 pt-1">{faq.answer}</p>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CONTACTO — Compact 3-col
      ═══════════════════════════════════════════════════════════ */}
      <section id="contacto" className="scroll-mt-20 py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <Chip color="primary" variant="flat" size="sm" className="font-bold uppercase tracking-wider mb-2">
            Canales de Atención
          </Chip>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Comienza a transformar tu gestión hoy
          </h2>
          <p className="text-default-500 text-sm mt-2">
            Disponibles para responder preguntas técnicas, cotizaciones y demos en vivo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="border border-divider bg-content1 shadow-none rounded-3xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <CardBody className="p-5 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <LuPhone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">Línea Telefónica</h3>
              <p className="text-xs text-default-400 mb-2">Consultas comerciales y asesoría</p>
              <p className="text-sm font-bold text-primary mb-4 select-all">{config?.phone || '+591 78901234'}</p>
              <Button
                as="a" href={`tel:${(config?.phone || '+59178901234').replace(/[^0-9+]/g, '')}`}
                variant="flat" color="primary" size="sm"
                className="w-full font-bold rounded-xl" startContent={<LuPhone className="w-4 h-4" />}
              >
                Llamar Ahora
              </Button>
            </CardBody>
          </Card>

          <Card className="border border-divider bg-content1 shadow-none rounded-3xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <CardBody className="p-5 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-2xl bg-success/10 text-success flex items-center justify-center mb-3">
                <FaWhatsapp className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">WhatsApp Directo</h3>
              <p className="text-xs text-default-400 mb-2">Atención inmediata por mensajería</p>
              <p className="text-sm font-bold text-success mb-4">Chat en Tiempo Real</p>
              <Button
                color="success" size="sm"
                className="w-full font-bold text-white shadow-sm rounded-xl"
                startContent={<FaWhatsapp className="w-4 h-4 text-white" />}
                onPress={() => openWhatsApp()}
              >
                Escribir por WhatsApp
              </Button>
            </CardBody>
          </Card>

          <Card className="border border-divider bg-content1 shadow-none rounded-3xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <CardBody className="p-5 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-3">
                <LuMail className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">Correo Electrónico</h3>
              <p className="text-xs text-default-400 mb-2">Soporte y propuestas formales</p>
              <p className="text-sm font-bold text-foreground mb-4 select-all">{config?.email || 'contacto@inventarya.com'}</p>
              <Button
                as="a"
                href={`mailto:${config?.email || 'contacto@inventarya.com'}?subject=Consulta%20sobre%20${encodeURIComponent(brandName)}`}
                variant="flat" color="secondary" size="sm"
                className="w-full font-bold rounded-xl" startContent={<LuMail className="w-4 h-4" />}
              >
                Enviar Correo
              </Button>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── WhatsApp FAB ── */}
      <div className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button" onClick={() => openWhatsApp()}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-success text-white shadow-xl hover:scale-105 active:scale-95 transition-transform duration-200 flex items-center justify-center cursor-pointer"
          aria-label="Abrir WhatsApp" title="Contactar por WhatsApp"
        >
          <FaWhatsapp className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>

      {/* ── Mobile bottom nav ── */}
      <LandingBottomBar />
    </main>
  );
};

export default LandingPage;
