import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Input,
  Spinner,
  Badge,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { DynamicBreadcrumbs } from "@/components/ui/dynamic-breadcrumbs";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { OptimizedProductImage } from "../../components/OptimizedProductImage";
import {
  FaEye,
  FaPencil,
  FaTrash,
  FaCartPlus,
  FaPlus,
  FaBoxesStacked,
  FaWarehouse,
  FaCoins,
  FaTriangleExclamation,
  FaList,
  FaTableCellsLarge,
  FaArrowRightFromBracket,
  FaTag,
  FaRotate,
  FaXmark,
  FaLocationDot,
  FaBuilding,
  FaQrcode,
  FaTruckFast,
  FaClockRotateLeft,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa6";
import { IoMdSearch } from "react-icons/io";
import { RiMoreFill } from "react-icons/ri";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DrawerTransferCart } from "./drawer-transfer-cart";
import { FloatingTransferCartBubble } from "../../components/FloatingTransferCartBubble";
import { ModalDispatchSuccess } from "./modal-dispatch-success";
import { ModalMovementsHistory } from "./modal-movements-history";
import { useStockMovementsStore, StockMovementRecord } from "../../store/movements/stock-movements.store";
import { ModalBrands } from "@/components/modals/modal-brands";
import { AlertDelete } from "@/components";
import { ModalAddStock } from "./modal-add-stock";
import { ModalRegisterPurchase } from "./modal-register-purchase";
import { ModalQrPdf } from "./modal-qr-pdf";
import { PriceDisplay, CompactNumber } from "@/components";
import { getImageUrl } from "@/utils/image";
import { getLeafCategoryName } from "@/utils/category";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCategoriesStore } from "@/modules/tenant/products/store/categories/categories.store";
import { useBrandsStore } from "@/modules/tenant/products/store/brands/brands.store";
import { useWarehouseStore } from "../../store/inventories/inv-warehouse.store";

