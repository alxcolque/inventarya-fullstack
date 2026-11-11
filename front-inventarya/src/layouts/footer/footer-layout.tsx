import { useSettingStore } from "@/modules/tenant/settings/store/settings/settings.store";
import { Button } from "@nextui-org/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isCentral } from "@/utils/tenant";
import { getImageUrl } from "@/utils";
import { LuPhone, LuMail, LuMapPin, LuShield, LuFileText, LuUserX } from "react-icons/lu";
import { FaWhatsapp, FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa6";
import { AppLogo, INVENTARYA_LOGO_PATH, INVENTARYA_FAVICON_PATH } from "@/components/branding/AppLogo";

export const FooterLayout = () => {
  const company = useSettingStore((state) => state.systemData);
  const getSystemData = useSettingStore((state) => state.getSystemData);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCentral()) {
      getSystemData();
    }
  }, [getSystemData]);

  const central = isCentral();
  const brandName = central
    ? "Inventarya"
    : company?.business_name || company?.name || "Mi Tienda";

  const brandLogo = central
    ? INVENTARYA_LOGO_PATH
    : company?.logo
    ? getImageUrl(company.logo)
    : INVENTARYA_LOGO_PATH;

  const brandDescription = central
    ? "Sistema SaaS multitenant integral de inventarios, almacenes y punto de venta en tiempo real."
    : company?.description ||
      "Portal oficial de inventario, gestión de sucursales y puntos de venta.";

  return (
    <footer className="bg-content1 border-t border-divider py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AppLogo
                src={brandLogo}
                alt={brandName}
                className="w-10 h-10 rounded-xl border border-divider p-1 bg-content2"
              />
              <span className="font-extrabold text-foreground text-lg tracking-tight">
                {brandName}
              </span>
            </div>
            <p className="text-default-500 text-xs leading-relaxed max-w-sm">
              {brandDescription}
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2.5 md:items-center">
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-bold text-foreground uppercase tracking-wider text-[11px] mb-1">
                Enlaces Rápidos
              </span>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-default-500 hover:text-primary transition-colors text-left"
              >
                Inicio / Tienda
              </button>
              <button
                type="button"
                onClick={() => navigate("/terms")}
                className="text-default-500 hover:text-primary transition-colors text-left flex items-center gap-1.5"
              >
                <LuFileText size={13} /> Términos y Condiciones
              </button>
              <button
                type="button"
                onClick={() => navigate("/policy")}
                className="text-default-500 hover:text-primary transition-colors text-left flex items-center gap-1.5"
              >
                <LuShield size={13} /> Política de Privacidad
              </button>
              <button
                type="button"
                onClick={() => navigate("/delete-account")}
                className="text-default-500 hover:text-danger transition-colors text-left flex items-center gap-1.5"
              >
                <LuUserX size={13} /> Eliminar Cuenta
              </button>
            </div>
          </div>

          {/* Contact & Socials */}
          <div className="flex flex-col gap-2.5">
            <span className="font-bold text-foreground uppercase tracking-wider text-[11px] mb-1">
              Atención y Contacto
            </span>
            <div className="flex flex-col gap-2 text-xs text-default-500">
              {company?.phone && (
                <span className="flex items-center gap-2">
                  <LuPhone size={14} className="text-primary shrink-0" />
                  {company.phone}
                </span>
              )}
              {company?.email && (
                <span className="flex items-center gap-2">
                  <LuMail size={14} className="text-primary shrink-0" />
                  {company.email}
                </span>
              )}
              {company?.address && (
                <span className="flex items-center gap-2">
                  <LuMapPin size={14} className="text-primary shrink-0" />
                  {company.address}
                </span>
              )}
              {!company?.phone && !company?.email && (
                <span className="italic text-default-400">
                  Canales de atención directa por la plataforma
                </span>
              )}
            </div>

            {/* Social icons */}
            {company?.social && (
              <div className="flex items-center gap-2 mt-2">
                {company.social.whatsapp && (
                  <Button
                    as="a"
                    href={`https://wa.me/${company.social.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    isIconOnly
                    size="sm"
                    variant="flat"
                    color="success"
                    aria-label="WhatsApp"
                  >
                    <FaWhatsapp size={15} />
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
                    aria-label="Facebook"
                  >
                    <FaFacebook size={15} />
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
                    aria-label="Instagram"
                  >
                    <FaInstagram size={15} />
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
                    aria-label="TikTok"
                  >
                    <FaTiktok size={15} />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-divider mt-8 pt-6 text-center text-xs text-default-400">
          <p>
            &copy; {new Date().getFullYear()}{" "}
            <strong className="font-semibold text-foreground">{brandName}</strong>. Todos los
            derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
