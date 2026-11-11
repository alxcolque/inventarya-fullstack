import { CashRegisterPanel } from '../../cash-register/CashRegisterPanel';
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Image,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Tooltip,
} from "@nextui-org/react";
import {
  FaCartShopping,
  FaReceipt,
  FaStore,
  FaMagnifyingGlass,
  FaPlus,
  FaMinus,
  FaEye,
  FaTrash,
  FaTag,
  FaArrowRightArrowLeft,
  FaCoins,
  FaBoxesStacked,
  FaTriangleExclamation,
  FaCircleCheck,
  FaSliders,
  FaCloudArrowUp,
  FaTableCells,
  FaList,
  FaCalendarDay,
  FaBarcode,
  FaCamera,
  FaCashRegister,
  FaKeyboard,
  FaXmark,
  FaBell,
  FaUser,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa6";
import { TbCloudOff, TbScan } from "react-icons/tb";
import { RiMoreFill } from "react-icons/ri";
import { toast } from "sonner";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useStockStore } from "@/modules/tenant/inventory/store/inventories/inv-shops.store";
import { FaEllipsisVertical } from "react-icons/fa6";
import { useOrdersStore } from "@/modules/tenant/sales/store/orders/orders.store";
import { useShopCartStore } from "../../store/cart/shop-cart.store";
import { ModalBrands } from "@/components/modals/modal-brands";
import { AlertDelete } from "@/components/dialogs/alert-delete";
import { CartModal } from "./modals/cart-modal";
import { ModalEditStoreInventory } from "./modals/modal-edit-store-inventory";
import { BarcodeScannerModal } from "./components/BarcodeScannerModal";
import { ProductCard } from "./components/ProductCard";
import { ProductTableRow } from "./components/ProductTableRow";
import { ProductGridSkeleton } from "./components/ProductGridSkeleton";
import { usePosBarcodeResolver } from "@/modules/tenant/pos/hooks/usePosBarcodeResolver";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getImageUrl } from "@/utils/image";
import { getLeafCategoryName } from "@/modules/tenant/pos/utils/category";
import { useCurrency } from "@/stores/currency/currency.store";
import { useOfflineSalesStatus } from "@/modules/tenant/pos/offline/hooks/useOfflineSalesStatus";
import { OfflineStatusIndicator } from "@/modules/tenant/pos/offline/components/OfflineStatusIndicator";
import { CatalogFreshnessIndicator } from "@/modules/tenant/pos/offline/components/CatalogFreshnessIndicator";
import { OfflineSalesPanel } from "@/modules/tenant/pos/offline/components/OfflineSalesPanel";
import { scannerAudio } from "@/utils/scannerAudio";
import { tenantApi } from "@/api";
import {
  getOfflineStore,
  getOfflineStoreProducts,
  cacheStoreInfo,
  cacheStoreProducts,
} from "@/modules/tenant/pos/offline/pos-db";
import {
  isBaseCatalogQuery,
  isCatalogSnapshotComplete,
  refreshCompleteOfflineCatalog,
} from "@/modules/tenant/pos/offline/offlineCatalog";
import { FaHome } from "react-icons/fa";

type StockFilterType = "all" | "in_stock" | "low_stock" | "out_of_stock";

