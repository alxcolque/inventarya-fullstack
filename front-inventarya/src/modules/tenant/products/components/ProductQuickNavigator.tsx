import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Chip,
  Tooltip,
} from "@nextui-org/react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuSearch,
  LuEye,
  LuPencil,
  LuMoveHorizontal,
  LuBoxes,
} from "react-icons/lu";
import { useProductsStore } from "../store/products/products.store";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { getImageUrl } from "@/utils/image";
import { IProductResponse } from "@/interface";

interface ProductQuickNavigatorProps {
  currentProductId?: string;
  mode: "show" | "edit";
  className?: string;
}

export const ProductQuickNavigator = ({
  currentProductId,
  mode,
  className = "",
}: ProductQuickNavigatorProps) => {
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const products = useProductsStore((state) => state.products);
  const getProducts = useProductsStore((state) => state.getProducts);

  // Cargar productos en memoria si aún no están cargados
  useEffect(() => {
    if (products.length === 0) {
      getProducts(token || undefined);
    }
  }, [products.length, getProducts, token]);

  // Encontrar el índice del producto actual en el catálogo
  const currentIndex = useMemo(() => {
    if (!currentProductId) return -1;
    return products.findIndex(
      (p) => String(p.id).toLowerCase() === String(currentProductId).toLowerCase()
    );
  }, [products, currentProductId]);

  const currentProduct = currentIndex >= 0 ? products[currentIndex] : null;
  const prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null;
  const nextProduct =
    currentIndex >= 0 && currentIndex < products.length - 1
      ? products[currentIndex + 1]
      : null;

  const goToProduct = (targetId: string | number) => {
    if (!targetId || String(targetId) === String(currentProductId)) return;
    if (mode === "edit") {
      navigate(`/products/${targetId}/edit`);
    } else {
      navigate(`/products/${targetId}`);
    }
  };

  // Soporte de deslizamiento táctil horizontal en móviles (Swipe)
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchActive = false;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // No activar swipe si se está interactuando con inputs, selects, textareas o modales
      if (
        target?.closest("input") ||
        target?.closest("textarea") ||
        target?.closest("select") ||
        target?.closest('[role="dialog"]') ||
        target?.closest('[role="listbox"]') ||
        target?.closest("button")
      ) {
        isTouchActive = false;
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isTouchActive = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTouchActive) return;
      isTouchActive = false;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Umbral: al menos 65px en horizontal y menos de 45px en vertical para no chocar con scroll vertical
      if (Math.abs(deltaX) >= 65 && Math.abs(deltaY) <= 45) {
        if (deltaX < 0 && nextProduct) {
          // Deslizó hacia la izquierda -> Siguiente producto
          goToProduct(nextProduct.id);
        } else if (deltaX > 0 && prevProduct) {
          // Deslizó hacia la derecha -> Producto anterior
          goToProduct(prevProduct.id);
        }
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [nextProduct, prevProduct, mode, currentProductId]);

  return (
    <div
      className={`w-full bg-content1/80 backdrop-blur-md border border-default-200/80 rounded-2xl p-2 sm:p-2.5 shadow-sm transition-all duration-300 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Selector Autocomplete con Búsqueda Instantánea */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {/* Botón Flecha Izquierda (Anterior) */}
          <Tooltip
            content={
              prevProduct ? `Anterior: ${prevProduct.name}` : "Inicio de la lista"
            }
            placement="bottom"
            isDisabled={!prevProduct}
          >
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              isDisabled={!prevProduct}
              onPress={() => prevProduct && goToProduct(prevProduct.id)}
              aria-label="Producto anterior"
              className="h-9 w-9 min-w-9 rounded-xl bg-default-100 hover:bg-default-200 text-default-700 disabled:opacity-30 flex-shrink-0"
            >
              <LuChevronLeft size={18} />
            </Button>
          </Tooltip>

          {/* Autocomplete de productos */}
          <div className="flex-1 min-w-0">
            <Autocomplete
              aria-label="Seleccionar producto para navegar o editar"
              placeholder={
                currentProduct
                  ? `${currentProduct.name} ${currentProduct.sku ? `(${currentProduct.sku})` : ""}`
                  : "Buscar y cambiar producto..."
              }
              defaultItems={products}
              selectedKey={currentProductId ? String(currentProductId) : undefined}
              onSelectionChange={(key) => {
                if (key) goToProduct(String(key));
              }}
              size="sm"
              variant="bordered"
              isClearable={false}
              startContent={
                currentProduct ? (
                  <div className="w-5 h-5 rounded-md overflow-hidden bg-default-200 flex-shrink-0 flex items-center justify-center">
                    {currentProduct.image || currentProduct.thumbnail ? (
                      <img
                        src={getImageUrl(currentProduct.image || currentProduct.thumbnail)}
                        alt={currentProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <LuBoxes size={12} className="text-default-500" />
                    )}
                  </div>
                ) : (
                  <LuSearch className="text-default-400" size={14} />
                )
              }
              inputProps={{
                classNames: {
                  inputWrapper:
                    "h-9 rounded-xl bg-default-50 border-default-200 hover:border-primary focus-within:!border-primary transition-colors",
                  input: "text-xs sm:text-sm font-semibold truncate",
                },
              }}
            >
              {(item: IProductResponse) => {
                const img = item.image || item.thumbnail;
                const isSelected = String(item.id) === String(currentProductId);
                return (
                  <AutocompleteItem
                    key={String(item.id)}
                    textValue={`${item.name} ${item.sku || ""} ${item.barcode || ""}`}
                    className={`rounded-xl py-2 ${
                      isSelected ? "bg-primary/10 font-bold" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-default-100 border border-default-200 flex-shrink-0 flex items-center justify-center">
                          {img ? (
                            <img
                              src={getImageUrl(img)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <LuBoxes size={16} className="text-default-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-default-400 truncate">
                            {item.sku ? `SKU: ${item.sku}` : item.category || "General"}
                          </span>
                        </div>
                      </div>
                      {item.sku && (
                        <Chip
                          size="sm"
                          variant="flat"
                          color={isSelected ? "primary" : "default"}
                          className="text-[10px] font-mono h-5 flex-shrink-0"
                        >
                          {item.sku}
                        </Chip>
                      )}
                    </div>
                  </AutocompleteItem>
                );
              }}
            </Autocomplete>
          </div>

          {/* Botón Flecha Derecha (Siguiente) */}
          <Tooltip
            content={
              nextProduct ? `Siguiente: ${nextProduct.name}` : "Fin de la lista"
            }
            placement="bottom"
            isDisabled={!nextProduct}
          >
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              isDisabled={!nextProduct}
              onPress={() => nextProduct && goToProduct(nextProduct.id)}
              aria-label="Producto siguiente"
              className="h-9 w-9 min-w-9 rounded-xl bg-default-100 hover:bg-default-200 text-default-700 disabled:opacity-30 flex-shrink-0"
            >
              <LuChevronRight size={18} />
            </Button>
          </Tooltip>
        </div>

        {/* Acciones Rápidas & Contador */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-default-100">
          {/* Contador de posición */}
          {products.length > 0 && currentIndex >= 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-default-100 text-default-600 text-[11px] font-medium">
              <span className="font-bold text-foreground">
                {currentIndex + 1}
              </span>
              <span className="text-default-400">/</span>
              <span>{products.length}</span>
            </div>
          )}

          {/* Botón Switch Ver Detalle <-> Editar */}
          {currentProductId && (
            <div>
              {mode === "show" ? (
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<LuPencil size={13} />}
                  onPress={() => navigate(`/products/${currentProductId}/edit`)}
                  className="h-8 px-3 rounded-xl font-semibold text-xs text-primary"
                >
                  <span className="hidden xs:inline">Editar</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="secondary"
                  variant="flat"
                  startContent={<LuEye size={13} />}
                  onPress={() => navigate(`/products/${currentProductId}`)}
                  className="h-8 px-3 rounded-xl font-semibold text-xs text-secondary"
                >
                  <span className="hidden xs:inline">Ver Detalle</span>
                </Button>
              )}
            </div>
          )}

          {/* Indicador sutil para móviles de soporte Gestos Swipe */}
          <div className="sm:hidden flex items-center gap-1 text-[10px] text-default-400 font-medium">
            <LuMoveHorizontal size={13} className="text-primary animate-pulse" />
            <span>Desliza ↔</span>
          </div>
        </div>
      </div>
    </div>
  );
};