export const IndexInventories = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useTenantAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  const [isLoading, setIsLoading] = useState(false);
  const categories = useCategoriesStore((state) => state.categories);
  const getCategories = useCategoriesStore((state) => state.getCategories);
  const brands = useBrandsStore((state) => state.brands);
  const getBrands = useBrandsStore((state) => state.getBrands);
  const deleteProduct = useWarehouseStore((state) => state.deleteWarehouseProduct);
  const deleteAllWarehouseProducts = useWarehouseStore((state) => state.deleteAllWarehouseProducts);
  const deleteOutOfStockWarehouseProducts = useWarehouseStore((state) => state.deleteOutOfStockWarehouseProducts);
  const warehouseProducts = useWarehouseStore((state) => state.warehouseProducts);
  const warehouseCategories = useWarehouseStore((state) => state.categories);
  const getWarehouseProducts = useWarehouseStore((state) => state.getWarehouseProducts);
  const loadMoreWarehouseProducts = useWarehouseStore((state) => state.loadMoreWarehouseProducts);
  const hasMore = useWarehouseStore((state) => state.hasMore);
  const isLoadingMore = useWarehouseStore((state) => state.isLoadingMore);
  const isLoadingProducts = useWarehouseStore((state) => state.isLoadingProducts);
  const summary = useWarehouseStore((state) => state.summary);
  const getSummary = useWarehouseStore((state) => state.getSummary);

  // Categorías de almacén (con conteo de stock) o lista global como respaldo
  const displayCategories = useMemo(() => {
    return warehouseCategories && warehouseCategories.length > 0 ? warehouseCategories : categories;
  }, [warehouseCategories, categories]);

  // Control de scroll horizontal de la barra de categorías (similar a POS)
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);

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
  }, [displayCategories, checkCategoryScroll]);

  const handleScrollCategories = (direction: "left" | "right") => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -260 : 260;
    el.scrollBy({ left: amount, behavior: "smooth" });
    setTimeout(checkCategoryScroll, 320);
  };

  // Estados para eliminación masiva en almacén
  const [bulkDeleteModalType, setBulkDeleteModalType] = useState<"out_of_stock" | "all" | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Filtros activos desde URL
  const activeBrandSlug = searchParams.get("brands") || "";
  const activeCategorySlug = searchParams.get("categories") || "";
  const activeSearchQuery = searchParams.get("search") || "";

  // Estado local para input de búsqueda
  const [searchInput, setSearchInput] = useState(activeSearchQuery);

  // Vista activa: 'grid' o 'table' (persiste en localStorage)
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    return (localStorage.getItem("inv_warehouse_view_mode") as "grid" | "table") || "grid";
  });

  const handleSetViewMode = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("inv_warehouse_view_mode", mode);
  };

  // Modales
  const [isModalBrandsOpen, setIsModalBrandsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [openModalAddStock, setOpenModalAddStock] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Transfer Cart & Movimientos
  const cartItems = useStockMovementsStore((state) => state.cartItems);
  const addToCart = useStockMovementsStore((state) => state.addToCart);
  const totalCartUnits = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const [isTransferCartOpen, setIsTransferCartOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastDispatchedMovement, setLastDispatchedMovement] = useState<StockMovementRecord | null>(null);

  // Eliminación con confirmación y temporizador
  const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);

  // Carga inicial y actualización en segundo plano
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!token) return;
      if (!isBackground) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const params: Record<string, any> = {};
      if (activeBrandSlug) params.brands = activeBrandSlug;
      if (activeCategorySlug) params.categories = activeCategorySlug;
      if (activeSearchQuery) params.search = activeSearchQuery;

      try {
        await Promise.all([
          getWarehouseProducts(params, token),
          getSummary(token),
          useCategoriesStore.getState().categories.length === 0 ? getCategories(token) : Promise.resolve(),
          useBrandsStore.getState().brands.length === 0 ? getBrands(token) : Promise.resolve(),
        ]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, activeBrandSlug, activeCategorySlug, activeSearchQuery, getWarehouseProducts, getSummary, getCategories, getBrands]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sincronizar input local si cambia el query param en URL desde afuera
  useEffect(() => {
    setSearchInput(activeSearchQuery);
  }, [activeSearchQuery]);

  // Debounce para sincronizar búsqueda con la URL sin provocar recargas
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = searchParams.get("search") || "";
      if (searchInput !== currentParam) {
        const newParams = new URLSearchParams(searchParams);
        if (searchInput.trim()) {
          newParams.set("search", searchInput.trim());
        } else {
          newParams.delete("search");
        }
        setSearchParams(newParams, { replace: true });
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  const applyFilter = (type: "search" | "brands" | "categories" | "clear", value?: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (type === "clear") {
      newParams.delete("search");
      newParams.delete("brands");
      newParams.delete("categories");
      setSearchInput("");
    } else if (value && value.trim()) {
      newParams.set(type, value.trim());
      if (type === "search") setSearchInput(value.trim());
    } else {
      newParams.delete(type);
      if (type === "search") setSearchInput("");
    }
    setSearchParams(newParams, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Temporizador para eliminación
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
    if (deleteRowId) {
      await deleteProduct(deleteRowId, token!);
      setDeleteRowId(null);
      setDeleteCountdown(null);
      fetchData(true);
    }
  };

  const handleCancelDelete = () => {
    setDeleteRowId(null);
    setDeleteCountdown(null);
  };

  // Controladores de modales
  const handleOpenAddStock = (prod: any) => {
    setSelectedProduct(prod);
    setOpenModalAddStock(true);
  };

  const handleCloseAddStock = () => {
    setOpenModalAddStock(false);
    fetchData(true);
  };

  // Aplanar todos los productos para métricas y vista unificada sin agrupación forzada
  const allProducts = useMemo(() => {
    return warehouseProducts.flatMap((g: any) =>
      (g.products || []).map((p: any) => ({
        ...p,
        category_name: getLeafCategoryName(p.category || p.category_path || g.category || g.category_path || ""),
        category_slug: p.category_slug || g.category_slug || g.slug_category || g.slug || "",
        category_id: p.category_id || g.category_id || "",
        category_color: p.color || g.color || "#6366f1",
        brand_slug: p.brand_slug || "",
      }))
    );
  }, [warehouseProducts]);

  // Manejador para confirmación de eliminación masiva
  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteModalType) return;
    setIsBulkDeleting(true);
    let success = false;
    if (bulkDeleteModalType === "out_of_stock") {
      success = await deleteOutOfStockWarehouseProducts();
    } else if (bulkDeleteModalType === "all") {
      success = await deleteAllWarehouseProducts();
    }
    setIsBulkDeleting(false);
    if (success) {
      setBulkDeleteModalType(null);
      fetchData(true);
    }
  };

  // Los productos ya vienen paginados y filtrados desde el servidor
  const filteredProducts = allProducts;
  const visibleProducts = allProducts;

  // IntersectionObserver para scroll infinito real conectado al backend
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const params: Record<string, any> = {};
          if (activeBrandSlug) params.brands = activeBrandSlug;
          if (activeCategorySlug) params.categories = activeCategorySlug;
          if (activeSearchQuery) params.search = activeSearchQuery;
          loadMoreWarehouseProducts(params);
        }
      },
      {
        rootMargin: "350px",
        threshold: 0,
      }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, activeBrandSlug, activeCategorySlug, activeSearchQuery, loadMoreWarehouseProducts]);

  // Cálculo de KPIs directos desde la base de datos (Backend summary)
  const stats = useMemo(() => {
    return {
      totalProducts: summary?.total_products ?? summary?.totalProducts ?? 0,
      totalStock: summary?.total_stock ?? summary?.totalStock ?? 0,
      totalValue: summary?.total_value ?? summary?.totalValue ?? 0,
      outOfStock: summary?.out_of_stock ?? summary?.outOfStock ?? 0,
      lowStock: summary?.low_stock ?? summary?.lowStock ?? 0,
    };
  }, [summary]);

  // Cantidad de productos agotados en almacén (desde KPIs backend)
  const outOfStockCount = stats.outOfStock;

  // Nombre de marca activa para chip
  const activeBrandName = useMemo(() => {
    if (!activeBrandSlug) return "";
    const found = brands.find((b: any) => b.slug === activeBrandSlug);
    return found ? found.name : activeBrandSlug;
  }, [activeBrandSlug, brands]);

  // Nombre de categoría activa para chip
  const activeCategoryName = useMemo(() => {
    if (!activeCategorySlug) return "";
    const found = categories.find((c: any) => c.slug === activeCategorySlug);
    const rawName = found ? found.name : activeCategorySlug;
    return getLeafCategoryName(rawName);
  }, [activeCategorySlug, categories]);

  const hasActiveFilters = Boolean(
    activeBrandSlug || activeCategorySlug || activeSearchQuery || searchInput
  );

  return (
    <>
      <div className="my-1 px-2 lg:px-4 max-w-[98rem] mx-auto w-full flex flex-col gap-2">
        <DynamicBreadcrumbs title="Inventarios" />

        {/* 1. HEADER PRINCIPAL CON ACCIONES REORGANIZADAS */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 bg-background/80 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-default-200/80 shadow-sm">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
                Productos en Almacén
              </h1>
            </div>
            <p className="text-xs text-default-500 font-normal line-clamp-1 hidden sm:block">
              Control centralizado de compras, existencias, costos y movimientos a tiendas
            </p>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-between sm:justify-end flex-wrap">


            {/* Separador vertical sutil */}
            <div className="hidden sm:block h-6 w-px bg-default-200" />

            {/* SECCIÓN 2: OPERACIONES Y MOVIMIENTOS DE ALMACÉN */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1 sm:flex-initial justify-end">
              {/* BOTÓN DESCARGAR CÓDIGOS QR (ACCESO RÁPIDO EN PANTALLAS GRANDES) */}
              <Tooltip content="Generar e imprimir etiquetas QR">
                <Button
                  color="default"
                  variant="flat"
                  size="sm"
                  startContent={<FaQrcode className="text-xs text-default-600" />}
                  onPress={() => setIsQrModalOpen(true)}
                  className="hidden lg:inline-flex font-medium text-xs h-9 px-2.5 sm:px-3 border border-default-200 text-default-700 hover:bg-default-100"
                >
                  <span className="hidden sm:inline">Descargar </span>QR
                </Button>
              </Tooltip>

              {/* BOTÓN HISTORIAL DE MOVIMIENTOS / ENVÍOS (ACCESO RÁPIDO EN PANTALLAS GRANDES) */}
              <Button
                color="default"
                variant="flat"
                size="sm"
                startContent={<FaClockRotateLeft className="text-xs text-default-600" />}
                onPress={() => setIsHistoryModalOpen(true)}
                className="hidden lg:inline-flex font-medium text-xs h-9 px-2.5 sm:px-3 border border-default-200 text-default-700 hover:bg-default-100"
              >
                Historial <span className="hidden sm:inline">Envíos </span>
              </Button>

              {/* BOTÓN CARRITO DE TRANSFERENCIAS A TIENDAS */}
              <Badge
                content={totalCartUnits}
                isInvisible={cartItems.length === 0}
                color="danger"
                shape="circle"
                size="sm"
              >
                <Button
                  color="success"
                  variant="solid"
                  size="sm"
                  startContent={<FaTruckFast className="text-xs text-default-600" />}
                  onPress={() => setIsTransferCartOpen(true)}
                  className="font-medium text-xs h-9 px-2.5 sm:px-3 border border-default-200 text-default-700 hover:bg-default-100"
                >
                  <span className="hidden sm:inline">Carrito </span>Salida
                </Button>
              </Badge>

              {/* BOTÓN REGISTRAR COMPRA (PRIMARIO DESTACADO) */}
              <Button
                color="primary"
                variant="solid"
                size="sm"
                startContent={<FaCartPlus className="text-sm" />}
                onPress={() => setIsPurchaseModalOpen(true)}
                className="font-bold text-xs h-9 px-3.5 sm:px-4 bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:opacity-95 transition-opacity"
              >
                <span className="hidden sm:inline">Registrar </span>Compra
              </Button>

              {/* BOTÓN DROPDOWN DE ACCIONES AGRUPADAS Y LIMPIEZA (...) */}
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    variant="flat"
                    size="sm"
                    className="h-9 w-9 min-w-9 border border-default-200 text-default-700 hover:bg-default-100"
                    aria-label="Más opciones de almacén"
                  >
                    <RiMoreFill className="text-lg" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Opciones avanzadas de almacén"
                  onAction={(key) => {
                    if (key === "qr") setIsQrModalOpen(true);
                    if (key === "history") setIsHistoryModalOpen(true);
                    if (key === "delete-out-of-stock") setBulkDeleteModalType("out_of_stock");
                    if (key === "delete-all") setBulkDeleteModalType("all");
                  }}
                >
                  <DropdownItem
                    key="qr"
                    className="lg:hidden"
                    startContent={<FaQrcode className="text-default-500" />}
                    description="Generar etiquetas e imprimir QR"
                  >
                    Descargar Códigos QR
                  </DropdownItem>
                  <DropdownItem
                    key="history"
                    className="lg:hidden"
                    startContent={<FaClockRotateLeft className="text-default-500" />}
                    description="Historial de traslados a tiendas"
                  >
                    Historial de Envíos
                  </DropdownItem>
                  <DropdownItem
                    key="delete-out-of-stock"
                    className="text-warning"
                    color="warning"
                    startContent={<FaTriangleExclamation className="text-warning text-sm" />}
                    description={`Eliminar productos con stock 0 (${outOfStockCount})`}
                  >
                    Eliminar productos agotados
                  </DropdownItem>
                  <DropdownItem
                    key="delete-all"
                    className="text-danger"
                    color="danger"
                    startContent={<FaTrash className="text-danger text-sm" />}
                    description={`Vaciar existencias (${stats.totalProducts} productos)`}
                  >
                    Eliminar todos los productos del almacén
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
        </div>

        {/* 2. TARJETAS DE MÉTRICAS / KPIS (CON NÚMEROS COMPACTOS Y TOOLTIP DE VALOR ORIGINAL) */}
        {/* MODO CELULAR: ACORDEÓN ELEGANTE Y COLAPSABLE PARA AHORRAR ESPACIO VERTICAL */}
        <div className="sm:hidden">
          <Accordion
            variant="bordered"
            className="border border-default-200/80 rounded-2xl bg-background/80 backdrop-blur-md shadow-xs px-1"
          >
            <AccordionItem
              key="metrics-accordion"
              aria-label="Resumen de Métricas de Almacén"
              startContent={
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FaBoxesStacked className="text-base" />
                </div>
              }
              title={
                <div className="flex items-center justify-between gap-2 pr-1">
                  <span className="text-xs font-bold text-foreground">
                    Métricas de Inventario
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-foreground">
                      <CompactNumber value={stats.totalProducts} /> prods
                    </span>
                    <span className="text-default-300">•</span>
                    <span className="font-semibold text-success-600">
                      <CompactNumber value={stats.totalStock} suffix="u." />
                    </span>
                  </div>
                </div>
              }
              subtitle={
                <div className="flex items-center gap-1.5 text-[10px] text-default-400 mt-0.5">
                  <span>Inversión: <PriceDisplay amount={stats.totalValue} compact /></span>
                  <span>•</span>
                  <span className="text-danger-500 font-medium">
                    {stats.outOfStock + stats.lowStock} alertas
                  </span>
                </div>
              }
              classNames={{
                title: "text-xs font-bold",
                subtitle: "text-[10px]",
                content: "pt-1 pb-2.5",
              }}
            >
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Card 1: Total Productos */}
                <Card className="border border-default-200/80 bg-background/60 shadow-none">
                  <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-medium text-default-500 uppercase tracking-wider truncate">
                        Productos
                      </span>
                      <span className="text-lg font-bold text-foreground mt-0.5">
                        <CompactNumber value={stats.totalProducts} />
                      </span>
                      <span className="text-[9px] text-default-400 mt-0.5 truncate">
                        {categories.length} categorías
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                      <FaBoxesStacked className="text-base" />
                    </div>
                  </CardBody>
                </Card>

                {/* Card 2: Stock Total */}
                <Card className="border border-default-200/80 bg-background/60 shadow-none">
                  <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-medium text-default-500 uppercase tracking-wider truncate">
                        Stock Total
                      </span>
                      <span className="text-lg font-bold text-success-600 dark:text-success-400 mt-0.5">
                        <CompactNumber value={stats.totalStock} suffix="u." />
                      </span>
                      <span className="text-[9px] text-default-400 mt-0.5 truncate">
                        Unid. disp.
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-success/10 text-success-600 shrink-0">
                      <FaWarehouse className="text-base" />
                    </div>
                  </CardBody>
                </Card>

                {/* Card 3: Inversión */}
                <Card className="border border-default-200/80 bg-background/60 shadow-none">
                  <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-medium text-default-500 uppercase tracking-wider truncate">
                        Inversión
                      </span>
                      <span className="text-lg font-bold text-warning-600 dark:text-warning-500 mt-0.5">
                        <PriceDisplay amount={stats.totalValue} compact />
                      </span>
                      <span className="text-[9px] text-default-400 mt-0.5 truncate">
                        A costo
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-warning/10 text-warning-600 shrink-0">
                      <FaCoins className="text-base" />
                    </div>
                  </CardBody>
                </Card>

                {/* Card 4: Alertas Stock */}
                <Card className="border border-default-200/80 bg-background/60 shadow-none">
                  <CardBody className="p-2.5 flex flex-row items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-medium text-default-500 uppercase tracking-wider truncate">
                        Alertas
                      </span>
                      <span className="text-lg font-bold text-danger-500 mt-0.5">
                        <CompactNumber value={stats.outOfStock + stats.lowStock} />
                      </span>
                      <span className="text-[9px] text-default-400 mt-0.5 truncate">
                        {stats.outOfStock} agot. • {stats.lowStock} bajo
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-danger/10 text-danger-500 shrink-0">
                      <FaTriangleExclamation className="text-base" />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </AccordionItem>
          </Accordion>
        </div>

        {/* MODO ESCRITORIO: TARJETAS EN GRID NORMAL VISIBLE */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Productos */}
          <Card className="border border-default-200/80 bg-background/60 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                  Productos
                </span>
                <span className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                  <CompactNumber value={stats.totalProducts} />
                </span>
                <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                  En {categories.length} categorías
                </span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
                <FaBoxesStacked className="text-xl sm:text-2xl" />
              </div>
            </CardBody>
          </Card>

          {/* Card 2: Stock Total */}
          <Card className="border border-default-200/80 bg-background/60 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                  Stock Total
                </span>
                <span className="text-xl sm:text-2xl font-bold text-success-600 dark:text-success-400 mt-0.5">
                  <CompactNumber value={stats.totalStock} suffix="unid." />
                </span>
                <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                  Unidades disponibles
                </span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-success/10 text-success-600 dark:text-success-400 shrink-0">
                <FaWarehouse className="text-xl sm:text-2xl" />
              </div>
            </CardBody>
          </Card>

          {/* Card 3: Valor Total Inventario */}
          <Card className="border border-default-200/80 bg-background/60 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                  Inversión
                </span>
                <span className="text-xl sm:text-2xl font-bold text-warning-600 dark:text-warning-500 mt-0.5">
                  <PriceDisplay amount={stats.totalValue} compact />
                </span>
                <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                  Valoración a costo
                </span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-warning/10 text-warning-600 dark:text-warning-500 shrink-0">
                <FaCoins className="text-xl sm:text-2xl" />
              </div>
            </CardBody>
          </Card>

          {/* Card 4: Alertas de Stock */}
          <Card className="border border-default-200/80 bg-background/60 shadow-sm hover:shadow-md transition-shadow">
            <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                  Alertas Stock
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-bold text-danger-500">
                    <CompactNumber value={stats.outOfStock + stats.lowStock} />
                  </span>
                  <span className="text-xs text-default-500">críticos</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                  {stats.outOfStock} agot. • {stats.lowStock} bajo
                </span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-2xl bg-danger/10 text-danger-500 shrink-0">
                <FaTriangleExclamation className="text-xl sm:text-2xl" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 3. BARRA DE HERRAMIENTAS UNIFICADA: BÚSQUEDA + FILTRO DE MARCAS + SELECTOR DE CATEGORÍAS */}
        <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-md pt-2 pb-2.5 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-default-200/80 shadow-xs flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-default-50/80 dark:bg-default-100/50 p-2 sm:p-2.5 rounded-2xl border border-default-200/80 shadow-2xs">
            {/* Campo de Búsqueda Conectado al Backend */}
            <div className="flex-1 min-w-0">
              <Input
                startContent={<IoMdSearch className="text-default-400 text-base sm:text-lg shrink-0" />}
                isClearable
                placeholder="Buscar producto, marca, código o SKU..."
                size="sm"
                variant="bordered"
                value={searchInput}
                onValueChange={setSearchInput}
                onClear={() => {
                  setSearchInput("");
                  applyFilter("search", "");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyFilter("search", searchInput);
                  }
                }}
                endContent={
                  <div className="flex items-center gap-1.5">
                    {isLoadingProducts && (
                      <Spinner size="sm" color="primary" />
                    )}
                    {searchInput && (
                      <Chip
                        size="sm"
                        variant="flat"
                        className="font-mono text-[10px] font-bold text-default-400 bg-default-100 hidden sm:inline-flex h-5"
                      >
                        ENTER
                      </Chip>
                    )}
                  </div>
                }
                classNames={{
                  inputWrapper: "h-9 bg-background border-default-300 shadow-none",
                  input: "text-xs sm:text-sm",
                }}
              />
            </div>
            {/* SECCIÓN 1: VISTAS Y UTILIDADES */}
            <div className="flex items-center gap-1.5">
              {/* Botón de recarga rápida */}
              <Tooltip content="Actualizar datos">
                <Button
                  isIconOnly
                  variant="flat"
                  color="default"
                  size="sm"
                  onPress={() => fetchData(true)}
                  isLoading={isRefreshing}
                  className="h-9 w-9 min-w-9 border border-default-200"
                >
                  <FaRotate className={isRefreshing ? "animate-spin" : ""} />
                </Button>
              </Tooltip>

              {/* Selector de Vista: Cuadrícula / Tabla */}
              <div className="flex items-center p-0.5 bg-default-100 rounded-xl border border-default-200">
                <Button
                  size="sm"
                  isIconOnly
                  variant={viewMode === "grid" ? "solid" : "light"}
                  color={viewMode === "grid" ? "primary" : "default"}
                  onPress={() => handleSetViewMode("grid")}
                  title="Vista en tarjetas"
                  className="h-7 w-7 min-w-7"
                >
                  <FaTableCellsLarge className="text-xs" />
                </Button>
                <Button
                  size="sm"
                  isIconOnly
                  variant={viewMode === "table" ? "solid" : "light"}
                  color={viewMode === "table" ? "primary" : "default"}
                  onPress={() => handleSetViewMode("table")}
                  title="Vista en tabla"
                  className="h-7 w-7 min-w-7"
                >
                  <FaList className="text-xs" />
                </Button>
              </div>
            </div>

            {/* Botón Filtro Marcas */}
            <Button
              color={activeBrandSlug ? "secondary" : "default"}
              variant={activeBrandSlug ? "flat" : "bordered"}
              size="sm"
              startContent={<FaTag className="text-xs shrink-0" />}
              onPress={() => setIsModalBrandsOpen(true)}
              className="font-medium text-xs h-9 shrink-0 px-2.5 sm:px-3"
            >
              {activeBrandSlug ? (
                <span className="truncate max-w-[100px] sm:max-w-none">{activeBrandName}</span>
              ) : (
                <>
                  <span className="hidden sm:inline">Filtrar por</span>Marca
                </>
              )}
            </Button>

            {/* Limpiar todos los filtros */}
            {hasActiveFilters && (
              <>
                <Button
                  color="danger"
                  variant="light"
                  size="sm"
                  isIconOnly
                  startContent={<FaXmark className="text-xs" />}
                  onPress={() => applyFilter("clear")}
                  className="h-9 w-9 min-w-9 shrink-0 sm:hidden"
                  title="Limpiar filtros"
                />
                <Button
                  color="danger"
                  variant="light"
                  size="sm"
                  startContent={<FaXmark className="text-xs" />}
                  onPress={() => applyFilter("clear")}
                  className="text-xs h-9 shrink-0 hidden sm:flex font-medium"
                >
                  Limpiar
                </Button>
              </>
            )}
          </div>

          {/* Selector Horizontal de Categorías con Flechas de Navegación Izquierda / Derecha (similar a POS) */}
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
              className={`h-7 w-7 min-w-7 rounded-full bg-background border border-default-200 shadow-xs shrink-0 transition-all ${canScrollCategoriesLeft
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
              className="flex items-center gap-1.5 overflow-x-auto w-full py-0.5 sm:py-1 scroll-smooth no-scrollbar"
            >
              <Button
                size="sm"
                variant={!activeCategorySlug ? "solid" : "flat"}
                color={!activeCategorySlug ? "primary" : "default"}
                onPress={() => applyFilter("categories", "")}
                className="font-bold text-[11px] sm:text-xs shrink-0 h-8 sm:h-7 px-3.5 sm:px-3 rounded-full shadow-2xs"
              >
                Todas ({stats.totalProducts})
              </Button>

              {displayCategories.map((category: any) => {
                const isSelected = activeCategorySlug === category.slug;
                const count = category.product_count !== undefined
                  ? category.product_count
                  : allProducts.filter(
                    (p: any) => p.category_slug === category.slug || String(p.category_id) === String(category.id)
                  ).length;

                return (
                  <Button
                    key={category.id || category.slug}
                    size="sm"
                    variant={isSelected ? "solid" : "flat"}
                    color={isSelected ? "primary" : "default"}
                    onPress={() =>
                      applyFilter(
                        "categories",
                        isSelected ? "" : category.slug
                      )
                    }
                    className={`font-semibold text-[11px] sm:text-xs shrink-0 h-8 sm:h-7 px-3.5 sm:px-3 border rounded-full transition-all ${isSelected
                      ? "border-primary shadow-xs"
                      : "border-default-200/80 hover:border-default-300"
                      }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mr-1"
                      style={{ backgroundColor: category.color || "#6366f1" }}
                    />
                    <span>{getLeafCategoryName(category.name)}</span>
                    {count !== undefined && (
                      <span className="text-[10px] opacity-75 ml-1">({count})</span>
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
              className={`h-7 w-7 min-w-7 rounded-full bg-background border border-default-200 shadow-xs shrink-0 transition-all ${canScrollCategoriesRight
                ? "opacity-100 hover:bg-default-100 cursor-pointer"
                : "opacity-25 cursor-not-allowed pointer-events-none"
                }`}
              onPress={() => handleScrollCategories("right")}
            >
              <FaChevronRight className="text-[11px] text-foreground" />
            </Button>
          </div>

          {/* Chips de Filtros Activos */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs px-1">
              <span className="text-[#6B7280] dark:text-default-400 font-medium text-[11px]">Filtros activos:</span>
              {(activeSearchQuery || searchInput) && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="h-6 text-[11px]"
                  onClose={() => applyFilter("search", "")}
                >
                  Búsqueda: <b>{searchInput || activeSearchQuery}</b>
                </Chip>
              )}
              {activeCategorySlug && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                  className="h-6 text-[11px]"
                  onClose={() => applyFilter("categories", "")}
                >
                  Categoría: <b>{getLeafCategoryName(activeCategoryName)}</b>
                </Chip>
              )}
              {activeBrandSlug && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="secondary"
                  className="h-6 text-[11px]"
                  onClose={() => applyFilter("brands", "")}
                >
                  Marca: <b>{activeBrandName}</b>
                </Chip>
              )}
            </div>
          )}
        </div>

        {/* 5. CONTENIDO PRINCIPAL: VISTA DE PRODUCTOS */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-24 gap-3">
            <Spinner size="lg" color="primary" />
            <p className="text-sm text-default-500 animate-pulse font-medium">
              {activeSearchQuery ? `Buscando "${activeSearchQuery}" en almacén...` : "Cargando existencias del almacén..."}
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* ESTADO VACÍO ELEGANTE */
          <Card className="border border-dashed border-default-300 bg-default-50/40 p-8 my-6 text-center">
            <CardBody className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="p-4 rounded-3xl bg-primary/10 text-primary">
                <FaWarehouse className="text-4xl" />
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="text-lg font-bold text-foreground">
                  {hasActiveFilters
                    ? "No se encontraron productos coincidentes"
                    : "El almacén aún no tiene productos registrados"}
                </h3>
                <p className="text-xs text-default-500">
                  {hasActiveFilters
                    ? "Intenta modificar el término de búsqueda o limpiar los filtros seleccionados."
                    : "Comienza registrando la primera compra de existencias para dar ingreso a los productos."}
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                {hasActiveFilters ? (
                  <Button
                    color="primary"
                    variant="flat"
                    size="sm"
                    onPress={() => applyFilter("clear")}
                  >
                    Restablecer Filtros
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    variant="shadow"
                    size="md"
                    startContent={<FaCartPlus />}
                    onPress={() => setIsPurchaseModalOpen(true)}
                  >
                    Registrar Primera Compra
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ) : viewMode === "grid" ? (
          /* ==================== VISTA CUADRÍCULA UNIFICADA (TODO EN UNO) ==================== */
          <div className="flex flex-col gap-4 relative z-0 isolate">
            <div className="grid grid-cols-2 min-[480px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
              {visibleProducts.map((prod: any) => {
                const isOutOfStock = Number(prod.stock_quantity) <= 0;
                const isLowStock =
                  !isOutOfStock &&
                  Number(prod.stock_quantity) <= (Number(prod.min_stock) || 0);

                const totalRowValue =
                  (Number(prod.stock_quantity) || 0) * (Number(prod.price) || 0);

                return (
                  <Card
                    key={prod.inventory_id || prod.id}
                    className="border border-default-200/80 bg-background hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group rounded-2xl"
                  >
                    <CardBody className="p-2 sm:p-3 flex flex-col gap-2 sm:gap-2.5">
                      {/* Cabecera de la Card: Imagen Optimizada + Badges */}
                      <div className="relative w-full aspect-square bg-default-100 rounded-xl overflow-hidden flex items-center justify-center">
                        <OptimizedProductImage
                          src={getImageUrl(prod.thumbnail || prod.image)}
                          alt={prod.name}
                          fallbackBrand={prod.brand}
                          fallbackName={getLeafCategoryName(prod.category_name)}
                          onClick={() => navigate(`/inventories/${prod.slug}`)}
                        />

                        {/* Badge de Estado flotante */}
                        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex gap-1 z-[1] pointer-events-none">
                          {isOutOfStock ? (
                            <Chip size="sm" color="danger" variant="solid" className="text-[9px] sm:text-[10px] font-bold shadow-xs h-4.5 sm:h-5 px-1 sm:px-1.5">
                              <span className="xs:hidden">AGOT.</span>
                              <span className="hidden xs:inline">AGOTADO</span>
                            </Chip>
                          ) : isLowStock ? (
                            <Chip size="sm" color="warning" variant="solid" className="text-[9px] sm:text-[10px] font-bold shadow-xs h-4.5 sm:h-5 px-1 sm:px-1.5">
                              <span className="xs:hidden">BAJO</span>
                              <span className="hidden xs:inline">STOCK BAJO</span>
                            </Chip>
                          ) : (
                            <Chip size="sm" color="success" variant="solid" className="text-[9px] sm:text-[10px] font-bold shadow-xs h-4.5 sm:h-5 px-1 sm:px-1.5">
                              <span className="xs:hidden">DISP.</span>
                              <span className="hidden xs:inline">DISPONIBLE</span>
                            </Chip>
                          )}
                        </div>

                        {/* Dropdown de Opciones */}
                        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-[1]">
                          <Dropdown placement="bottom-end">
                            <DropdownTrigger>
                              <Button
                                isIconOnly
                                size="sm"
                                radius="full"
                                className="bg-background/80 backdrop-blur-md text-foreground shadow-sm hover:bg-background h-6 w-6 min-w-6 sm:h-7 sm:w-7 sm:min-w-7"
                              >
                                <RiMoreFill className="text-xs sm:text-base" />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Acciones de producto">
                              <DropdownItem
                                key="add-stock"
                                startContent={<FaPencil className="text-primary text-xs" />}
                                onPress={() => handleOpenAddStock(prod)}
                              >
                                Agregar / Editar Stock
                              </DropdownItem>
                              <DropdownItem
                                key="kardex"
                                startContent={<FaEye className="text-default-500 text-xs" />}
                                onPress={() => navigate(`/inventories/${prod.slug}`)}
                              >
                                Ver Kardex de Almacén
                              </DropdownItem>
                              <DropdownItem
                                key="delete"
                                className="text-danger"
                                color="danger"
                                startContent={<FaTrash className="text-xs" />}
                                onPress={() => handleDeleteClick(prod.inventory_id)}
                              >
                                Eliminar de Almacén
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </div>
                      </div>

                      {/* Información del Producto */}
                      <div className="flex flex-col gap-1 sm:gap-1.5">
                        {/* Categoría Badge con Color */}
                        {prod.category_name && (
                          <div className="flex items-center gap-1">
                            <span
                              className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md border truncate max-w-full"
                              style={{
                                borderColor: prod.category_color ? `${prod.category_color}50` : undefined,
                                backgroundColor: prod.category_color ? `${prod.category_color}18` : undefined,
                                color: prod.category_color || undefined,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: prod.category_color || "#3b82f6" }}
                              />
                              <span className="truncate">{getLeafCategoryName(prod.category_name)}</span>
                            </span>
                          </div>
                        )}

                        <h3
                          onClick={() => navigate(`/inventories/${prod.slug}`)}
                          className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors leading-tight min-h-[2rem] sm:min-h-[2.5rem]"
                          title={prod.name}
                        >
                          {prod.name}
                        </h3>

                        {/* Tags: Marca, Ubicación, Proveedor */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] sm:text-[11px]">
                          {prod.brand && prod.brand.toUpperCase() !== "DESCONOCIDO" ? (
                            <Chip size="sm" variant="flat" color="secondary" className="h-4 sm:h-5 text-[9px] sm:text-[10px] px-1 sm:px-1.5">
                              {prod.brand}
                            </Chip>
                          ) : (
                            <span className="text-[9px] sm:text-[10px] text-[#6B7280] dark:text-default-400 font-medium bg-default-100 px-1 sm:px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                              {prod.brand || "DESCONOCIDO"}
                            </span>
                          )}
                          {(prod.location_path || prod.location) && (
                            <span className="flex items-center gap-0.5 text-default-600 dark:text-default-300 bg-default-100 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium">
                              <FaLocationDot className="text-warning-500 text-[8px] sm:text-[9px] shrink-0" />
                              <span className="truncate max-w-[70px] sm:max-w-[110px]">
                                {prod.location_path || prod.location}
                              </span>
                            </span>
                          )}
                          {prod.supplier && prod.supplier !== "Sin proveedor" && prod.supplier.toUpperCase() !== "DESCONOCIDO" && (
                            <span className="hidden xs:flex items-center gap-0.5 text-default-600 dark:text-default-300 bg-default-100 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px]">
                              <FaBuilding className="text-[#6B7280] dark:text-default-400 text-[8px] sm:text-[9px] shrink-0" />
                              <span className="truncate max-w-[60px] sm:max-w-[90px]">
                                {prod.supplier}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Caja de Datos: Costo, Stock y Total */}
                        <div className="bg-default-50 dark:bg-default-100/50 p-1.5 sm:p-2 rounded-xl border border-default-200/60 mt-0.5 flex flex-col gap-0.5 sm:gap-1">
                          <div className="flex justify-between items-center text-[10px] sm:text-xs">
                            <span className="text-default-500">Costo:</span>
                            <span className="font-bold text-[11px] sm:text-xs text-foreground">
                              <PriceDisplay amount={prod.price} compact />
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[10px] sm:text-xs">
                            <span className="text-default-500">Stock:</span>
                            <CompactNumber
                              value={prod.stock_quantity}
                              suffix={` ${prod.unit || "u."}`}
                              className={`font-bold text-[11px] sm:text-xs ${isOutOfStock
                                ? "text-danger-500"
                                : isLowStock
                                  ? "text-warning-600"
                                  : "text-success-600 dark:text-success-400"
                                }`}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] sm:text-xs pt-0.5 sm:pt-1 border-t border-default-200/60">
                            <span className="text-[9px] sm:text-[11px] text-default-400">Total:</span>
                            <span className="font-bold text-[11px] sm:text-xs text-primary">
                              <PriceDisplay amount={totalRowValue} compact />
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardBody>

                    {/* Footer de Acciones Rápidas */}
                    <div className="p-1 pt-0 sm:p-2 sm:pt-0 flex gap-1 sm:gap-1.5 items-center">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        className="flex-1 font-semibold text-[10px] sm:text-xs h-7 sm:h-8 px-1 sm:px-2 min-w-0"
                        startContent={<FaPlus className="text-[9px] sm:text-[10px] shrink-0" />}
                        onPress={() => handleOpenAddStock(prod)}
                      >
                        Stock
                      </Button>

                      <Button
                        size="sm"
                        color={isOutOfStock ? "default" : "secondary"}
                        variant="flat"
                        isDisabled={isOutOfStock}
                        className="flex-1 font-semibold text-[10px] sm:text-xs h-7 sm:h-8 px-1 sm:px-2 min-w-0"
                        startContent={<FaTruckFast className="text-[10px] sm:text-xs shrink-0" />}
                        onPress={() => addToCart(prod, 1)}
                      >
                        Tienda
                      </Button>

                      <Tooltip content="Ver Kardex">
                        <Button
                          size="sm"
                          isIconOnly
                          variant="bordered"
                          className="h-7 w-7 min-w-7 sm:h-8 sm:w-8 sm:min-w-8 shrink-0"
                          onPress={() => navigate(`/inventories/${prod.slug}`)}
                        >
                          <FaEye className="text-[10px] sm:text-xs" />
                        </Button>
                      </Tooltip>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Sentinel para carga progresiva / scroll infinito en vista cuadrícula */}
            {hasMore && (
              <div ref={sentinelRef} className="col-span-full h-12 w-full flex items-center justify-center my-3">
                {isLoadingMore ? (
                  <Spinner size="sm" color="primary" label="Cargando más productos del almacén..." />
                ) : (
                  <div className="h-4 w-full" />
                )}
              </div>
            )}
          </div>
        ) : (
          /* ==================== VISTA TABLA (TABLE) ==================== */
          <Card className="border border-default-200/80 shadow-sm rounded-2xl overflow-hidden bg-background relative z-0 isolate">
            <div className="max-h-[calc(100dvh-270px)] sm:max-h-none overflow-y-auto overflow-x-auto relative">
              <Table
                aria-label="Tabla de productos en almacén"
                removeWrapper
                isHeaderSticky
                classNames={{
                  th: "bg-default-100/95 backdrop-blur-sm text-default-700 font-bold text-xs uppercase tracking-wider py-2.5 sm:py-3 sticky top-0 z-10 shadow-xs",
                  td: "py-2.5 sm:py-3 border-b border-default-100",
                }}
              >
                <TableHeader>
                  <TableColumn className="text-left min-w-[150px] sm:min-w-0">PRODUCTO</TableColumn>
                  <TableColumn className="hidden sm:table-cell">CATEGORÍA & MARCA</TableColumn>
                  <TableColumn className="hidden lg:table-cell">UBICACIÓN / PROVEEDOR</TableColumn>
                  <TableColumn align="center" className="hidden md:table-cell">COSTO UNITARIO</TableColumn>
                  <TableColumn align="center" className="text-center min-w-[65px] sm:min-w-0">STOCK</TableColumn>
                  <TableColumn align="center" className="hidden lg:table-cell">TOTAL INVERSIÓN</TableColumn>
                  <TableColumn align="center" className="text-right sm:text-center min-w-[85px] sm:min-w-0">ESTADO</TableColumn>
                  <TableColumn align="end" className="hidden sm:table-cell">ACCIONES</TableColumn>
                </TableHeader>
                <TableBody>
                  {visibleProducts.map((prod: any) => {
                    const isOutOfStock = Number(prod.stock_quantity) <= 0;
                    const isLowStock =
                      !isOutOfStock &&
                      Number(prod.stock_quantity) <= (Number(prod.min_stock) || 0);
                    const totalRowValue =
                      (Number(prod.stock_quantity) || 0) * (Number(prod.price) || 0);

                    return (
                      <TableRow key={prod.inventory_id || prod.id} className="hover:bg-default-50/60 transition-colors">
                        {/* 1. PRODUCTO (Mobile: Foto + Nombre + Precio abajo / Desktop: Foto + Nombre + SKU) */}
                        <TableCell>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-default-200 shrink-0 bg-default-100 shadow-2xs">
                              <OptimizedProductImage
                                src={getImageUrl(prod.thumbnail || prod.image)}
                                alt={prod.name}
                                fallbackBrand={prod.brand}
                                fallbackName={prod.category_name}
                                showFallbackText={false}
                                onClick={() => navigate(`/inventories/${prod.slug}`)}
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span
                                onClick={() => navigate(`/inventories/${prod.slug}`)}
                                className="font-bold text-xs sm:text-sm text-foreground hover:text-primary cursor-pointer transition-colors truncate max-w-[130px] xs:max-w-[170px] sm:max-w-xs"
                                title={prod.name}
                              >
                                {prod.name}
                              </span>

                              {/* En móvil: Precio justo debajo en negrita, tal como la maqueta: 🍾 Cococola / Bs. 50.00 */}
                              <div className="sm:hidden flex items-center gap-1.5 mt-0.5">
                                <span className="font-bold text-xs text-foreground">
                                  <PriceDisplay amount={prod.price} compact />
                                </span>
                                {prod.brand && prod.brand.toUpperCase() !== "DESCONOCIDO" && (
                                  <span className="text-[10px] text-[#6B7280] dark:text-default-400 font-medium truncate max-w-[70px]">
                                    • {prod.brand}
                                  </span>
                                )}
                              </div>

                              {/* En desktop: SKU */}
                              {prod.sku && (
                                <span className="hidden sm:inline text-[11px] font-mono text-[#6B7280] dark:text-default-400">
                                  SKU: {prod.sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. CATEGORÍA & MARCA (Desktop) */}
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-1 items-start">
                            <Chip
                              size="sm"
                              variant="flat"
                              className="h-4.5 px-2 py-0 text-[10px] font-semibold rounded-md border"
                              style={{
                                borderColor: prod.category_color,
                              }}
                            >
                              {getLeafCategoryName(prod.category_name) || "Sin categoría"}
                            </Chip>
                            {prod.brand && prod.brand.toUpperCase() !== "DESCONOCIDO" ? (
                              <span className="text-xs text-default-700 font-medium">
                                {prod.brand}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#6B7280] dark:text-default-400 font-medium">
                                {prod.brand || "DESCONOCIDO"}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 3. UBICACIÓN / PROVEEDOR (Desktop) */}
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-default-600">
                            {(prod.location_path || prod.location) ? (
                              <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                                <FaLocationDot className="text-warning-500 text-[10px] shrink-0" />
                                <span className="truncate max-w-[150px]">{prod.location_path || prod.location}</span>
                              </span>
                            ) : (
                              <span className="text-[#6B7280] dark:text-default-400 text-[11px] font-medium">
                                Sin ubicación
                              </span>
                            )}
                            {prod.supplier && prod.supplier !== "Sin proveedor" && prod.supplier.toUpperCase() !== "DESCONOCIDO" ? (
                              <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-default-400">
                                <FaBuilding className="text-[9px] shrink-0" />
                                <span className="truncate max-w-[150px]">{prod.supplier}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#6B7280] dark:text-default-400 italic">
                                Sin proveedor
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 4. COSTO UNITARIO (Desktop) */}
                        <TableCell align="center" className="hidden md:table-cell">
                          <span className="font-bold text-sm text-foreground">
                            <PriceDisplay amount={prod.price} compact />
                          </span>
                        </TableCell>

                        {/* 5. STOCK / UNIDAD (Móvil y Desktop) */}
                        <TableCell align="center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-baseline gap-1">
                              <CompactNumber
                                value={prod.stock_quantity}
                                className={`font-bold text-xs sm:text-sm ${isOutOfStock
                                  ? "text-danger-500"
                                  : isLowStock
                                    ? "text-warning-600"
                                    : "text-foreground"
                                  }`}
                              />
                              <span className="sm:hidden text-[11px] text-[#6B7280] dark:text-default-400 font-medium">
                                {prod.unit || "unid."}
                              </span>
                            </div>
                            <span className="hidden sm:inline text-[10px] text-[#6B7280] dark:text-default-400 font-medium">
                              {prod.unit || "Unidad"}
                            </span>
                          </div>
                        </TableCell>

                        {/* 6. TOTAL INVERSIÓN (Desktop) */}
                        <TableCell align="center" className="hidden lg:table-cell">
                          <span className="font-bold text-sm text-primary">
                            <PriceDisplay amount={totalRowValue} compact />
                          </span>
                        </TableCell>

                        {/* 7. ESTADO (Móvil y Desktop) */}
                        <TableCell align="center">
                          <div className="flex items-center justify-end sm:justify-center gap-1">
                            {isOutOfStock ? (
                              <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px] font-semibold px-1.5">
                                <span className="sm:hidden">Agot.</span>
                                <span className="hidden sm:inline">Agotado</span>
                              </Chip>
                            ) : isLowStock ? (
                              <Chip size="sm" color="warning" variant="flat" className="h-5 text-[10px] font-semibold px-1.5">
                                <span className="sm:hidden">Bajo</span>
                                <span className="hidden sm:inline">Stock Bajo</span>
                              </Chip>
                            ) : (
                              <Chip size="sm" color="success" variant="flat" className="h-5 text-[10px] font-semibold px-1.5">
                                <span className="sm:hidden">Dispon.</span>
                                <span className="hidden sm:inline">Disponible</span>
                              </Chip>
                            )}

                            {/* En móvil: Acciones rápidas dentro de la columna Estado */}
                            <div className="sm:hidden">
                              <Dropdown placement="bottom-end">
                                <DropdownTrigger>
                                  <Button size="sm" isIconOnly variant="light" className="h-7 w-7 min-w-7 text-[#6B7280] dark:text-default-400">
                                    <RiMoreFill size={16} />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="Acciones de producto">
                                  <DropdownItem
                                    key="stock"
                                    startContent={<FaPlus className="text-primary text-xs" />}
                                    onPress={() => handleOpenAddStock(prod)}
                                  >
                                    Agregar Stock
                                  </DropdownItem>
                                  <DropdownItem
                                    key="transfer"
                                    isDisabled={isOutOfStock}
                                    startContent={<FaTruckFast className="text-secondary text-xs" />}
                                    onPress={() => addToCart(prod, 1)}
                                  >
                                    Enviar a Tienda
                                  </DropdownItem>
                                  <DropdownItem
                                    key="kardex"
                                    startContent={<FaEye className="text-xs" />}
                                    onPress={() => navigate(`/inventories/${prod.slug}`)}
                                  >
                                    Ver Kardex
                                  </DropdownItem>
                                  <DropdownItem
                                    key="delete"
                                    className="text-danger"
                                    color="danger"
                                    startContent={<FaTrash className="text-xs" />}
                                    onPress={() => handleDeleteClick(prod.inventory_id)}
                                  >
                                    Eliminar de Almacén
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          </div>
                        </TableCell>

                        {/* 8. ACCIONES (Desktop) */}
                        <TableCell className="hidden sm:table-cell text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Tooltip content="Agregar / Editar Stock">
                              <Button
                                size="sm"
                                isIconOnly
                                color="primary"
                                variant="flat"
                                className="h-7 w-7 min-w-7"
                                onPress={() => handleOpenAddStock(prod)}
                              >
                                <FaPlus className="text-xs" />
                              </Button>
                            </Tooltip>

                            <Tooltip content={isOutOfStock ? "Sin stock disponible" : "Agregar a Carrito de Transferencia"}>
                              <Button
                                size="sm"
                                isIconOnly
                                color={isOutOfStock ? "default" : "secondary"}
                                variant="flat"
                                isDisabled={isOutOfStock}
                                className="h-7 w-7 min-w-7"
                                onPress={() => addToCart(prod, 1)}
                              >
                                <FaTruckFast className="text-xs" />
                              </Button>
                            </Tooltip>

                            <Tooltip content="Ver Kardex">
                              <Button
                                size="sm"
                                isIconOnly
                                variant="bordered"
                                className="h-7 w-7 min-w-7"
                                onPress={() => navigate(`/inventories/${prod.slug}`)}
                              >
                                <FaEye className="text-xs" />
                              </Button>
                            </Tooltip>

                            <Dropdown placement="bottom-end">
                              <DropdownTrigger>
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="light"
                                  className="h-7 w-7 min-w-7 text-[#6B7280] dark:text-default-400"
                                >
                                  <RiMoreFill size={16} />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Acciones adicionales">
                                <DropdownItem
                                  key="delete"
                                  className="text-danger"
                                  color="danger"
                                  startContent={<FaTrash />}
                                  onPress={() => handleDeleteClick(prod.inventory_id)}
                                >
                                  Eliminar de Almacén
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Sentinel para carga progresiva / scroll infinito en vista tabla */}
            {hasMore && (
              <div ref={sentinelRef} className="h-12 w-full flex items-center justify-center my-2 border-t border-default-100">
                {isLoadingMore ? (
                  <Spinner size="sm" color="primary" label="Cargando más productos del almacén..." />
                ) : (
                  <div className="h-4 w-full" />
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* MODAL PARA SELECCIONAR MARCAS */}
      <ModalBrands
        isOpen={isModalBrandsOpen}
        onClose={() => setIsModalBrandsOpen(false)}
        selectBrands={(brandSlug) => {
          applyFilter("brands", brandSlug);
          setIsModalBrandsOpen(false);
        }}
        currentBrand={activeBrandSlug}
      />

      {/* BURBUJA FLOTANTE ARRASTRABLE DEL CARRITO DE ENVÍOS (CUANDO HAY PRODUCTOS) */}
      <FloatingTransferCartBubble
        isModalOpen={isTransferCartOpen}
        onClick={() => setIsTransferCartOpen(true)}
      />

      {/* MODAL / DRAWER DEL CARRITO DE TRANSFERENCIAS A TIENDAS */}
      <DrawerTransferCart
        isOpen={isTransferCartOpen}
        onClose={() => setIsTransferCartOpen(false)}
        onMovementCreated={(movement) => {
          setLastDispatchedMovement(movement);
          setIsSuccessModalOpen(true);
          fetchData(true);
        }}
      />

      {/* MODAL DE ÉXITO TRAS CONFIRMAR ENVÍO (DESCARGA DE GUÍA DE REMISIÓN) */}
      <ModalDispatchSuccess
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        movement={lastDispatchedMovement}
      />

      {/* MODAL DE HISTORIAL DE MOVIMIENTOS / ENVÍOS */}
      <ModalMovementsHistory
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onStockChanged={() => {
          fetchData(true);
        }}
      />

      {/* ALERTA DE ELIMINACIÓN */}
      {deleteRowId !== null && (
        <AlertDelete
          handleConfirmDelete={handleConfirmDelete}
          handleCancelDelete={handleCancelDelete}
          deleteCountdown={deleteCountdown}
          message="¿Estás seguro de que deseas eliminar este producto de los productos en almacén?"
        />
      )}

      {/* MODAL PARA AGREGAR / EDITAR STOCK */}
      {openModalAddStock && selectedProduct && (
        <ModalAddStock
          open={openModalAddStock}
          onClose={handleCloseAddStock}
          data={selectedProduct}
          change={() => handleCloseAddStock()}
          onSuccess={() => {
            fetchData(true);
          }}
          token={token!}
        />
      )}

      {/* MODAL PARA REGISTRAR COMPRA */}
      <ModalRegisterPurchase
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={() => fetchData(true)}
      />

      {/* MODAL PARA GENERAR Y DESCARGAR CÓDIGOS QR EN PDF */}
      <ModalQrPdf
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        products={allProducts}
      />

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINACIÓN MASIVA EN ALMACÉN */}
      <Modal
        isOpen={bulkDeleteModalType !== null}
        onClose={() => !isBulkDeleting && setBulkDeleteModalType(null)}
        size="md"
      >
        <ModalContent>
          <ModalHeader className="flex gap-2 items-center">
            {bulkDeleteModalType === "out_of_stock" ? (
              <>
                <FaTriangleExclamation className="text-warning text-xl" />
                <span className="text-base font-bold text-warning-700 dark:text-warning-400">
                  Eliminar Productos Agotados
                </span>
              </>
            ) : (
              <>
                <FaTrash className="text-danger text-lg" />
                <span className="text-base font-bold text-danger">
                  Vaciar Todo el Almacén
                </span>
              </>
            )}
          </ModalHeader>
          <ModalBody className="py-2">
            {bulkDeleteModalType === "out_of_stock" ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-medium text-foreground">
                  ¿Estás seguro de eliminar todos los productos con <strong className="text-warning-600">stock en 0 o menor</strong> ({outOfStockCount} productos encontrados)?
                </p>
                <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-3 text-xs text-warning-800 dark:text-warning-300">
                  <p className="font-semibold mb-1">ℹ️ Información importante:</p>
                  <p>
                    Se removerán los registros de almacén sin existencias. Los productos seguirán registrados en el catálogo maestro (/products) y podrás agregarlos nuevamente mediante compras cuando dispongas de stock.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-medium text-foreground">
                  ¿Estás completamente seguro de vaciar <strong className="text-danger">TODAS las existencias ({allProducts.length} productos)</strong> de este almacén?
                </p>
                <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-3 text-xs text-danger-700 dark:text-danger-300 flex flex-col gap-1.5">
                  <p className="font-semibold flex items-center gap-1.5">
                    <FaTriangleExclamation className="text-sm" /> Acción de limpieza de almacén:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Se borrarán todos los productos, cantidades y precios registrados en almacén.</li>
                    <li>Los productos permanecerán intactos en el catálogo general (página /products).</li>
                    <li>El stock en tiendas (POS) no será alterado.</li>
                  </ul>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              size="sm"
              variant="flat"
              onPress={() => setBulkDeleteModalType(null)}
              isDisabled={isBulkDeleting}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              color={bulkDeleteModalType === "out_of_stock" ? "warning" : "danger"}
              isLoading={isBulkDeleting}
              onPress={handleConfirmBulkDelete}
              className="font-bold"
            >
              {bulkDeleteModalType === "out_of_stock" ? "Sí, eliminar agotados" : "Sí, vaciar almacén"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* BOTÓN DE ACCIÓN FLOTANTE (FAB) PARA MÓVIL */}
      {/* <div className="fixed bottom-5 right-4 z-40 sm:hidden">
        <Button
          color="primary"
          variant="solid"
          size="md"
          radius="full"
          startContent={<FaCartPlus className="text-base" />}
          onPress={() => setIsPurchaseModalOpen(true)}
          className="font-bold text-xs h-11 px-4 bg-primary text-primary-foreground shadow-2xl shadow-primary/50 flex items-center gap-1.5"
        >
          Registrar Compra
        </Button>
      </div> */}
    </>
  );
};

export default IndexInventories;
