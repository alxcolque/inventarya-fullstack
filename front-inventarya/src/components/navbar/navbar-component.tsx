import { Button, CircularProgress, Navbar, NavbarBrand, NavbarContent, Tooltip } from "@nextui-org/react";
import { UserDropdown } from "./user-dropdown";
import { useNavigate, useLocation } from "react-router-dom";
import { DarkModeSwitch } from "./darkmodeswitch";
import { useEffect } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useEcho } from "@/hooks/echo";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";
import { useSettingStore } from "@/modules/tenant/settings/store/settings/settings.store";
import { isCentral, getCentralUrl, getTenantSlug } from "@/utils/tenant";
import { getImageUrl } from "@/utils";
import { BurguerButton } from "./burguer-button";
import { LandingNavbarMenu } from "./LandingWebappMenu";
import { LuGlobe } from "react-icons/lu";
import { AppLogo, INVENTARYA_LOGO_PATH, INVENTARYA_FAVICON_PATH } from "@/components/branding/AppLogo";

/**
 * NavbarComponent — Top navigation bar.
 */
export const NavbarComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Pick store based on domain
  const tAuth = useTenantAuthStore();
  const cAuth = useCentralAuthStore();

  const authStatus = isCentral() ? cAuth.authStatus : tAuth.authStatus;
  const checkAuthStatus = isCentral() ? cAuth.checkAuthStatus : tAuth.checkAuthStatus;
  const company = useSettingStore(state => state.systemData);
  const { status: realtimeStatus } = useEcho();
  const getSystemData = useSettingStore(state => state.getSystemData);

  useEffect(() => {
    if (!isCentral()) {
      getSystemData();
    }
  }, [getSystemData]);

  if (authStatus === 'pending') {
    checkAuthStatus();
    return (
      <div className="w-full flex items-center justify-center p-4">
        <CircularProgress size="sm" />
      </div>
    );
  }

  const central = isCentral();
  const isCentralLanding = central && (location.pathname === '/' || location.pathname === '/landing');
  const isTenantHome = !central && location.pathname === '/';

  const tenantSlug = getTenantSlug();
  const brandName = central
    ? "Inventarya"
    : (company?.business_name && company.business_name !== 'Inventarya Sucursal')
      ? company.business_name
      : (company?.name && company.name !== 'Inventarya Sucursal')
        ? company.name
        : tenantSlug || company?.business_name || "Mi Tienda";

  const brandLogo = central
    ? INVENTARYA_LOGO_PATH
    : company?.logo && company.logo !== INVENTARYA_LOGO_PATH && company.logo !== '/logo.png' && company.logo !== 'logo.png'
      ? getImageUrl(company.logo)
      : INVENTARYA_LOGO_PATH;
  const realtimeLabel = realtimeStatus === 'connected'
    ? 'Conectado'
    : realtimeStatus === 'connecting'
      ? 'Conectando...'
      : 'Desconectado';
  const realtimeColor = realtimeStatus === 'connected'
    ? 'bg-success'
    : realtimeStatus === 'connecting'
      ? 'bg-warning animate-pulse'
      : 'bg-danger';



  return (
    <Navbar
      isBordered
      className="w-full bg-background/80 backdrop-blur-md z-[20]"
      classNames={{ wrapper: "w-full max-w-full px-4 sm:px-6" }}
    >
      {/* Mobile brand & toggle */}
      <NavbarContent className="md:hidden">
        <BurguerButton />
        <NavbarBrand className="flex ml-2 cursor-pointer" onClick={() => navigate('/')}>
          <AppLogo src={brandLogo} alt={brandName} className="w-8 h-8" />
          <p className="font-bold text-inherit uppercase ml-2 text-sm tracking-tight">{brandName}</p>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop brand */}
      <NavbarContent className="max-md:hidden" justify="start">
        <NavbarBrand
          className="cursor-pointer hover:opacity-80 gap-2.5"
          onClick={() => navigate('/')}
        >
          <AppLogo src={brandLogo} alt={brandName} className="w-9 h-9 rounded-lg" />
          <p className="font-bold text-inherit uppercase tracking-tight">{brandName}</p>
        </NavbarBrand>
      </NavbarContent>

      {/* Center Landing Menu on Desktop */}
      <NavbarContent justify="center" className="w-full">
        {isCentralLanding && <LandingNavbarMenu />}
        {isTenantHome && (
          <div className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-xs font-bold uppercase tracking-wider text-default-600 hover:text-primary transition-colors"
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('tiendas');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-bold uppercase tracking-wider text-default-600 hover:text-primary transition-colors"
            >
              Puntos de Venta
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('contacto');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-bold uppercase tracking-wider text-default-600 hover:text-primary transition-colors"
            >
              Contacto
            </button>
          </div>
        )}
      </NavbarContent>

      {/* Right side actions */}
      <NavbarContent justify="end" className="w-fit gap-2 sm:gap-3">
        {!central && (
          <Button
            as="a"
            href={getCentralUrl()}
            variant="flat"
            color="default"
            size="sm"
            className="text-xs font-bold text-default-700 hover:text-primary hidden sm:flex items-center gap-1.5 border border-divider"
            startContent={<LuGlobe size={14} className="text-primary" />}
          >
            Web Central
          </Button>
        )}

        {authStatus === 'auth' && (
          <>
            <Tooltip content={`Tiempo real: ${realtimeLabel}`}>
              <div className="flex items-center gap-2" aria-label={`Tiempo real: ${realtimeLabel}`}>
                <span className={`w-2 h-2 rounded-full ${realtimeColor}`} />
                <span className="hidden sm:inline text-xs text-default-500">
                  {realtimeLabel}
                </span>
              </div>
            </Tooltip>
            {!central && <NotificationCenter />}
          </>
        )}

        {/* Theme mode toggle: available on all screens */}
        <div className="flex items-center">
          <DarkModeSwitch />
        </div>

        {authStatus === 'auth' ? (
          <div className="flex items-center gap-2">
            <UserDropdown />
          </div>
        ) : (
          <Button
            color="primary"
            variant="flat"
            size="sm"
            className="font-semibold text-xs"
            onPress={() => navigate('/login')}
          >
            Iniciar sesión
          </Button>
        )}
      </NavbarContent>
    </Navbar>
  );
};
