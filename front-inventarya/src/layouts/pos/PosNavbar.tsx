import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
  Tooltip,
} from '@nextui-org/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserDropdown } from '@/components/navbar/user-dropdown';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { useOfflineSalesStatus } from '@/modules/tenant/pos/offline/hooks/useOfflineSalesStatus';
import { OfflineStatusIndicator } from '@/modules/tenant/pos/offline/components/OfflineStatusIndicator';
import { OfflineSalesPanel } from '@/modules/tenant/pos/offline/components/OfflineSalesPanel';
import { useSettingStore } from '@/modules/tenant/settings/store/settings/settings.store';
import { useShopsStore } from '@/modules/tenant/pos/store/shops/shops.store';
import { getImageUrl } from '@/utils';
import { getTenantSlug } from '@/utils/tenant';
import { AppLogo, INVENTARYA_LOGO_PATH } from '@/components/branding/AppLogo';
import { LuReceipt } from 'react-icons/lu';

/**
 * PosNavbar — Barra de navegación exclusiva para Punto de Venta (POS).
 * 
 * - Sin sidebar ni elementos innecesarios.
 * - Logo foto con nombre de tienda y estado de conectividad interactivo (Fase 6B.4D).
 * - Centro de notificaciones desplegable con scroll.
 * - Perfil con cambiar de sucursal (/tienda) y panel "Administrar" según rol.
 */
