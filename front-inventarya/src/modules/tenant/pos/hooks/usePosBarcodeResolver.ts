import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { tenantApi } from "@/api";
import { scannerAudio } from "@/utils/scannerAudio";
import { useShopCartStore } from "../store/cart/shop-cart.store";
import { useStockStore } from "@/modules/tenant/inventory/store/inventories/inv-shops.store";
import { getOfflineStoreProducts } from "../offline/pos-db";
import { getLeafCategoryName } from "../utils/category";

export interface UsePosBarcodeResolverOptions {
  slug?: string;
  onSuccess?: (product: any) => void;
  onError?: (code: string) => void;
}

/**
 * Hook centralizado para resolución y agregado de productos escaneados
 * (Lectores USB, Bluetooth, Cámara del POS y Cámara del Carrito).
 */
export const usePosBarcodeResolver = ({
  slug,
  onSuccess,
  onError,
}: UsePosBarcodeResolverOptions) => {
  const [isResolvingScan, setIsResolvingScan] = useState<boolean>(false);
  const isResolvingRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  const addItem = useShopCartStore((state) => state.addItem);
  const cart = useShopCartStore((state) => state.cart);
  const storeProducts = useStockStore((state) => state.storeProducts);

  const resolveScannedProduct = useCallback(
    async (codeToScan: string): Promise<boolean> => {
      // 1. Normalización del código
      let rawCode = (codeToScan || "").trim();
      if (!rawCode) return false;

      // Descartar si viene como URL o prefijo de ruta (/product/:sku)
      if (rawCode.includes("/product/") || rawCode.includes("/productos/")) {
        const afterPrefix = rawCode.split(/\/product(?:os)?\//i)[1];
        if (afterPrefix) {
          rawCode = afterPrefix.split("?")[0].split("#")[0].trim();
        }
      } else if (rawCode.startsWith("http://") || rawCode.startsWith("https://")) {
        try {
          const parsed = new URL(rawCode);
          const segments = parsed.pathname.split("/").filter(Boolean);
          if (segments.length > 0) {
            rawCode = segments[segments.length - 1];
          }
        } catch {}
      }

      const cleanCode = rawCode.trim();
      if (!cleanCode) return false;

      // 2. Control de concurrencia y prevención de doble escaneo accidental (<400ms)
      const now = Date.now();
      if (
        isResolvingRef.current ||
        (lastScannedTimeRef.current.code.toLowerCase() === cleanCode.toLowerCase() &&
          now - lastScannedTimeRef.current.time < 400)
      ) {
        return false;
      }

      isResolvingRef.current = true;
      setIsResolvingScan(true);
      lastScannedTimeRef.current = { code: cleanCode, time: now };

      try {
        let matched: any = null;
        const searchLower = cleanCode.toLowerCase();

        // 3. Paso A: Búsqueda inmediata en memoria local (0ms de latencia)
        if (storeProducts && Array.isArray(storeProducts)) {
          for (const group of storeProducts) {
            const groupProds = group.products || [];
            for (const p of groupProds) {
              const pBarcode = String(p.barcode || "").trim().toLowerCase();
              const pSku = String(p.sku || "").trim().toLowerCase();
              const pSlug = String(p.slug || "").trim().toLowerCase();
              const pId = String(p.id || "");
              const pInvId = String(p.inventory_id || "");

              if (
                pBarcode === searchLower ||
                pSku === searchLower ||
                pSlug === searchLower ||
                pId === cleanCode ||
                pInvId === cleanCode
              ) {
                matched = {
                  ...p,
                  category_name: getLeafCategoryName(group.category || group.category_path || p.category_name),
                  category_color: group.color || p.category_color || "#6366f1",
                };
                break;
              }
            }
            if (matched) break;
          }
        }

        // 4. Paso B: Búsqueda en catálogo IndexedDB si estamos offline
        if (!matched && !navigator.onLine && slug) {
          try {
            const offlineGroups = await getOfflineStoreProducts(slug);
            if (offlineGroups && Array.isArray(offlineGroups)) {
              for (const group of offlineGroups) {
                const groupProds = group.products || [];
                for (const p of groupProds) {
                  const pBarcode = String(p.barcode || "").trim().toLowerCase();
                  const pSku = String(p.sku || "").trim().toLowerCase();
                  const pSlug = String(p.slug || "").trim().toLowerCase();
                  const pId = String(p.id || "");
                  const pInvId = String(p.inventory_id || "");

                  if (
                    pBarcode === searchLower ||
                    pSku === searchLower ||
                    pSlug === searchLower ||
                    pId === cleanCode ||
                    pInvId === cleanCode
                  ) {
                    matched = {
                      ...p,
                      category_name: getLeafCategoryName(group.category || group.category_path || p.category_name),
                      category_color: group.color || p.category_color || "#6366f1",
                    };
                    break;
                  }
                }
                if (matched) break;
              }
            }
          } catch (dbErr) {
            console.warn("Error al buscar en catálogo offline:", dbErr);
          }
        }

        // 5. Paso C: Consulta directa al backend (independiente de paginación)
        if (!matched && navigator.onLine && slug) {
          try {
            // Endpoint específico de tienda por barcode
            const res = await tenantApi.get(
              `/inventory-stores-get-by-store-slug/${slug}/barcode/${encodeURIComponent(cleanCode)}`
            );
            if (res.data?.product) {
              matched = res.data.product;
            }
          } catch (errApi: any) {
            // Fallback al endpoint /product/:sku
            try {
              const resFallback = await tenantApi.get(`/product/${encodeURIComponent(cleanCode)}`);
              const pData = resFallback.data?.product;
              if (pData) {
                const storeInvList = resFallback.data?.productInventoryStore || [];
                const storeInv =
                  storeInvList.find(
                    (inv: any) =>
                      String(inv.store_slug || inv.store_name || "").toLowerCase() === slug.toLowerCase()
                  ) || storeInvList[0];

                matched = {
                  ...pData,
                  inventory_id: storeInv?.id || storeInv?.inventory_id || pData.id,
                  stock_quantity: storeInv?.stock_quantity ?? storeInv?.stock ?? 0,
                  stock: storeInv?.stock_quantity ?? storeInv?.stock ?? 0,
                  price: storeInv?.price ?? pData.price ?? 0,
                  sale_price: storeInv?.sale_price ?? pData.sale_price ?? pData.price ?? 0,
                  saleprice: storeInv?.sale_price ?? pData.sale_price ?? pData.price ?? 0,
                  category_name: pData.category,
                  category_color: pData.color || "#6366f1",
                };
              }
            } catch {}
          }
        }

        // 6. Si no se encontró el producto en ninguna capa
        if (!matched) {
          try {
            scannerAudio.playError();
          } catch {}
          toast.error("Producto no encontrado", {
            description: `Código: ${cleanCode}`,
            duration: 3000,
          });
          onError?.(cleanCode);
          return false;
        }

        // 7. Validación de stock disponible antes de ingresar
        const stockAvailable = Number(matched.stock_quantity ?? matched.stock ?? 0);
        const invId = matched.inventory_id ?? matched.id;
        const existingInCart = cart.find((i) => String(i.inventory_id) === String(invId));
        const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

        if (stockAvailable <= 0) {
          try {
            scannerAudio.playError();
          } catch {}
          toast.error("Stock insuficiente", {
            description: `"${matched.name}" está agotado en esta tienda.`,
            duration: 3000,
          });
          onError?.(cleanCode);
          return false;
        }

        if (currentQtyInCart + 1 > stockAvailable) {
          try {
            scannerAudio.playError();
          } catch {}
          toast.warning("Stock insuficiente", {
            description: `Stock máximo disponible: ${stockAvailable} ${matched.unit || "u."} (ya tienes ${currentQtyInCart} en carrito).`,
            duration: 3000,
          });
          onError?.(cleanCode);
          return false;
        }

        // 8. Agregar o incrementar en el carrito mediante la store de carrito
        const added = addItem(matched, 1);
        if (added) {
          try {
            scannerAudio.playSuccess();
          } catch {}
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([40, 30, 40]);
            } catch {}
          }
          toast.success("Producto agregado", {
            description: matched.name,
            duration: 2500,
          });
          onSuccess?.(matched);
          return true;
        } else {
          try {
            scannerAudio.playError();
          } catch {}
          return false;
        }
      } catch (generalErr) {
        console.warn("Error en resolución de código de barras:", generalErr);
        try {
          scannerAudio.playError();
        } catch {}
        toast.error("Error al procesar el código", {
          description: `Código: ${cleanCode}`,
          duration: 3000,
        });
        return false;
      } finally {
        isResolvingRef.current = false;
        setIsResolvingScan(false);
      }
    },
    [slug, storeProducts, cart, addItem, onSuccess, onError]
  );

  return {
    resolveScannedProduct,
    isResolvingScan,
  };
};
