import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@nextui-org/react";
import { FaStore, FaReceipt, FaCartShopping, FaHouse } from "react-icons/fa6";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useShopCartStore } from "@/modules/tenant/pos/store/cart/shop-cart.store";

/**
 * PosBottomNav — Barra de navegación inferior persistente para Punto de Venta (POS).
 * 
 * Se muestra de forma constante en Teléfono y Tablet (menores a 1024px, clase `lg:hidden`).
 * Permite conmutar con `navigate` entre Caja/Catálogo, Ventas, Carrito y Selector de Tiendas sin recargar la página.
 */
export const PosBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentShop = useShopsStore((state) => state.shop);
  const totalUnits = useShopCartStore((state) => state.totalUnits);
  const openCart = useShopCartStore((state) => state.openCart);

  // Extraer slug de la tienda actual desde la URL o el store
  const pathParts = location.pathname.split("/");
  const slugFromUrl =
    (pathParts[1] === "tienda" || pathParts[1] === "pos") && pathParts[2] && pathParts[2] !== "ventas"
      ? pathParts[2]
      : null;
  const storeSlug = currentShop?.slug || slugFromUrl;

  const pathname = location.pathname;
  const isVentas = pathname.includes("/ventas");
  const isTiendasList = pathname === "/tienda" || pathname === "/shops";
  const isCaja = Boolean(storeSlug && !isVentas && !isTiendasList);

  const handleGoToCaja = () => {
    if (storeSlug) {
      navigate(`/tienda/${storeSlug}`);
    } else {
      navigate("/tienda");
    }
  };

  const handleGoToVentas = () => {
    if (storeSlug) {
      navigate(`/tienda/${storeSlug}/ventas`);
    } else {
      navigate("/tienda");
    }
  };

  const handleOpenCart = () => {
    if (!storeSlug) {
      navigate("/tienda");
      return;
    }
    // Si no estamos en la pantalla principal de la tienda, navegar primero allí
    if (pathname !== `/tienda/${storeSlug}` && pathname !== `/pos/${storeSlug}`) {
      navigate(`/tienda/${storeSlug}`);
    }
    openCart();
  };

  const handleGoToTiendas = () => {
    navigate("/tienda");
  };

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-divider bg-background/95 backdrop-blur-xl shadow-2xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 h-16 items-center px-1">
        {/* 1. Inicio / Caja POS */}
        <Button
          variant="light"
          onPress={handleGoToCaja}
          className={`h-full min-w-0 rounded-none flex-col gap-1 text-[10px] transition-colors ${
            isCaja ? "text-primary font-bold" : "text-default-500"
          }`}
        >
          <FaStore className="text-lg shrink-0" />
          <span>Inicio</span>
        </Button>

        {/* 2. Historial de Ventas */}
        <Button
          variant="light"
          onPress={handleGoToVentas}
          className={`h-full min-w-0 rounded-none flex-col gap-1 text-[10px] transition-colors ${
            isVentas ? "text-primary font-bold" : "text-default-500"
          }`}
        >
          <FaReceipt className="text-lg shrink-0" />
          <span>Ventas</span>
        </Button>

        {/* 3. Carrito con badge de productos */}
        <Button
          variant="light"
          onPress={handleOpenCart}
          className="h-full min-w-0 rounded-none flex-col gap-1 text-[10px] text-default-500 relative transition-colors"
        >
          <FaCartShopping className="text-lg shrink-0" />
          {totalUnits > 0 && (
            <span className="absolute top-1.5 left-1/2 ml-2 bg-danger text-white rounded-full min-w-4 h-4 px-1 text-[9px] flex items-center justify-center font-bold shadow-sm">
              {totalUnits}
            </span>
          )}
          <span>Carrito</span>
        </Button>

        {/* 4. Selector de Tiendas */}
        <Button
          variant="light"
          onPress={handleGoToTiendas}
          className={`h-full min-w-0 rounded-none flex-col gap-1 text-[10px] transition-colors ${
            isTiendasList ? "text-primary font-bold" : "text-default-500"
          }`}
        >
          <FaHouse className="text-lg shrink-0" />
          <span>Tiendas</span>
        </Button>
      </div>
    </nav>
  );
};
