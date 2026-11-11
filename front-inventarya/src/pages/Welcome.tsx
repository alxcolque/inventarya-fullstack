import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Divider,
  Skeleton,
} from "@nextui-org/react";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useNavigate } from "react-router-dom";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useSettingStore } from "@/modules/tenant/settings/store/settings/settings.store";
import { getImageUrl } from "@/utils";
import { AppLogo, INVENTARYA_LOGO_PATH, INVENTARYA_FAVICON_PATH } from "@/components/branding/AppLogo";
import { useCurrency } from "@/stores/currency/currency.store";
import {
  LuStore,
  LuLogIn,
  LuMapPin,
  LuPhone,
  LuMail,
  LuExternalLink,
  LuGlobe,
} from "react-icons/lu";
import { FaWhatsapp, FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa6";
import { useSeo } from "@/hooks/useSeo";

export const Welcome = () => {
  const token = useTenantAuthStore((state) => state.token);
  const authStatus = useTenantAuthStore((state) => state.authStatus);
  const navigate = useNavigate();

  const shops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);

  const company = useSettingStore((state) => state.systemData);
  const getSystemData = useSettingStore((state) => state.getSystemData);
  const { currency, symbol, isLoading: isCurrencyLoading } = useCurrency();

  const [isLoadingShops, setIsLoadingShops] = useState(true);

  useEffect(() => {
    getSystemData();
    getShops(token as string).finally(() => setIsLoadingShops(false));
  }, [getShops, getSystemData, token]);

  const brandName = company?.business_name || company?.name || "Nuestra Tienda";
  const brandLogo = company?.logo ? getImageUrl(company.logo) : INVENTARYA_LOGO_PATH;
  const brandDescription =
    company?.description ||
    "Bienvenido a nuestro portal oficial. Conoce nuestros puntos de venta, disponibilidad de catálogo y canales de atención directa.";

  const whatsappPhone = company?.social?.whatsapp || company?.phone;
  const whatsappClean = whatsappPhone ? whatsappPhone.replace(/[^0-9]/g, "") : "";

  const structuredData = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const sameAs = [
      company?.social?.facebook,
      company?.social?.instagram,
      company?.social?.tiktok,
    ].filter(Boolean);

    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: brandName,
        url: `${origin}/`,
        logo: brandLogo,
        email: company?.email || undefined,
        telephone: company?.phone || undefined,
        address: company?.address || undefined,
        sameAs: sameAs.length > 0 ? sameAs : undefined,
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: brandName,
        url: `${origin}/`,
        description: brandDescription,
        inLanguage: "es-BO",
      },
    ];
  }, [brandDescription, brandLogo, brandName, company]);

  useSeo({
    title: `${brandName}: Portal oficial`,
    description: brandDescription,
    path: "/",
    siteName: brandName,
    image: brandLogo,
    structuredData,
  });

  return (
    <div className="my-1 px-2 max-w-7xl mx-auto w-full flex flex-col gap-2 pb-6 animate-in fade-in duration-300">
      {/* ======================================================== */}
      {/* HERO / WELCOME BANNER                                    */}
      {/* ======================================================== */}
      <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
        <CardBody className="p-2 sm:p-3 flex flex-col md:flex-row items-center md:items-start justify-between gap-2.5">
          {/* Logo + Info */}
          <div className="flex flex-col sm:flex-row items-center md:items-start gap-2.5 text-center sm:text-left flex-1 min-w-0">
            <div className="p-1.5 rounded-xl bg-default-100 shrink-0">
              <AppLogo
                src={brandLogo}
                alt={brandName}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-contain"
              />
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  {brandName}
                </h1>
                {isCurrencyLoading ? (
                  <Chip size="sm" color="default" variant="flat" className="h-5 text-[10px] animate-pulse">
                    Cargando moneda...
                  </Chip>
                ) : currency ? (
                  <Chip size="sm" color="primary" variant="flat" className="h-5 text-[10px] font-semibold">
                    Moneda: {currency} ({symbol})
                  </Chip>
                ) : (
                  <Chip size="sm" color="default" variant="flat" className="h-5 text-[10px] font-semibold">
                    Tienda Oficial
                  </Chip>
                )}
              </div>

              <p className="text-default-500 text-xs max-w-2xl leading-normal">
                {brandDescription}
              </p>

              {/* Quick contact tags */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-0.5 text-[11px] text-default-600">
                {company?.phone && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-default-100/70">
                    <LuPhone className="text-primary shrink-0" size={12} />
                    <span>{company.phone}</span>
                  </span>
                )}
                {company?.email && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-default-100/70">
                    <LuMail className="text-primary shrink-0" size={12} />
                    <span>{company.email}</span>
                  </span>
                )}
                {company?.address && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-default-100/70">
                    <LuMapPin className="text-primary shrink-0" size={12} />
                    <span className="truncate max-w-xs">{company.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick WhatsApp Action */}
          {whatsappClean && (
            <div className="shrink-0 self-center md:self-start">
              <Button
                as="a"
                href={`https://wa.me/${whatsappClean}`}
                target="_blank"
                rel="noreferrer"
                color="success"
                variant="flat"
                size="sm"
                className="h-8 text-xs font-semibold px-3"
                startContent={<FaWhatsapp size={14} />}
              >
                WhatsApp Directo
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ======================================================== */}
      {/* STORES / PUNTOS DE VENTA SECTION                         */}
      {/* ======================================================== */}
      <div id="tiendas" className="flex flex-col gap-1.5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <LuStore className="text-primary" size={16} /> Puntos de Venta y Sucursales
            </h2>
            <p className="text-default-500 text-[11px]">
              Accede a las tiendas activas para consultar inventario o despachos.
            </p>
          </div>
          <span className="text-[10px] font-semibold text-default-500 bg-default-100/70 px-2 py-0.5 rounded-lg">
            {shops?.length || 0} sucursal(es) disponible(s)
          </span>
        </div>

        {isLoadingShops ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <Skeleton className="rounded-xl w-full h-36" />
            <Skeleton className="rounded-xl w-full h-36" />
            <Skeleton className="rounded-xl w-full h-36" />
          </div>
        ) : !shops || shops.length === 0 ? (
          <Card className="shadow-none rounded-xl bg-content1 p-4 text-center">
            <CardBody className="flex flex-col items-center justify-center gap-2 py-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <LuStore size={26} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  No hay sucursales activas registradas
                </h3>
                <p className="text-default-500 text-xs max-w-md mt-0.5">
                  Las tiendas y puntos de venta se configurarán desde el panel administrativo.
                </p>
              </div>
              <Button
                color="primary"
                size="sm"
                variant="flat"
                className="h-8 text-xs font-semibold px-3"
                startContent={<LuLogIn size={14} />}
                onPress={() => navigate(authStatus === "auth" ? "/shops" : "/login")}
              >
                {authStatus === "auth" ? "Configurar Tiendas" : "Ingresar para Configurar Tiendas"}
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {shops.map((shop) => {
              const shopImage = shop.front_image
                ? getImageUrl(shop.front_image)
                : null;

              return (
                <Card
                  key={shop.id}
                  shadow="none"
                  className="rounded-xl bg-content1 overflow-hidden transition-all duration-200 group"
                >
                  <CardHeader className="flex items-center gap-2 p-2 pb-1.5">
                    <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {shopImage ? (
                        <img
                          src={shopImage}
                          alt={shop.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <LuStore className="text-default-400" size={18} />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {shop.name}
                      </h3>
                      <p className="text-[11px] text-default-400 truncate">
                        {shop.slug ? `@${shop.slug}` : "Punto de Venta"}
                      </p>
                    </div>

                    <Chip size="sm" color="success" variant="flat" className="h-4 text-[9px] px-1 font-semibold">
                      Abierto
                    </Chip>
                  </CardHeader>

                  <Divider />

                  <CardBody className="p-2 flex flex-col gap-1 text-[11px] text-default-600">
                    <div className="flex items-start gap-1.5">
                      <LuMapPin size={13} className="text-primary shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {shop.address || "Dirección no especificada"}
                      </span>
                    </div>

                    {shop.phone && (
                      <div className="flex items-center gap-1.5 text-default-500">
                        <LuPhone size={13} className="text-primary shrink-0" />
                        <span>{shop.phone}</span>
                      </div>
                    )}
                  </CardBody>

                  <Divider />

                  <CardFooter className="p-1.5 px-2 flex justify-between items-center bg-default-100/40">
                    <span className="text-[10px] text-default-400 font-medium">
                      Atención al Cliente
                    </span>
                    <Button
                      size="sm"
                      color="primary"
                      variant="solid"
                      className="h-7 text-xs px-2.5 font-semibold"
                      endContent={<LuExternalLink size={12} />}
                      onPress={() => navigate(`/tienda/${shop.slug}`)}
                    >
                      Ingresar a Tienda
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* CONTACT & SOCIAL SECTION                                 */}
      {/* ======================================================== */}
      <div id="contacto" className="flex flex-col gap-1.5">
        <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
          <CardHeader className="p-2 pb-1 flex flex-col gap-0.5">
            <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <LuGlobe className="text-primary" size={15} /> Canales de Atención Directa
            </h3>
            <p className="text-[11px] text-default-500">
              Ponte en contacto con el equipo de {brandName}.
            </p>
          </CardHeader>

          <Divider />

          <CardBody className="p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Teléfono */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-default-100/70">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <LuPhone size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-default-400 font-medium">Llámanos o escríbenos</span>
                <span className="text-xs font-bold text-foreground truncate">
                  {company?.phone || "No especificado"}
                </span>
              </div>
            </div>

            {/* Correo */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-default-100/70">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <LuMail size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-default-400 font-medium">Correo Electrónico</span>
                <span className="text-xs font-bold text-foreground truncate">
                  {company?.email || "No especificado"}
                </span>
              </div>
            </div>

            {/* Dirección */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-default-100/70">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <LuMapPin size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-default-400 font-medium">Ubicación Principal</span>
                <span className="text-xs font-bold text-foreground truncate">
                  {company?.address || "Atención en sucursales"}
                </span>
              </div>
            </div>
          </CardBody>

          {/* Social icons if provided */}
          {company?.social && (
            <>
              <Divider />
              <CardFooter className="p-1.5 px-2 bg-default-100/40 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-semibold text-default-600">
                  Síguenos en redes sociales:
                </span>
                <div className="flex items-center gap-1.5">
                  {company.social.whatsapp && (
                    <Button
                      as="a"
                      href={`https://wa.me/${company.social.whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      isIconOnly
                      size="sm"
                      variant="flat"
                      color="success"
                      className="h-7 w-7 min-w-7"
                      aria-label="WhatsApp"
                    >
                      <FaWhatsapp size={14} />
                    </Button>
                  )}
                  {company.social.facebook && (
                    <Button
                      as="a"
                      href={company.social.facebook}
                      target="_blank"
                      isIconOnly
                      size="sm"
                      variant="flat"
                      color="primary"
                      className="h-7 w-7 min-w-7"
                      aria-label="Facebook"
                    >
                      <FaFacebook size={14} />
                    </Button>
                  )}
                  {company.social.instagram && (
                    <Button
                      as="a"
                      href={company.social.instagram}
                      target="_blank"
                      isIconOnly
                      size="sm"
                      variant="flat"
                      color="secondary"
                      className="h-7 w-7 min-w-7"
                      aria-label="Instagram"
                    >
                      <FaInstagram size={14} />
                    </Button>
                  )}
                  {company.social.tiktok && (
                    <Button
                      as="a"
                      href={company.social.tiktok}
                      target="_blank"
                      isIconOnly
                      size="sm"
                      variant="flat"
                      className="h-7 w-7 min-w-7 text-foreground"
                      aria-label="TikTok"
                    >
                      <FaTiktok size={14} />
                    </Button>
                  )}
                </div>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Welcome;