export const PosNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const company = useSettingStore((state) => state.systemData);
  const getSystemData = useSettingStore((state) => state.getSystemData);
  const currentShop = useShopsStore((state) => state.shop);

  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    getSystemData();
  }, [getSystemData]);

  const tenantSlug = getTenantSlug();
  const brandName = useMemo(() => {
    if (company?.business_name && company.business_name !== 'Inventarya Sucursal') {
      return company.business_name;
    }
    if (company?.name && company.name !== 'Inventarya Sucursal') {
      return company.name;
    }
    return tenantSlug || company?.business_name || 'Inventarya POS';
  }, [company, tenantSlug]);

  const brandLogo = useMemo(() => {
    if (currentShop?.front_image) {
      return getImageUrl(currentShop.front_image);
    }
    if (
      company?.logo &&
      company.logo !== INVENTARYA_LOGO_PATH &&
      company.logo !== '/logo.png' &&
      company.logo !== 'logo.png'
    ) {
      return getImageUrl(company.logo);
    }
    return INVENTARYA_LOGO_PATH;
  }, [currentShop, company]);

  const storeDisplayName = currentShop?.name || "Inventarya";
  const truncatedStoreName = useMemo(() => {
    if (!storeDisplayName) return 'Punto de Venta';
    return storeDisplayName.length > 15
      ? `${storeDisplayName.slice(0, 15)}...`
      : storeDisplayName;
  }, [storeDisplayName]);

  // Hook central de conectividad y ventas offline (Fase 6B.4D)
  const {
    sales: offlineSales,
    pendingCount,
    totalAttention,
    connectivityState,
    isSyncing,
    catalogFreshness,
    syncPendingSales,
    retrySale,
    retryLocalReconciliation,
    refreshCatalog,
  } = useOfflineSalesStatus({
    storeSlug: currentShop?.slug,
  });

  const isSaleView = location.pathname.includes('/ventas') || location.search.includes('tab=ventas');

  const handleToggleSales = () => {
    let targetSlug = currentShop?.slug;
    if (!targetSlug) {
      const match = location.pathname.match(/\/(?:tienda|pos)\/([^/?#]+)/);
      if (match && match[1] !== 'ventas') {
        targetSlug = match[1];
      }
    }

    if (isSaleView) {
      if (targetSlug) {
        navigate(`/tienda/${targetSlug}`);
      } else {
        navigate('/tienda');
      }
    } else {
      if (targetSlug) {
        navigate(`/tienda/${targetSlug}/ventas`);
      } else {
        navigate('/tienda');
      }
    }
  };

  return (
    <>
      <Navbar
        isBordered
        maxWidth="full"
        className="w-full bg-background/90 backdrop-blur-md border-b border-divider h-16 shrink-0"
        classNames={{ wrapper: 'w-full max-w-full px-3 sm:px-6' }}
      >
        {/* 1. Logo y nombre de la tienda + Indicador de conectividad */}
        <NavbarContent justify="start" className="gap-3">
          <NavbarBrand
            className="cursor-pointer hover:opacity-90 transition-opacity gap-3 flex items-center"
            onClick={() => {
              navigate('/tienda');
            }}
          >
            {/* Logo con aspecto de foto profesional */}
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-default-200/80 dark:border-default-100 bg-default-100 flex items-center justify-center shrink-0">
              <AppLogo
                src={brandLogo}
                alt={storeDisplayName}
                className="w-full h-full object-cover"
                fallbackSrc={INVENTARYA_LOGO_PATH}
              />
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <span
                className="font-extrabold text-sm sm:text-base text-foreground tracking-tight leading-tight truncate max-w-[140px] sm:max-w-[200px]"
                title={storeDisplayName}
              >
                {truncatedStoreName}
              </span>

              {/* Indicador de Conectividad Interactivo (Fase 6B.4D - Secciones 5 y 6) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPanelOpen(true);
                }}
              >
                <OfflineStatusIndicator
                  connectivityState={connectivityState}
                  pendingCount={pendingCount}
                  totalAttention={totalAttention}
                  isSyncing={isSyncing}
                  onOpenPanel={() => setIsPanelOpen(true)}
                  isCompact={true}
                />
              </div>
            </div>
          </NavbarBrand>
        </NavbarContent>

        {/* Derecha: Menú Ventas (Modo PC >= 1024px), Notificaciones y Perfil */}
        <NavbarContent justify="end" className="w-fit gap-2 sm:gap-3">
          {/* Menú Ventas exclusivo para modo PC (>= 1024px) */}
          <div className="hidden lg:flex items-center">
            <Tooltip
              content={isSaleView ? "Volver al Punto de Venta (Caja)" : "Ver Historial y Reportes de Ventas"}
              delay={250}
              closeDelay={0}
            >
              <Button
                size="sm"
                variant={isSaleView ? "solid" : "flat"}
                color={isSaleView ? "primary" : "default"}
                startContent={
                  <LuReceipt
                    size={16}
                    className={isSaleView ? "text-primary-foreground" : "text-primary"}
                  />
                }
                onPress={handleToggleSales}
                className={`font-bold text-xs sm:text-sm px-3.5 h-9 rounded-xl border transition-all ${isSaleView
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "border-divider bg-default-100/80 hover:bg-default-200/80 text-foreground"
                  }`}
              >
                Ventas
              </Button>
            </Tooltip>
          </div>

          {/* Notificaciones con scroll */}
          <div className="flex items-center">
            <NotificationCenter />
          </div>

          {/* Perfil de usuario (Administrar / Cambiar Sucursal a /tienda / Modo Oscuro / Salir) */}
          <div className="flex items-center">
            <UserDropdown />
          </div>
        </NavbarContent>
      </Navbar>

      {/* Panel de Ventas Pendientes activable desde la barra superior */}
      <OfflineSalesPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        sales={offlineSales}
        pendingCount={pendingCount}
        totalAttention={totalAttention}
        isSyncing={isSyncing}
        storeSlug={currentShop?.slug}
        storeName={currentShop?.name}
        hasDeficit={catalogFreshness.hasDeficit}
        deficitCount={catalogFreshness.deficitCount}
        onSyncPendingSales={syncPendingSales}
        onRetrySale={retrySale}
        onRetryLocal={retryLocalReconciliation}
        onRefreshCatalog={refreshCatalog}
      />
    </>
  );
};