export const ShopHome: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useTenantAuthStore((state) => state.token);
  const user = useTenantAuthStore((state) => state.user);
  useCurrency();

  const [isLoading, setIsLoading] = useState(false);
  const [isModalBrandsOpen, setIsModalBrandsOpen] = useState(false);

  // Redirección suave si viene con el antiguo query param ?tab=ventas
  useEffect(() => {
    if (searchParams.get("tab") === "ventas" && slug) {
      navigate(`/tienda/${slug}/ventas`, { replace: true });
    }
  }, [searchParams, slug, navigate]);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [recentlyScannedId, setRecentlyScannedId] = useState<number | string | null>(null);

  // Filtros locales
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeBrand, setActiveBrand] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<StockFilterType>("all");
  const [isSearchingBackend, setIsSearchingBackend] = useState<boolean>(false);

  // Debounce de 300ms para búsqueda optimizada contra backend
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Modo de visualización: Tarjetas o Lista
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  // Ref del input de búsqueda/escaneo rápido
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Edición de inventario en tienda (Restringido para usuarios con rol 'staff')
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const canEditInventory = user?.role === "owner" || user?.role === "admin";

  const handleOpenEditModal = (prod: any) => {
    setEditingProduct(prod);
    setIsEditModalOpen(true);
  };

  const handleReturn = async (inventoryId: number | string) => {
    try {
      await tenantApi.delete(`/inventory-stores/${inventoryId}`);
      toast.success("Producto devuelto al almacén correctamente.");
      loadInitialData();
    } catch {
      toast.error("Error al devolver el producto al almacén.");
    }
  };

  // Popover para ajuste de precio/cantidad personalizada
  const [popoverCustomQty, setPopoverCustomQty] = useState<number>(1);
  const [popoverCustomPrice, setPopoverCustomPrice] = useState<string>("");

  // Eliminación temporal con cuenta regresiva
  const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);

  // ── Sentinel ref para IntersectionObserver (infinite scroll) ──────────────
  const sentinelRef = useRef<HTMLDivElement>(null);
  const catalogScrollRef = useRef<HTMLDivElement>(null);

  // ── Scroll horizontal de categorías ──────────────────────────────────────
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);

  // ── Stores ────────────────────────────────────────────────────────────────
  const decrementLocalStock = useStockStore((state) => state.decrementLocalStock);
  const shop = useShopsStore((state) => state.shop);
  const getShop = useShopsStore((state) => state.getShopBySlug);
  const shops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);
  const setOfflineShop = useShopsStore((state) => state.setOfflineShop);

  const storeProducts = useStockStore((state) => state.storeProducts);
  const categories = useStockStore((state) => state.categories);
  const getProducts = useStockStore((state) => state.getStoreProducts);
  const loadMoreProducts = useStockStore((state) => state.loadMoreStoreProducts);
  const hasMore = useStockStore((state) => state.hasMore);
  const isLoadingMore = useStockStore((state) => state.isLoadingMore);
  const deleteProduct = useStockStore((state) => state.inventoryDelete);
  const setOfflineProducts = useStockStore((state) => state.setOfflineProducts);

  const sales = useOrdersStore((state) => state.sales);
  const getSalesInStore = useOrdersStore((state) => state.getSalesInStore);

  // ── Hook Central de Estado Offline, Ventas y Conectividad (Fase 6B.4D) ─────
  const {
    sales: offlineSales,
    pendingCount,
    conflictCount,
    reconciliationCount,
    totalAttention,
    connectivityState,
    isOnline,
    isSyncing,
    catalogFreshness,
    isRefreshingCatalog,
    syncPendingSales,
    retrySale,
    retryLocalReconciliation,
    refreshCatalog,
  } = useOfflineSalesStatus({
    storeSlug: slug,
    onSyncComplete: () => {
      if (slug && token && navigator.onLine) {
        // Al reconectar recargamos la primera página paginada y ventas
        getProducts(slug, { search: searchQuery, brands: activeBrand, categories: activeCategory, per_page: 30 });
        getSalesInStore(slug, token);
      }
    },
  });

  const [isOfflinePanelOpen, setIsOfflinePanelOpen] = useState<boolean>(false);

  // Cart Store reactivo
  const initCartForShop = useShopCartStore((state) => state.initCartForShop);
  const addItem = useShopCartStore((state) => state.addItem);
  const updateQty = useShopCartStore((state) => state.updateQty);
  const removeItem = useShopCartStore((state) => state.removeItem);
  const clearCart = useShopCartStore((state) => state.clearCart);
  const cart = useShopCartStore((state) => state.cart);
  const totalUnits = useShopCartStore((state) => state.totalUnits);
  const totalAmount = useShopCartStore((state) => state.totalAmount);
  const openCart = useShopCartStore((state) => state.openCart);

  // Mapa de cantidades en carrito O(1) para evitar búsquedas repetitivas en cada tarjeta
  const cartQtyMap = useMemo(() => {
    const map = new Map<number | string, number>();
    for (const item of cart) {
      map.set(item.inventory_id, item.quantity);
    }
    return map;
  }, [cart]);

  // Callbacks memoizados para ProductCard y ProductTableRow
  const handleAddToCart = useCallback((prod: any) => {
    addItem(prod, 1);
    scannerAudio.playSuccess();
  }, [addItem]);

  const handleUpdateQty = useCallback((inventoryId: number | string, newQty: number) => {
    updateQty(inventoryId, newQty);
  }, [updateQty]);

  const handleViewProduct = useCallback((productId: number | string) => {
    navigate(`/products/${productId}`);
  }, [navigate]);

  // Redirigir si no hay slug
  useEffect(() => {
    if (!slug) {
      navigate("/shops", { replace: true });
    } else {
      initCartForShop(slug);
    }
  }, [slug, navigate, initCartForShop]);

  // ── Carga de datos con arquitectura Offline-First + paginación ─────────────
  const loadInitialData = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);

    if (!navigator.onLine) {
      // Sin internet → cargar desde IndexedDB (catálogo completo almacenado)
      try {
        const [offlineShop, offlineProds] = await Promise.all([
          getOfflineStore(slug),
          getOfflineStoreProducts(slug),
        ]);
        if (offlineShop) setOfflineShop(offlineShop as any);
        if (offlineProds && offlineProds.length > 0) setOfflineProducts(offlineProds);
      } catch (err) {
        console.error("Error al cargar datos offline de IndexedDB:", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Con internet → primera página paginada (30 items) + info de tienda
      const [shopData] = await Promise.all([
        getShop(slug, token),
        getShops(token),
        getProducts(slug, { search: "", brands: "", categories: "", per_page: 30 }),
        getSalesInStore(slug, token),
      ]);

      if (shopData) {
        cacheStoreInfo(shopData);
      }

      // Disparar descarga del catálogo completo en segundo plano si aún no existe un snapshot válido (Fase 6B.4C)
      if (slug && navigator.onLine) {
        isCatalogSnapshotComplete(undefined, slug).then((isComplete) => {
          if (!isComplete && navigator.onLine) {
            refreshCompleteOfflineCatalog(slug);
          }
        });
      }
    } catch (e) {
      console.warn("Error de conexión al cargar datos. Cargando desde IndexedDB...", e);
      try {
        const [offlineShop, offlineProds] = await Promise.all([
          getOfflineStore(slug),
          getOfflineStoreProducts(slug),
        ]);
        if (offlineShop) setOfflineShop(offlineShop as any);
        if (offlineProds && offlineProds.length > 0) setOfflineProducts(offlineProds);
      } catch (errDb) {
        console.error("Error en fallback a IndexedDB:", errDb);
      }
    } finally {
      setIsLoading(false);
    }
  }, [slug, token, getShop, getShops, getProducts, getSalesInStore, setOfflineShop, setOfflineProducts]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ── Filtro directo en backend al cambiar búsqueda, categoría o marca ───────────
  const isInitialFilterMount = useRef(true);

  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    if (!slug || !navigator.onLine) return;

    let isSubscribed = true;
    setIsSearchingBackend(true);

    getProducts(slug, {
      search: debouncedSearch.trim(),
      categories: activeCategory,
      brands: activeBrand,
      per_page: 30,
    }).finally(() => {
      if (isSubscribed) {
        setIsSearchingBackend(false);
      }
    });

    catalogScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    return () => {
      isSubscribed = false;
    };
  }, [slug, debouncedSearch, activeCategory, activeBrand, getProducts]);

  // ── Carga incremental (infinite scroll) ───────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!slug || !hasMore || isLoadingMore || !navigator.onLine) return;
    loadMoreProducts(slug, {
      search: debouncedSearch.trim(),
      brands: activeBrand,
      categories: activeCategory,
      per_page: 30,
    });
  }, [slug, hasMore, isLoadingMore, debouncedSearch, activeBrand, activeCategory, loadMoreProducts]);

  // Observer para detección automática al fondo del catálogo
  useEffect(() => {
    if (!sentinelRef.current || !slug) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: catalogScrollRef.current || null,
        rootMargin: "300px",
        threshold: 0,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [handleLoadMore, slug]);

  // Listener de scroll de respaldo para máxima compatibilidad
  const handleCatalogScroll = useCallback(() => {
    if (!catalogScrollRef.current || isLoadingMore || !hasMore || !navigator.onLine) return;
    const { scrollTop, scrollHeight, clientHeight } = catalogScrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 250) {
      handleLoadMore();
    }
  }, [handleLoadMore, isLoadingMore, hasMore]);

  // ── Control de scroll horizontal de la barra de categorías ───────────────
  const checkCategoryScroll = useCallback(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    const hasLeft = el.scrollLeft > 4;
    const hasRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setCanScrollCategoriesLeft(hasLeft);
    setCanScrollCategoriesRight(hasRight);
  }, []);

  useEffect(() => {
    checkCategoryScroll();
    const el = categoriesScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkCategoryScroll, { passive: true });
    window.addEventListener("resize", checkCategoryScroll);
    return () => {
      el.removeEventListener("scroll", checkCategoryScroll);
      window.removeEventListener("resize", checkCategoryScroll);
    };
  }, [categories, checkCategoryScroll]);

  const handleScrollCategories = (direction: "left" | "right") => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -280 : 280;
    el.scrollBy({ left: amount, behavior: "smooth" });
    setTimeout(checkCategoryScroll, 320);
  };

  // Guardar en IndexedDB ÚNICAMENTE si no hay filtros comerciales activos y el catálogo base está completo
  useEffect(() => {
    const isUnfiltered = isBaseCatalogQuery({
      search: searchQuery,
      categories: activeCategory,
      brands: activeBrand,
      stock_filter: stockFilter,
    });

    if (slug && storeProducts && storeProducts.length > 0 && navigator.onLine && !hasMore && isUnfiltered) {
      cacheStoreProducts(slug, storeProducts, { isComplete: true });
    }
  }, [slug, storeProducts, hasMore, searchQuery, activeCategory, activeBrand, stockFilter]);

  // Manejo de eliminación con temporizador de 10s
  useEffect(() => {
    if (deleteCountdown !== null && deleteCountdown > 0) {
      const timer = setTimeout(() => {
        setDeleteCountdown(deleteCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (deleteCountdown === 0) {
      handleConfirmDelete();
    }
  }, [deleteCountdown]);

  const handleDeleteClick = (id: number) => {
    setDeleteRowId(id);
    setDeleteCountdown(10);
  };

  const handleConfirmDelete = async () => {
    if (deleteRowId && token) {
      await deleteProduct(deleteRowId, token);
      setDeleteRowId(null);
      setDeleteCountdown(null);
      if (slug) {
        getProducts(slug, { search: searchQuery, brands: activeBrand, categories: activeCategory }, token);
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteRowId(null);
    setDeleteCountdown(null);
  };

  // Filtrado reactivo en memoria de los productos cargados
  const flattenedProducts = useMemo(() => {
    const list: any[] = [];
    (storeProducts || []).forEach((group: any) => {
      const catId = group.category_id || "";
      const catObj = categories.find((c: any) => (c.id && c.id === catId) || (c.slug && c.slug === group.slug_category));
      const rawCatName = group.category || catObj?.name || group.category_path || "";
      const catName = getLeafCategoryName(rawCatName);
      const catColor = group.color || catObj?.color || "#6366f1";
      const catSlug = group.slug_category || catObj?.slug || "";
      (group.products || []).forEach((prod: any) => {
        list.push({
          ...prod,
          category_name: catName || getLeafCategoryName(prod.category_name) || getLeafCategoryName(prod.category?.name) || "",
          category_color: catColor || prod.category_color || prod.category?.color || "#6366f1",
          category_slug: catSlug || prod.category_slug || prod.category?.slug || "",
          category_id: catId || prod.category_id || prod.category?.id || "",
        });
      });
    });
    return list;
  }, [storeProducts, categories]);

  // KPIs de la tienda
  const kpis = useMemo(() => {
    const totalProducts = flattenedProducts.length;
    const lowStockCount = flattenedProducts.filter((p) => {
      const stock = Number(p.stock_quantity ?? p.stock ?? 0);
      const min = Number(p.min_stock ?? 0);
      return stock > 0 && stock <= min;
    }).length;

    const outOfStockCount = flattenedProducts.filter((p) => {
      return Number(p.stock_quantity ?? p.stock ?? 0) <= 0;
    }).length;

    const salesList = sales || [];
    const salesTodayCount = salesList.length;
    const salesTodayAmount = salesList.reduce(
      (sum: number, s: any) => sum + (parseFloat(s.total) || 0),
      0
    );

    return {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      salesTodayCount,
      salesTodayAmount,
    };
  }, [flattenedProducts, sales]);

  // Aplicar filtros: directamente desde el backend si está online, o en memoria si está offline
  const filteredProducts = useMemo(() => {
    // Modo Offline: aplicar filtros en memoria sobre el catálogo completo descargado de IndexedDB
    if (!navigator.onLine) {
      return flattenedProducts.filter((p) => {
        // 1. Búsqueda por texto multi-término
        if (searchQuery.trim()) {
          const terms = searchQuery.toLowerCase().trim().split(/\s+/);
          const targetText = `${p.name || ""} ${p.sku || ""} ${p.barcode || ""} ${p.brand || ""}`.toLowerCase();
          const allTermsMatch = terms.every((t) => targetText.includes(t));
          if (!allTermsMatch) return false;
        }

        // 2. Categoría
        if (activeCategory) {
          const matchById = p.category_id && String(p.category_id) === String(activeCategory);
          const matchBySlug = p.category_slug && String(p.category_slug) === String(activeCategory);
          const matchByName = p.category_name && String(p.category_name).toLowerCase() === String(activeCategory).toLowerCase();
          if (!matchById && !matchBySlug && !matchByName) return false;
        }

        // 3. Marca
        if (activeBrand) {
          const brandMatch =
            p.brand === activeBrand ||
            p.brand_slug === activeBrand ||
            (p.brand || "").toLowerCase() === activeBrand.toLowerCase() ||
            (p.brand_name || "").toLowerCase() === activeBrand.toLowerCase();
          if (!brandMatch) return false;
        }

        // 4. Estado de stock
        const stock = Number(p.stock_quantity ?? p.stock ?? 0);
        const minStock = Number(p.min_stock ?? 0);
        if (stockFilter === "in_stock" && stock <= 0) return false;
        if (stockFilter === "out_of_stock" && stock > 0) return false;
        if (stockFilter === "low_stock" && (stock <= 0 || stock > minStock)) return false;

        return true;
      });
    }

    // Modo Online: El backend ya ejecutó el filtrado directo de búsqueda, categorías y marcas.
    // Solo filtramos en cliente el selector rápido de disponibilidad de stock.
    if (stockFilter === "all") {
      return flattenedProducts;
    }

    return flattenedProducts.filter((p) => {
      const stock = Number(p.stock_quantity ?? p.stock ?? 0);
      const minStock = Number(p.min_stock ?? 0);
      if (stockFilter === "in_stock" && stock <= 0) return false;
      if (stockFilter === "out_of_stock" && stock > 0) return false;
      if (stockFilter === "low_stock" && (stock <= 0 || stock > minStock)) return false;
      return true;
    });
  }, [flattenedProducts, searchQuery, activeCategory, activeBrand, stockFilter]);

  // Agrupación de los productos filtrados para vista organizada por categorías
  const filteredGrouped = useMemo(() => {
    const groupsMap = new Map<string, { name: string; color: string; products: any[] }>();

    filteredProducts.forEach((p) => {
      const catKey = p.category_name;
      if (!groupsMap.has(catKey)) {
        groupsMap.set(catKey, {
          name: catKey,
          color: p.category_color || "#6366f1",
          products: [],
        });
      }
      groupsMap.get(catKey)!.products.push(p);
    });

    return Array.from(groupsMap.values());
  }, [filteredProducts]);

  // Hook unificado para resolución y escaneo de códigos de barra (exactamente igual que en el carrito)
  const { resolveScannedProduct, isResolvingScan } = usePosBarcodeResolver({
    slug,
    onSuccess: (matched) => {
      const targetId = matched.inventory_id ?? matched.id;
      setRecentlyScannedId(targetId);
      setTimeout(() => setRecentlyScannedId(null), 1200);
    },
  });

  const handleBarcodeScan = useCallback(
    async (codeToScan: string) => {
      return await resolveScannedProduct(codeToScan);
    },
    [resolveScannedProduct]
  );

  // LISTENER GLOBAL DE PISTOLA DE CÓDIGO DE BARRAS Y ATAJOS DE TECLADO
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2: Enfocar barra de búsqueda/escáner
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // F4: Abrir panel de cobro
      if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0) {
          openCart();
        } else {
          toast.info("El carrito está vacío. Agrega o escanea productos primero.");
        }
        return;
      }

      // Escape: Limpiar búsqueda
      if (e.key === "Escape") {
        setSearchQuery("");
        searchInputRef.current?.focus();
        return;
      }

      const now = Date.now();
      const isFastBurst = now - lastKeyTime < 50;
      lastKeyTime = now;

      // Si el foco está en otro input común del sistema que no sea el escáner
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        activeElement !== searchInputRef.current &&
        (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA");

      if (isInput && !isFastBurst) {
        buffer = "";
        return;
      }

      if (e.key === "Enter") {
        if (buffer.length >= 2) {
          e.preventDefault();
          handleBarcodeScan(buffer);
          buffer = "";
        }
      } else if (e.key.length === 1) {
        if (buffer.length === 0 || isFastBurst) {
          buffer += e.key;
        } else {
          buffer = e.key;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [cart, openCart, handleBarcodeScan]);

  return (
    <div className="h-full w-full max-w-[110rem] mx-auto flex flex-col min-h-0 gap-1 sm:gap-2">
      {shop?.id && shop.slug === slug && <CashRegisterPanel storeId={String(shop.id)} storeName={shop.name} />}
      {/* MODAL DE CHECKOUT / COBRO */}
      <CartModal
        shopId={shop?.id}
        slug={slug}
        onSaleCompleted={(_, soldItems) => {
          if (soldItems && soldItems.length > 0) {
            decrementLocalStock(soldItems);
          } else {
            loadInitialData();
          }
        }}
      />

      {/* MODAL DE ESCÁNER CON CÁMARA (QR / CÓDIGO DE BARRAS) */}
      <BarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code) => {
          handleBarcodeScan(code);
        }}
      />

      {/* MODAL DE EDICIÓN DE INVENTARIO DE TIENDA */}
      <ModalEditStoreInventory
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSuccess={() => {
          loadInitialData();
        }}
      />

      {/* MODAL DE FILTRADO POR MARCAS */}
      <ModalBrands
        isOpen={isModalBrandsOpen}
        onClose={() => setIsModalBrandsOpen(false)}
        selectBrands={(brand) => {
          setActiveBrand(brand);
          setIsModalBrandsOpen(false);
        }}
        currentBrand={activeBrand}
      />

      {/* ALERTA DE ELIMINACIÓN DE PRODUCTO DE TIENDA */}
      {deleteRowId !== null && (
        <AlertDelete
          handleConfirmDelete={handleConfirmDelete}
          handleCancelDelete={handleCancelDelete}
          deleteCountdown={deleteCountdown}
          message="¿Estás seguro de quitar este producto del inventario de esta tienda?"
        />
      )}

      {/* BARRA DE ESTADO OFFLINE & FRESCURA DEL CATÁLOGO (Fase 6B.4D) */}
      <div className="flex items-center justify-between gap-2 px-1 py-0.5 min-w-0 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <OfflineStatusIndicator
            connectivityState={connectivityState}
            pendingCount={pendingCount}
            totalAttention={totalAttention}
            isSyncing={isSyncing}
            onOpenPanel={() => setIsOfflinePanelOpen(true)}
          />
          <CatalogFreshnessIndicator
            freshness={catalogFreshness}
            isRefreshing={isRefreshingCatalog}
            onRefresh={refreshCatalog}
            isOnline={isOnline}
          />
        </div>

        {totalAttention > 0 && (
          <Button
            size="sm"
            color="danger"
            variant="flat"
            startContent={<FaTriangleExclamation className="text-xs" />}
            onPress={() => setIsOfflinePanelOpen(true)}
            className="h-7 text-xs font-bold px-2.5 rounded-full"
          >
            {totalAttention} requiere{totalAttention > 1 ? 'n' : ''} atención
          </Button>
        )}
      </div>

      {/* PANEL DE VENTAS PENDIENTES / CONFLICT MANAGEMENT (Fase 6B.4D) */}
      <OfflineSalesPanel
        isOpen={isOfflinePanelOpen}
        onClose={() => setIsOfflinePanelOpen(false)}
        sales={offlineSales}
        pendingCount={pendingCount}
        totalAttention={totalAttention}
        isSyncing={isSyncing}
        storeSlug={slug}
        storeName={shop?.name}
        hasDeficit={catalogFreshness.hasDeficit}
        deficitCount={catalogFreshness.deficitCount}
        onSyncPendingSales={syncPendingSales}
        onRetrySale={retrySale}
        onRetryLocal={retryLocalReconciliation}
        onRefreshCatalog={refreshCatalog}
      />


      {/* LAYOUT SPLIT-SCREEN PROFESIONAL: CATÁLOGO Y TICKET EN TIEMPO REAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:gap-4 items-stretch flex-1 min-h-0 h-full">
        {/* ======================================================== */}
        {/* PANEL IZQUIERDO: ESCÁNER, CATÁLOGO Y FILTROS (~65%)     */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-0 gap-1.5 sm:gap-2 min-w-0">
          {/* BARRA PRINCIPAL DE ESCANEO RÁPIDO & BÚSQUEDA (SECCIÓN 1 - ESTÁTICA) */}
          <div className="shrink-0 bg-background/95 backdrop-blur-sm z-10 flex flex-col gap-2 pb-1.5 sm:pb-2">
            <div className="flex items-center gap-2">

              <div className="relative flex-1">


                <Input
                  ref={searchInputRef}
                  size="md"
                  variant="bordered"
                  placeholder="Buscar producto o escanear código..."
                  startContent={<FaMagnifyingGlass className="text-default-400 text-base ml-0.5" />}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const code = searchQuery.trim();
                      if (!code) return;
                      setSearchQuery("");
                      setDebouncedSearch("");
                      await handleBarcodeScan(code);
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 30);
                    }
                  }}
                  endContent={
                    <div className="flex items-center gap-1.5">
                      {(isSearchingBackend || isResolvingScan) && (
                        <Spinner size="sm" color="primary" />
                      )}
                      {searchQuery && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="h-6 w-6 min-w-6 text-default-400 hover:text-foreground"
                          onPress={() => {
                            setSearchQuery("");
                            setDebouncedSearch("");
                            searchInputRef.current?.focus();
                          }}
                        >
                          <FaXmark className="text-xs" />
                        </Button>
                      )}
                      <Chip
                        size="sm"
                        variant="flat"
                        className="font-mono text-[10px] font-bold text-default-400 bg-default-100 hidden sm:inline-flex h-5"
                      >
                        ENTER
                      </Chip>
                    </div>
                  }
                  classNames={{
                    inputWrapper:
                      "bg-background border-default-300/80 hover:border-primary focus-within:!border-primary h-10 sm:h-11 shadow-sm",
                    input: "text-xs sm:text-sm font-medium",
                  }}
                />
              </div>
              {/* Input de Escaneo y Búsqueda */}
              <Button
                color="success"
                variant="flat"
                size="md"
                onPress={() => setIsCameraScannerOpen(true)}
                title="Abrir cámara para escanear código de barras o QR"
              >
                <TbScan size={20} />
              </Button>


            </div>

            {/* Categorías Horizontales con Flechas de Navegación Izquierda / Derecha */}
            <div className="relative flex items-center w-full gap-1.5 min-w-0">
              {/* Flecha Izquierda */}
              <Button
                size="sm"
                isIconOnly
                variant="flat"
                color="default"
                aria-label="Ver categorías anteriores"
                title="Categorías anteriores"
                isDisabled={!canScrollCategoriesLeft}
                className={`h-7 w-7 min-w-7 rounded-full bg-background border border-default-200 shadow-sm shrink-0 transition-all ${
                  canScrollCategoriesLeft
                    ? "opacity-100 hover:bg-default-100 cursor-pointer"
                    : "opacity-25 cursor-not-allowed pointer-events-none"
                }`}
                onPress={() => handleScrollCategories("left")}
              >
                <FaChevronLeft className="text-[11px] text-foreground" />
              </Button>

              {/* Contenedor desplazable de Categorías */}
              <div
                ref={categoriesScrollRef}
                className="flex items-center gap-1.5 overflow-x-auto w-full py-0.5 sm:py-1 scrollbar-hide scroll-smooth"
              >
                <Button
                  size="sm"
                  variant={activeCategory === "" ? "solid" : "flat"}
                  color={activeCategory === "" ? "primary" : "default"}
                  className="font-bold text-[11px] sm:text-xs shrink-0 h-9 sm:h-7 px-4 sm:px-3 rounded-full"
                  onPress={() => setActiveCategory("")}
                >
                  Todas ({flattenedProducts.length})
                </Button>

                {categories.map((cat: any) => {
                  const catKey = cat.slug || String(cat.id);
                  const isSelected = activeCategory === catKey || activeCategory === String(cat.id) || activeCategory === cat.slug;
                  return (
                    <Button
                      key={cat.id || cat.slug || cat.name}
                      size="sm"
                      variant={isSelected ? "solid" : "flat"}
                      color={isSelected ? "primary" : "default"}
                      className="font-semibold text-[11px] sm:text-xs shrink-0 h-9 sm:h-7 px-4 sm:px-3 border border-default-200 rounded-full"
                      onPress={() => setActiveCategory(isSelected ? "" : catKey)}
                    >
                      <span
                        className="w-2 h-2 rounded-full mr-1 shrink-0"
                        style={{ backgroundColor: cat.color || "#6366f1" }}
                      />
                      <span>{getLeafCategoryName(cat.name)}</span>
                      {cat.product_count !== undefined && (
                        <span className="text-[10px] opacity-75 ml-1">({cat.product_count})</span>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Flecha Derecha */}
              <Button
                size="sm"
                isIconOnly
                variant="flat"
                color="default"
                aria-label="Ver más categorías"
                title="Más categorías"
                isDisabled={!canScrollCategoriesRight}
                className={`h-7 w-7 min-w-7 rounded-full bg-background border border-default-200 shadow-sm shrink-0 transition-all ${
                  canScrollCategoriesRight
                    ? "opacity-100 hover:bg-default-100 cursor-pointer"
                    : "opacity-25 cursor-not-allowed pointer-events-none"
                }`}
                onPress={() => handleScrollCategories("right")}
              >
                <FaChevronRight className="text-[11px] text-foreground" />
              </Button>
            </div>

            {/* Filtros Secundarios: Stock, Marcas y Vista */}
            <div className="hidden sm:flex items-center justify-between gap-2 pt-1 border-t border-default-100 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0 flex-1">
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant={stockFilter !== "all" ? "solid" : "flat"}
                      color={stockFilter !== "all" ? "warning" : "default"}
                      startContent={<FaSliders className="text-xs" />}
                      className="h-7 text-[10px] sm:text-xs font-semibold shrink-0 px-2 sm:px-3"
                    >
                      {stockFilter === "all" && <><span className="sm:hidden">Stock</span><span className="hidden sm:inline">Todos los stocks</span></>}
                      {stockFilter === "in_stock" && "Con Existencias"}
                      {stockFilter === "low_stock" && "Stock Bajo"}
                      {stockFilter === "out_of_stock" && "Agotados"}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Filtrar por stock">
                    <DropdownItem key="all" onPress={() => setStockFilter("all")}>
                      Todos los productos
                    </DropdownItem>
                    <DropdownItem key="in_stock" onPress={() => setStockFilter("in_stock")}>
                      Solo con existencias
                    </DropdownItem>
                    <DropdownItem key="low_stock" onPress={() => setStockFilter("low_stock")}>
                      Stock bajo / Alertas
                    </DropdownItem>
                    <DropdownItem key="out_of_stock" onPress={() => setStockFilter("out_of_stock")}>
                      Agotados
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>

                <Button
                  size="sm"
                  variant={activeBrand ? "solid" : "flat"}
                  color={activeBrand ? "secondary" : "default"}
                  startContent={<FaTag className="text-xs" />}
                  onPress={() => setIsModalBrandsOpen(true)}
                  className="h-7 text-xs font-semibold"
                >
                  <span className="max-w-[90px] sm:max-w-none truncate">{activeBrand ? activeBrand : "Marcas"}</span>
                </Button>

                {(Boolean(searchQuery) || Boolean(activeCategory) || Boolean(activeBrand) || stockFilter !== "all") && (
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    className="h-7 text-[10px] sm:text-xs font-bold shrink-0 px-2 sm:px-3"
                    onPress={() => {
                      setSearchQuery("");
                      setDebouncedSearch("");
                      setActiveCategory("");
                      setActiveBrand("");
                      setStockFilter("all");
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="hidden sm:inline text-[11px] text-default-400 font-medium">
                  {filteredProducts.length} ítem(s)
                </span>
                <div className="flex items-center bg-default-100 p-0.5 rounded-lg border border-default-200">
                  <Tooltip content="Vista de Cuadrícula Táctil">
                    <Button
                      size="sm"
                      isIconOnly
                      variant={viewMode === "cards" ? "solid" : "light"}
                      color={viewMode === "cards" ? "primary" : "default"}
                      className="h-6 w-6 min-w-6 rounded-md"
                      onPress={() => setViewMode("cards")}
                    >
                      <FaTableCells className="text-xs" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Vista de Lista Rápida">
                    <Button
                      size="sm"
                      isIconOnly
                      variant={viewMode === "list" ? "solid" : "light"}
                      color={viewMode === "list" ? "primary" : "default"}
                      className="h-6 w-6 min-w-6 rounded-md"
                      onPress={() => setViewMode("list")}
                    >
                      <FaList className="text-xs" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Acciones flotantes móviles estilo mapa: reutilizan los filtros existentes */}
          <div className="sm:hidden fixed right-3 top-[43%] -translate-y-1/2 z-40 flex flex-col gap-3">
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly aria-label="Filtrar stock" className="w-12 h-12 min-w-12 rounded-full bg-background text-foreground border border-default-200 shadow-lg"><FaSliders /></Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Filtrar por stock">
                <DropdownItem key="all" onPress={() => setStockFilter("all")}>Todos los productos</DropdownItem>
                <DropdownItem key="in_stock" onPress={() => setStockFilter("in_stock")}>Con existencias</DropdownItem>
                <DropdownItem key="low_stock" onPress={() => setStockFilter("low_stock")}>Stock bajo</DropdownItem>
                <DropdownItem key="out_of_stock" onPress={() => setStockFilter("out_of_stock")}>Agotados</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Button isIconOnly aria-label="Filtrar marcas" onPress={() => setIsModalBrandsOpen(true)} className={`w-12 h-12 min-w-12 rounded-full border shadow-lg ${activeBrand ? "bg-secondary text-white border-secondary" : "bg-background text-foreground border-default-200"}`}><FaTag /></Button>
            <Button isIconOnly aria-label="Cambiar vista" onPress={() => setViewMode(viewMode === "cards" ? "list" : "cards")} className="w-12 h-12 min-w-12 rounded-full bg-background text-primary border border-default-200 shadow-lg">{viewMode === "cards" ? <FaTableCells /> : <FaList />}</Button>
          </div>

          {/* CONTENEDOR CON SCROLL DEL CATÁLOGO DE PRODUCTOS (TABLA / GRILLA) */}
          <div
            ref={catalogScrollRef}
            onScroll={handleCatalogScroll}
            className="flex-1 overflow-y-auto min-h-0 pr-1 flex flex-col gap-2 sm:gap-3"
          >
            {/* LISTADO DE PRODUCTOS DEL CATÁLOGO */}
            {isLoading || isSearchingBackend ? (
              <ProductGridSkeleton count={viewMode === "cards" ? 10 : 8} viewMode={viewMode} />
            ) : filteredProducts.length === 0 ? (
              <Card className="p-8 text-center bg-background border border-default-200 rounded-2xl">
                <CardBody className="flex flex-col items-center justify-center gap-2.5">
                  <div className="p-3.5 rounded-full bg-default-100 text-default-400">
                    <FaBarcode className="text-3xl" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {searchQuery
                      ? "Sin resultados para tu búsqueda"
                      : activeCategory || activeBrand || stockFilter !== "all"
                      ? "Sin coincidencias de filtro"
                      : "Catálogo vacío"}
                  </h3>
                  <p className="text-default-500 text-xs max-w-sm">
                    {searchQuery
                      ? `No encontramos productos para "${searchQuery}". Revisa la ortografía o intenta con otro término.`
                      : activeCategory || activeBrand || stockFilter !== "all"
                      ? "No hay productos en esta tienda que coincidan con la categoría, marca o disponibilidad seleccionada."
                      : "No hay productos disponibles en esta tienda actualmente."}
                  </p>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    className="font-bold text-xs"
                    onPress={() => {
                      setSearchQuery("");
                      setDebouncedSearch("");
                      setActiveCategory("");
                      setActiveBrand("");
                      setStockFilter("all");
                    }}
                  >
                    Restablecer Filtros
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <>
                {/* ── VISTA CUADRÍCULA PLANA (MEMOIZADA) ── */}
                {viewMode === "cards" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-2.5">
                    {filteredProducts.map((product) => {
                      const prodCartId = product.inventory_id ?? product.id;
                      return (
                        <ProductCard
                          key={prodCartId}
                          product={product}
                          qtyInCart={cartQtyMap.get(prodCartId) || 0}
                          isJustScanned={recentlyScannedId === prodCartId}
                          canEditInventory={canEditInventory}
                          isOnline={isOnline}
                          onAddToCart={handleAddToCart}
                          onUpdateQty={handleUpdateQty}
                          onOpenEdit={handleOpenEditModal}
                          onReturn={handleReturn}
                          onViewProduct={handleViewProduct}
                        />
                      );
                    })}
                  </div>
                ) : (
                  /* ── VISTA DE LISTA COMPACTA DE SUPERMERCADO (MEMOIZADA) ── */
                  <div className="bg-background border border-default-200 rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-default-50 text-default-500 border-b border-default-200 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Producto</th>
                          <th className="py-2 px-2 text-center">Stock</th>
                          <th className="py-2 px-2 text-right">Precio</th>
                          <th className="py-2 px-3 text-center">Acción</th>
                          {canEditInventory && <th className="py-2 px-2 text-center w-8"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default-100">
                        {filteredProducts.map((product) => {
                          const prodCartId = product.inventory_id ?? product.id;
                          return (
                            <ProductTableRow
                              key={prodCartId}
                              product={product}
                              qtyInCart={cartQtyMap.get(prodCartId) || 0}
                              canEditInventory={canEditInventory}
                              onAddToCart={handleAddToCart}
                              onUpdateQty={handleUpdateQty}
                              onOpenEdit={handleOpenEditModal}
                              onReturn={handleReturn}
                              onViewProduct={handleViewProduct}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── SENTINEL: Infinite Scroll ────────────────────────────────────────
                Elemento al fondo del catálogo. Cuando entra en el viewport
                el IntersectionObserver dispara handleLoadMore().              */}
            <div ref={sentinelRef} className="w-full h-6 flex items-center justify-center" aria-hidden="true" />

            {/* Spinner de carga de más páginas */}
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-3 text-default-500">
                <Spinner size="sm" color="primary" />
                <span className="text-xs font-medium">Cargando más productos...</span>
              </div>
            )}

            {/* Botón interactivo para cargar siguiente página si el usuario lo desea */}
            {hasMore && !isLoadingMore && !isLoading && (
              <div className="flex flex-col items-center gap-1 py-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  className="text-xs text-default-600 font-semibold"
                  onPress={handleLoadMore}
                >
                  Cargar más productos...
                </Button>
                <span className="text-[10px] text-default-400">
                  {flattenedProducts.length} productos mostrados · desplaza hacia abajo para más
                </span>
              </div>
            )}

            {/* Indicador de fin de catálogo (sin más páginas) */}
            {!hasMore && !isLoading && flattenedProducts.length > 0 && (
              <p className="text-center text-[11px] text-default-400 py-2 select-none">
                ✓ Catálogo completo · {flattenedProducts.length} producto(s)
              </p>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* PANEL DERECHO: TICKET DE VENTA EN VIVO (SECCIÓN 2 - ESTÁTICA) */}
        {/* ======================================================== */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 h-full min-h-0 flex flex-col">
          <Card className="border border-default-200/90 shadow-sm bg-background rounded-2xl flex flex-col h-full min-h-0 overflow-hidden">
            {/* Encabezado del Ticket */}
            <div className="p-3.5 border-b border-default-100 flex items-center justify-between bg-default-50/60 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FaReceipt className="text-base" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                    Ticket de Venta
                    <Chip size="sm" color="success" variant="flat" className="font-black text-[10px] h-4.5">
                      {totalUnits} u.
                    </Chip>
                  </h3>
                  <p className="text-[10px] text-default-400">En mostrador en vivo</p>
                </div>
              </div>

              {cart.length > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  className="h-7 text-xs font-bold"
                  startContent={<FaTrash className="text-[10px]" />}
                  onPress={() => clearCart()}
                >
                  Vaciar
                </Button>
              )}
            </div>

            {/* Lista de Ítems del Ticket (Scrollable) */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3 flex flex-col gap-2 divide-y divide-default-100">
              {cart.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 gap-2.5">
                  <div className="p-4 rounded-2xl bg-default-100 text-default-400">
                    <FaBarcode className="text-3xl animate-pulse" />
                  </div>
                  <p className="font-bold text-sm text-foreground">El carrito está listo</p>
                  <p className="text-default-400 text-xs max-w-[220px]">
                    Pasa un producto por la pistola lectora o selecciónalo del catálogo.
                  </p>
                  <Chip size="sm" variant="flat" className="text-[10px] font-mono text-default-400">
                    Presiona [F2] para buscar
                  </Chip>
                </div>
              ) : (
                cart.map((item) => {
                  const isHighlighted = recentlyScannedId === item.inventory_id;
                  const subtotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);

                  return (
                    <div
                      key={item.inventory_id}
                      className={`pt-2 first:pt-0 flex items-center justify-between gap-2.5 transition-all duration-300 rounded-xl p-1.5 ${isHighlighted
                        ? "bg-emerald-500/15 ring-2 ring-emerald-500/50 scale-[1.01]"
                        : "hover:bg-default-50"
                        }`}
                    >
                      {/* Miniatura y Datos */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg border border-default-200 bg-default-100 shrink-0 overflow-hidden flex items-center justify-center">
                          {!item.thumbnail ? (
                            <FaBoxesStacked className="text-default-400 text-xs" />
                          ) : (
                            <img
                              src={getImageUrl(item.thumbnail)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                e.currentTarget.src = '/favicon.ico';
                              }}
                            />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-foreground truncate max-w-[140px]" title={item.name}>
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-default-400">
                            <span><PriceDisplay amount={item.price} /> c/u</span>
                            {item.sku && <span className="font-mono">#{item.sku}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Stepper Cantidad */}
                      <div className="flex items-center bg-default-100 rounded-xl p-0.5 border border-default-200 shrink-0">
                        <Button
                          size="sm"
                          isIconOnly
                          variant="light"
                          className="h-6 w-6 min-w-6"
                          onPress={() => updateQty(item.inventory_id, item.quantity - 1)}
                        >
                          <FaMinus className="text-[8px]" />
                        </Button>
                        <span className="font-black text-xs px-1 min-w-[22px] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          isIconOnly
                          variant="light"
                          color="success"
                          className="h-6 w-6 min-w-6"
                          isDisabled={item.quantity >= item.stock_quantity}
                          onPress={() => {
                            updateQty(item.inventory_id, item.quantity + 1);
                            scannerAudio.playSuccess();
                          }}
                        >
                          <FaPlus className="text-[8px]" />
                        </Button>
                      </div>

                      {/* Subtotal e Icono Eliminar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 min-w-[55px] text-right">
                          <PriceDisplay amount={subtotal} />
                        </span>
                        <Button
                          size="sm"
                          isIconOnly
                          variant="light"
                          className="h-6 w-6 min-w-6 text-default-300 hover:text-danger rounded-lg"
                          onPress={() => removeItem(item.inventory_id)}
                        >
                          <FaTrash className="text-[10px]" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del Ticket: Resumen Financiero y Cobro Rápido */}
            <div className="p-3.5 border-t border-default-200/80 bg-default-50/70 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between text-xs text-default-500">
                <span>Productos en carrito:</span>
                <span className="font-bold text-foreground">
                  {cart.length} líneas ({totalUnits} unidades)
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-default-200/50">
                <span className="text-xs font-black text-default-500 uppercase tracking-wider">
                  Total a Cobrar
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  <PriceDisplay amount={totalAmount} />
                </span>
              </div>

              {/* BOTÓN COBRAR (F4) */}
              <Button
                size="lg"
                color="success"
                variant="solid"
                className="w-full font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm h-12 text-sm uppercase tracking-wide"
                startContent={<FaCashRegister className="text-base" />}
                isDisabled={cart.length === 0}
                onPress={openCart}
              >
                Cobrar Venta [F4]
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* BARRA FLOTANTE DE COBRO RÁPIDO PARA MÓVIL / TABLET (< 1024px) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-16 inset-x-0 bg-background/95 backdrop-blur-xl border-t border-default-200 px-3 py-2 z-40 flex items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <FaCartShopping className="text-sm" />
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[10px] text-default-500 font-semibold">{totalUnits} producto(s)</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap"><PriceDisplay amount={totalAmount} /></span>
            </div>
          </div>

          <Button
            color="success"
            variant="solid"
            size="md"
            className="font-black text-white bg-emerald-600 hover:bg-emerald-700 px-4 min-w-[118px] shadow-sm"
            startContent={<FaCashRegister />}
            onPress={openCart}
          >
            Cobrar
          </Button>
        </div>
      )}

    </div>
  );
};

export default ShopHome;
