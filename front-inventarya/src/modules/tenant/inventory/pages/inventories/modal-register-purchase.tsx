import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
} from "@nextui-org/react";
import {
  FaCartPlus,
  FaMagnifyingGlass,
  FaPlus,
  FaMinus,
  FaCheck,
  FaBoxOpen,
  FaSliders,
  FaTruck,
  FaLocationDot,
  FaReceipt,
  FaFilter,
  FaLayerGroup,
  FaEllipsisVertical,
} from "react-icons/fa6";
import {
  useSupplierStore,
  useLocationsStore,
  useWarehouseStore,
  useCurrencyStore,
  useTenantAuthStore,
} from "@/stores";
import { useCategoriesStore } from "@/modules/tenant/products/store/categories/categories.store";
import { PurchaseCatalogProduct } from "@/modules/tenant/inventory/store/inventories/inv-warehouse.store";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getImageUrl } from "@/utils/image";
import { getLeafCategoryName } from "@/utils/category";
import { toast } from "sonner";
import { useMobileKeyboardViewport } from "@/hooks";

const DEFAULT_PRODUCT_IMG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%23f1f5f9'/><path d='M40 24 L24 33 L40 42 L56 33 Z M24 36 L24 50 L38 58 L38 44 Z M42 44 L42 58 L56 50 L56 36 Z' fill='%2394a3b8'/></svg>";

const getProductThumbnail = (p?: any): string => {
  if (!p) return DEFAULT_PRODUCT_IMG;
  const rawPath = p.thumbnail || p.image || p.image_thumb || p.image_url;
  if (!rawPath) return DEFAULT_PRODUCT_IMG;
  const resolved = getImageUrl(rawPath);
  return resolved || DEFAULT_PRODUCT_IMG;
};

interface ModalRegisterPurchaseProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface RowPurchaseState {
  selected: boolean;
  quantity: number;
  price: number;
  unit: string;
  supplier_id: string;
  location_id: string;
  invoice_number: string;
  min_stock: string;
  notes: string;
}

const COMMON_UNITS = [
  "Unidad",
  "Caja",
  "Paquete",
  "Docena",
  "Kilogramo",
  "Gramo",
  "Litro",
  "Mililitro",
  "Metro",
  "Bolsa",
  "Saco",
  "Botella",
  "Pieza",
  "Display",
  "Pack",
  "Lata",
  "Rollo",
];

const getDefaultRowState = (product: PurchaseCatalogProduct): RowPurchaseState => ({
  selected: false,
  quantity: 1,
  price: Number(product.price) || 0,
  unit: product.unit || "Unidad",
  supplier_id: "",
  location_id: "",
  invoice_number: "",
  min_stock: "0",
  notes: "",
});

export const ModalRegisterPurchase: React.FC<ModalRegisterPurchaseProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const token = useTenantAuthStore((s) => s.token);

  // Zustand Warehouse Store
  const purchaseProducts = useWarehouseStore((s) => s.purchaseProducts);
  const purchaseHasMore = useWarehouseStore((s) => s.purchaseHasMore);
  const isLoadingPurchaseProducts = useWarehouseStore((s) => s.isLoadingPurchaseProducts);
  const isLoadingMorePurchaseProducts = useWarehouseStore((s) => s.isLoadingMorePurchaseProducts);
  const getPurchaseProducts = useWarehouseStore((s) => s.getPurchaseProducts);
  const loadMorePurchaseProducts = useWarehouseStore((s) => s.loadMorePurchaseProducts);
  const bulkPurchaseWarehouseProducts = useWarehouseStore(
    (s) => s.bulkPurchaseWarehouseProducts
  );
  const currencySymbol = useCurrencyStore((s) => s.symbol);

  // Aux stores
  const categories = useCategoriesStore((s) => s.categories);
  const getCategories = useCategoriesStore((s) => s.getCategories);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const getSuppliers = useSupplierStore((s) => s.getSuppliers);
  const locations = useLocationsStore((s) => s.locations);
  const getLocations = useLocationsStore((s) => s.getLocations);

  // Filtros de búsqueda locales
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Estado editable perezoso (lazy): solo contiene filas que el usuario ha interactuado/seleccionado
  const [itemsState, setItemsState] = useState<Record<string | number, RowPurchaseState>>({});
  // Diccionario persistente de los productos seleccionados para no perder su información al paginar o buscar
  const [selectedProductsInfo, setSelectedProductsInfo] = useState<
    Record<string | number, PurchaseCatalogProduct>
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce de búsqueda (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Hook de adaptación responsiva y gestión del teclado móvil
  const {
    viewportHeight,
    isKeyboardOpen,
    isMobile,
    prefersReducedMotion,
    containerRef,
  } = useMobileKeyboardViewport();

  // Gesto táctil estilo bottom sheet: arrastrar hacia abajo para cerrar
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  const handleDragTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea")
    ) {
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };

  const handleDragTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingSheet) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    } else {
      setDragOffsetY(0);
    }
  };

  const handleDragTouchEnd = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (dragOffsetY > 65) {
      onClose();
    }
    setDragOffsetY(0);
  };

  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0);
      setIsDraggingSheet(false);
    }
  }, [isOpen]);

  const modalPlacement = useMemo<"center" | "bottom-center" | "top">(() => {
    if (!isMobile) return "center";
    return isKeyboardOpen ? "top" : "bottom-center";
  }, [isMobile, isKeyboardOpen]);

  const modalStyle = useMemo<React.CSSProperties>(() => {
    const transform = dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined;
    const transition = isDraggingSheet
      ? "none"
      : prefersReducedMotion
      ? "none"
      : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), height 180ms cubic-bezier(0.16, 1, 0.3, 1), max-height 180ms cubic-bezier(0.16, 1, 0.3, 1)";

    if (!isMobile) return {};
    if (isKeyboardOpen && viewportHeight > 0) {
      return {
        height: `${viewportHeight}px`,
        maxHeight: `${viewportHeight}px`,
        transform,
        transition,
      };
    }
    return {
      maxHeight: "94dvh",
      transform,
      transition,
    };
  }, [isMobile, isKeyboardOpen, viewportHeight, prefersReducedMotion, dragOffsetY, isDraggingSheet]);

  const footerStyle = useMemo<React.CSSProperties>(() => {
    if (isMobile && !isKeyboardOpen) {
      return {
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
      };
    }
    return {};
  }, [isMobile, isKeyboardOpen]);

  // Cargar datos al abrir el modal (inmediato, sin bloquear la apertura)
  useEffect(() => {
    if (isOpen) {
      // Cargar catálogos auxiliares solo si no están ya en memoria (caché Zustand)
      if (categories.length === 0) {
        getCategories(token || undefined);
      }
      if (suppliers.length === 0) {
        getSuppliers(token || undefined);
      }
      if (locations.length === 0) {
        getLocations();
      }

      // Reiniciar filtros de búsqueda y solicitar catálogo inicial de compras
      setSearchInput("");
      setDebouncedSearch("");
      setSelectedCategory("all");
      getPurchaseProducts({ search: undefined, category: undefined });
    } else {
      // Al cerrar, limpiar estados de edición para la siguiente apertura
      setItemsState({});
      setSelectedProductsInfo({});
    }
  }, [isOpen]);

  // Reaccionar a cambios en filtros de búsqueda y categoría
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isOpen) return;

    getPurchaseProducts({
      search: debouncedSearch || undefined,
      category: selectedCategory !== "all" ? selectedCategory : undefined,
    });
  }, [debouncedSearch, selectedCategory, isOpen]);

  // Observer para infinite scroll en la lista de compras del modal
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !purchaseHasMore || isLoadingMorePurchaseProducts || isLoadingPurchaseProducts) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && purchaseHasMore && !isLoadingMorePurchaseProducts) {
          loadMorePurchaseProducts();
        }
      },
      { threshold: 0.1, rootMargin: "150px" }
    );

    const target = sentinelRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [isOpen, purchaseHasMore, isLoadingMorePurchaseProducts, isLoadingPurchaseProducts]);

  // Opciones de categorías
  const categoryOptions = useMemo(() => {
    return [
      { id: "all", label: "Todas las categorías" },
      ...categories.map((cat: any) => ({
        id: String(cat.id),
        label: getLeafCategoryName(cat.name),
      })),
    ];
  }, [categories]);

  // Obtener estado editable para un producto (lazy)
  const getRowState = useCallback(
    (product: PurchaseCatalogProduct): RowPurchaseState => {
      return itemsState[product.id] || getDefaultRowState(product);
    },
    [itemsState]
  );

  // Funciones de mutación para cada fila
  const toggleRowSelected = (product: PurchaseCatalogProduct, val?: boolean) => {
    const currentState = getRowState(product);
    const newSelected = val !== undefined ? val : !currentState.selected;

    setItemsState((prev) => ({
      ...prev,
      [product.id]: {
        ...currentState,
        selected: newSelected,
      },
    }));

    setSelectedProductsInfo((prev) => {
      if (newSelected) {
        return { ...prev, [product.id]: product };
      } else {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
    });
  };

  const updateRowQuantity = (product: PurchaseCatalogProduct, qty: number) => {
    const safeQty = Math.max(0.001, isNaN(qty) ? 0.001 : qty);
    const currentState = getRowState(product);

    setItemsState((prev) => ({
      ...prev,
      [product.id]: {
        ...currentState,
        quantity: safeQty,
      },
    }));
  };

  const updateRowPrice = (product: PurchaseCatalogProduct, price: number) => {
    const safePrice = Math.max(0, isNaN(price) ? 0 : price);
    const currentState = getRowState(product);

    setItemsState((prev) => ({
      ...prev,
      [product.id]: {
        ...currentState,
        price: safePrice,
      },
    }));
  };

  const updateRowUnit = (product: PurchaseCatalogProduct, unit: string) => {
    const currentState = getRowState(product);

    setItemsState((prev) => ({
      ...prev,
      [product.id]: {
        ...currentState,
        unit,
      },
    }));
  };

  const updateRowExtraField = (
    product: PurchaseCatalogProduct,
    field: "supplier_id" | "location_id" | "invoice_number" | "min_stock" | "notes",
    val: string
  ) => {
    const currentState = getRowState(product);

    setItemsState((prev) => ({
      ...prev,
      [product.id]: {
        ...currentState,
        [field]: val,
      },
    }));
  };

  // Productos actualmente seleccionados para compra (persistentes)
  const selectedProductsList = useMemo(() => {
    return Object.values(selectedProductsInfo).filter((p) => itemsState[p.id]?.selected);
  }, [selectedProductsInfo, itemsState]);

  // Conteo de seleccionados visibles en la página actual
  const visibleSelectedCount = useMemo(() => {
    return purchaseProducts.filter((p) => itemsState[p.id]?.selected).length;
  }, [purchaseProducts, itemsState]);

  // Seleccionar / Deseleccionar todos los visibles
  const handleToggleSelectAllVisible = () => {
    const shouldSelectAll = visibleSelectedCount < purchaseProducts.length;

    setItemsState((prev) => {
      const next = { ...prev };
      purchaseProducts.forEach((p) => {
        const cur = next[p.id] || getDefaultRowState(p);
        next[p.id] = {
          ...cur,
          selected: shouldSelectAll,
        };
      });
      return next;
    });

    setSelectedProductsInfo((prev) => {
      const next = { ...prev };
      purchaseProducts.forEach((p) => {
        if (shouldSelectAll) {
          next[p.id] = p;
        } else {
          delete next[p.id];
        }
      });
      return next;
    });
  };

  // Totales calculados en tiempo real para los seleccionados
  const totalInvestment = useMemo(() => {
    return selectedProductsList.reduce((sum, p) => {
      const st = itemsState[p.id];
      return sum + (Number(st?.price) || 0) * (Number(st?.quantity) || 0);
    }, 0);
  }, [selectedProductsList, itemsState]);

  const totalUnits = useMemo(() => {
    return selectedProductsList.reduce((sum, p) => {
      const st = itemsState[p.id];
      return sum + (Number(st?.quantity) || 0);
    }, 0);
  }, [selectedProductsList, itemsState]);

  // Comprobar si una fila tiene datos adicionales configurados
  const getRowExtraDataCount = (productId: number | string) => {
    const st = itemsState[productId];
    if (!st) return 0;
    let count = 0;
    if (st.supplier_id) count++;
    if (st.location_id) count++;
    if (st.invoice_number?.trim()) count++;
    if (st.min_stock && st.min_stock !== "0") count++;
    if (st.notes?.trim()) count++;
    return count;
  };

  // Enviar compra al backend
  const handleSubmitPurchase = async () => {
    if (selectedProductsList.length === 0) {
      toast.error("Selecciona al menos un producto para registrar la compra.");
      return;
    }

    for (const p of selectedProductsList) {
      const st = itemsState[p.id];
      if (st && Number(st.price) < 0) {
        toast.error(`El precio para "${p.name}" no puede ser negativo.`);
        return;
      }
    }

    const payload = {
      items: selectedProductsList.map((p) => {
        const st = itemsState[p.id] || getDefaultRowState(p);
        const rawPrice = Number(st?.price);
        const rawQty = Number(st?.quantity);
        return {
          product_id: String(p.id),
          price: isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice,
          quantity: isNaN(rawQty) || rawQty <= 0 ? 1 : rawQty,
          unit: st?.unit?.trim() || "Unidad",
          supplier_id: st?.supplier_id ? Number(st.supplier_id) : null,
          location_id: st?.location_id ? Number(st.location_id) : null,
          invoice_number: st?.invoice_number?.trim() || null,
          min_stock: st?.min_stock ? parseFloat(st.min_stock) : 0,
          notes: st?.notes?.trim() || null,
        };
      }),
    };

    setIsSubmitting(true);
    const success = await bulkPurchaseWarehouseProducts(payload, token || undefined);
    setIsSubmitting(false);

    if (success) {
      setItemsState({});
      setSelectedProductsInfo({});
      onSuccess?.();
      onClose();
    }
  };

  return (
    <>
      <datalist id="register-purchase-common-units">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="5xl"
        scrollBehavior="inside"
        placement={modalPlacement}
        motionProps={{
          variants: {
            enter: {
              y: 0,
              opacity: 1,
              transition: {
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              },
            },
            exit: {
              y: isMobile ? "100%" : 20,
              opacity: 0,
              transition: {
                duration: 0.18,
                ease: [0.7, 0, 0.84, 0],
              },
            },
          },
        }}
        classNames={{
          backdrop: "z-[1000]",
          wrapper: isMobile
            ? isKeyboardOpen
              ? "items-start justify-center p-0 z-[1001]"
              : "items-end sm:items-center justify-center p-0 sm:p-4 z-[1001]"
            : "items-center justify-center z-[1001]",
          base: [
            "bg-background border border-default-200 dark:border-default-100",
            "w-full max-w-full sm:max-w-5xl",
            "m-0 sm:my-auto",
            "overflow-hidden min-h-0",
            isMobile
              ? isKeyboardOpen
                ? "rounded-none max-h-full h-full"
                : "rounded-t-2xl rounded-b-none sm:rounded-2xl max-h-[94dvh] sm:max-h-[92vh]"
              : "rounded-2xl sm:max-h-[92vh]",
          ].join(" "),
          header:
            "border-b border-default-200/80 dark:border-default-100/80 px-3.5 sm:px-6 py-2.5 sm:py-4 shrink-0",
          footer:
            "border-t border-default-200/80 dark:border-default-100/80 px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-background sm:bg-default-50/40 shrink-0",
          body: "p-3 sm:p-6 overflow-y-auto overscroll-contain min-h-0",
        }}
      >
        <ModalContent style={modalStyle}>
          {() => (
            <div ref={containerRef} className="flex flex-col h-full w-full min-h-0 overflow-hidden">
              {/* Indicador visual de Mobile Sheet con gesto de arrastre */}
              {isMobile && !isKeyboardOpen && (
                <div
                  className="sm:hidden w-full flex justify-center pt-3 pb-1.5 cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
                  onTouchStart={handleDragTouchStart}
                  onTouchMove={handleDragTouchMove}
                  onTouchEnd={handleDragTouchEnd}
                  onTouchCancel={handleDragTouchEnd}
                  onClick={onClose}
                  title="Deslizar hacia abajo o tocar para cerrar"
                >
                  <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
                </div>
              )}

              {/* HEADER DEL MODAL */}
              <ModalHeader
                className="flex flex-col gap-1 select-none cursor-grab active:cursor-grabbing touch-none"
                onTouchStart={handleDragTouchStart}
                onTouchMove={handleDragTouchMove}
                onTouchEnd={handleDragTouchEnd}
                onTouchCancel={handleDragTouchEnd}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                      <FaCartPlus className="text-base sm:text-xl" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-foreground tracking-tight">
                        Registrar Compra a Almacén
                      </h2>
                      <p className="text-xs text-default-500 font-normal hidden sm:block">
                        Catálogo de productos. Selecciona los productos a ingresar al almacén, edita cantidades, precios y asigna datos adicionales por fila.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Chip
                      color="primary"
                      variant="flat"
                      size="sm"
                      className="font-medium h-6 text-xs"
                    >
                      {selectedProductsList.length} seleccionados
                    </Chip>
                    <Chip
                      color="default"
                      variant="flat"
                      size="sm"
                      className="font-normal h-6 text-default-500 text-xs"
                    >
                      {purchaseProducts.length} mostrados
                    </Chip>
                  </div>
                </div>
              </ModalHeader>

              {/* BODY: BUSCADOR + FILTRO POR CATEGORÍAS + TABLA EDITABLE */}
              <ModalBody className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden">
                {/* 1. BARRA DE HERRAMIENTAS: BUSCADOR Y FILTROS */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 w-full">
                    {/* Buscador de productos */}
                    <Input
                      placeholder="Buscar producto por nombre, SKU, marca..."
                      value={searchInput}
                      onValueChange={setSearchInput}
                      startContent={<FaMagnifyingGlass className="text-default-400 text-sm" />}
                      isClearable
                      onClear={() => setSearchInput("")}
                      size="sm"
                      variant="bordered"
                      className="flex-1"
                    />

                    {/* Menú de 3 puntos (Dropdown) exclusivo para celulares / pantallas móviles */}
                    <div className="sm:hidden shrink-0">
                      <Popover placement="bottom-end" showArrow offset={8}>
                        <PopoverTrigger>
                          <Button
                            isIconOnly
                            size="sm"
                            variant={selectedCategory !== "all" ? "flat" : "bordered"}
                            color={selectedCategory !== "all" ? "primary" : "default"}
                            className="h-9 w-9 min-w-9 shrink-0 border-default-200"
                            aria-label="Más opciones y filtros"
                          >
                            <FaEllipsisVertical className="text-sm" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 max-w-[85vw] p-3.5 flex flex-col gap-3 bg-background border border-default-200 shadow-xl rounded-2xl">
                          <div className="flex flex-col gap-0.5 border-b border-default-100 pb-2">
                            <span className="text-xs font-bold text-foreground">Filtros y Acciones</span>
                            <span className="text-[10px] text-default-400">
                              Filtrar por categoría o seleccionar productos visibles
                            </span>
                          </div>

                          <div className="flex flex-col gap-3">
                            <Select
                              label="Categoría"
                              labelPlacement="outside"
                              placeholder="Todas las categorías"
                              selectedKeys={[selectedCategory]}
                              onChange={(e) => setSelectedCategory(e.target.value || "all")}
                              size="sm"
                              variant="bordered"
                              startContent={<FaFilter className="text-default-400 text-xs" />}
                            >
                              {categoryOptions.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </Select>

                            {purchaseProducts.length > 0 && (
                              <Button
                                size="sm"
                                variant="flat"
                                color={
                                  visibleSelectedCount === purchaseProducts.length &&
                                  purchaseProducts.length > 0
                                    ? "primary"
                                    : "default"
                                }
                                onPress={handleToggleSelectAllVisible}
                                className="font-medium h-9 w-full text-xs justify-start"
                                startContent={<FaLayerGroup className="text-xs" />}
                              >
                                {visibleSelectedCount === purchaseProducts.length &&
                                purchaseProducts.length > 0
                                  ? "Deseleccionar visibles"
                                  : "Seleccionar visibles"}
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Controles visibles en escritorio (Desktop) */}
                  <div className="hidden sm:flex items-center gap-3">
                    <Select
                      labelPlacement="outside"
                      placeholder="Todas las categorías"
                      selectedKeys={[selectedCategory]}
                      onChange={(e) => setSelectedCategory(e.target.value || "all")}
                      size="sm"
                      variant="bordered"
                      className="w-64"
                      startContent={<FaFilter className="text-default-400 text-xs" />}
                    >
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </Select>

                    {purchaseProducts.length > 0 && (
                      <Button
                        size="sm"
                        variant="flat"
                        color={
                          visibleSelectedCount === purchaseProducts.length && purchaseProducts.length > 0
                            ? "primary"
                            : "default"
                        }
                        onPress={handleToggleSelectAllVisible}
                        className="font-medium h-9 shrink-0 text-xs"
                        startContent={<FaLayerGroup className="text-xs" />}
                      >
                        {visibleSelectedCount === purchaseProducts.length && purchaseProducts.length > 0
                          ? "Deseleccionar visibles"
                          : "Seleccionar visibles"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* 2. LISTA EDITABLE DE PRODUCTOS */}
                {isLoadingPurchaseProducts ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Spinner size="lg" color="primary" />
                    <span className="text-xs text-default-500">Cargando catálogo para compra...</span>
                  </div>
                ) : purchaseProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 rounded-2xl border-2 border-dashed border-default-200 dark:border-default-100 bg-default-50/50 text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl">
                      <FaBoxOpen />
                    </div>
                    <div className="flex flex-col gap-1 max-w-md">
                      <h3 className="text-sm font-bold text-foreground">
                        No se encontraron productos en el catálogo
                      </h3>
                      <p className="text-xs text-default-500">
                        Intenta cambiar la categoría seleccionada o limpiar el término de búsqueda.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-default-200 rounded-2xl bg-background shadow-sm overscroll-contain">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-default-100/70 dark:bg-default-50/50 border-b border-default-200 text-default-500 font-bold uppercase text-[11px] tracking-wider">
                          <th className="py-3 px-2 w-8 text-center">
                            <Checkbox
                              isSelected={
                                purchaseProducts.length > 0 &&
                                visibleSelectedCount === purchaseProducts.length
                              }
                              isIndeterminate={
                                visibleSelectedCount > 0 &&
                                visibleSelectedCount < purchaseProducts.length
                              }
                              onValueChange={handleToggleSelectAllVisible}
                              size="sm"
                            />
                          </th>
                          <th className="py-3 px-3 min-w-[180px]">Producto</th>
                          <th className="py-3 px-2 w-28">Unidad</th>
                          <th className="py-3 px-2 w-32 text-center">Cantidad</th>
                          <th className="py-3 px-2 w-28 text-right">Precio Compra</th>
                          <th className="py-3 px-2 w-24 text-right">Subtotal</th>
                          <th className="py-3 px-2 w-24 text-center">Datos Extra</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default-100">
                        {purchaseProducts.map((p) => {
                          const st = getRowState(p);
                          const subtotal = (Number(st.price) || 0) * (Number(st.quantity) || 0);
                          const extraCount = getRowExtraDataCount(p.id);

                          return (
                            <tr
                              key={p.id}
                              className={`hover:bg-default-50/70 transition-colors ${
                                st.selected ? "bg-primary-50/30 dark:bg-primary-950/20" : ""
                              }`}
                            >
                              {/* 1. CHECKBOX */}
                              <td className="py-2.5 px-2 text-center">
                                <Checkbox
                                  isSelected={st.selected}
                                  onValueChange={(val) => toggleRowSelected(p, val)}
                                  size="sm"
                                />
                              </td>

                              {/* 2. PRODUCTO */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5 min-w-[180px]">
                                  <img
                                    src={getProductThumbnail(p)}
                                    alt={p.name}
                                    className="w-10 h-10 object-cover rounded-lg border border-default-200 shrink-0 bg-default-100"
                                    onError={(e: any) => {
                                      e.currentTarget.src = DEFAULT_PRODUCT_IMG;
                                    }}
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span
                                      className="font-semibold text-foreground truncate max-w-[200px]"
                                      title={p.name}
                                    >
                                      {p.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-default-400">
                                      <span>{getLeafCategoryName(p.category_path || p.category)}</span>
                                      {p.brand && <span>• {p.brand}</span>}
                                      {p.is_in_warehouse && (
                                        <Chip
                                          size="sm"
                                          variant="flat"
                                          color="default"
                                          className="text-[9px] h-3.5 px-1 bg-default-100 text-default-500 font-medium"
                                        >
                                          En almacén
                                        </Chip>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 3. UNIDAD */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  list="register-purchase-common-units"
                                  value={st.unit}
                                  onChange={(e) => {
                                    updateRowUnit(p, e.target.value);
                                    if (!st.selected) toggleRowSelected(p, true);
                                  }}
                                  placeholder="Unidad"
                                  className="w-24 text-xs font-semibold px-2 py-1.5 rounded-lg border border-default-200 bg-background focus:outline-none focus:border-primary text-foreground"
                                  title="Unidad de medida"
                                />
                              </td>

                              {/* 4. CANTIDAD (- / + y número) */}
                              <td className="py-2.5 px-2 text-center">
                                <div className="inline-flex items-center gap-1 bg-default-100 rounded-lg p-0.5 border border-default-200">
                                  <Button
                                    size="sm"
                                    isIconOnly
                                    variant="light"
                                    className="h-6 w-6 min-w-6 text-default-600"
                                    isDisabled={st.quantity <= 0.001}
                                    onPress={() =>
                                      updateRowQuantity(
                                        p,
                                        Math.max(0.001, Number((st.quantity - 1).toFixed(3)))
                                      )
                                    }
                                  >
                                    <FaMinus className="text-[9px]" />
                                  </Button>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    value={st.quantity}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      updateRowQuantity(p, val);
                                      if (!st.selected) toggleRowSelected(p, true);
                                    }}
                                    className="w-12 text-center text-xs font-bold bg-transparent focus:outline-none text-foreground"
                                  />
                                  <Button
                                    size="sm"
                                    isIconOnly
                                    variant="light"
                                    className="h-6 w-6 min-w-6 text-default-600"
                                    onPress={() => {
                                      updateRowQuantity(p, Number((st.quantity + 1).toFixed(3)));
                                      if (!st.selected) toggleRowSelected(p, true);
                                    }}
                                  >
                                    <FaPlus className="text-[9px]" />
                                  </Button>
                                </div>
                              </td>

                              {/* 5. PRECIO COMPRA */}
                              <td className="py-2.5 px-2 text-right">
                                <div className="inline-flex items-center justify-end gap-1">
                                  <span className="text-default-400 font-bold text-xs">
                                    {currencySymbol}
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="any"
                                    value={st.price}
                                    onChange={(e) => {
                                      updateRowPrice(p, parseFloat(e.target.value) || 0);
                                      if (!st.selected) toggleRowSelected(p, true);
                                    }}
                                    className="w-20 text-right text-xs font-bold px-2 py-1.5 rounded-lg border border-default-200 bg-background focus:outline-none focus:border-primary text-foreground"
                                  />
                                </div>
                              </td>

                              {/* 6. SUBTOTAL */}
                              <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                <span
                                  className={`font-bold text-xs ${
                                    st.selected
                                      ? "text-success-600 dark:text-success-400"
                                      : "text-default-400"
                                  }`}
                                >
                                  <PriceDisplay amount={subtotal} />
                                </span>
                              </td>

                              {/* 7. DATOS EXTRA (Popover) */}
                              <td className="py-2.5 px-2 text-center">
                                <Popover
                                  placement={isMobile ? "bottom" : "left"}
                                  showArrow
                                  backdrop="transparent"
                                  shouldBlockScroll={false}
                                  offset={8}
                                  classNames={{ content: "z-[9999]" }}
                                >
                                  <PopoverTrigger>
                                    <Button
                                      size="sm"
                                      variant={extraCount > 0 ? "flat" : "bordered"}
                                      color={extraCount > 0 ? "primary" : "default"}
                                      className="h-7 text-xs font-medium border-default-200 px-2.5"
                                      startContent={<FaSliders className="text-xs" />}
                                    >
                                      <span>Datos</span>
                                      {extraCount > 0 && (
                                        <Chip
                                          size="sm"
                                          color="primary"
                                          variant="solid"
                                          className="h-4 min-w-4 px-1 text-[9px] font-bold"
                                        >
                                          {extraCount}
                                        </Chip>
                                      )}
                                    </Button>
                                  </PopoverTrigger>

                                  <PopoverContent className="w-80 max-w-[90vw] p-3.5 flex flex-col gap-3 bg-background border border-default-200 shadow-xl rounded-2xl z-[9999]">
                                    <div className="border-b border-default-100 pb-2">
                                      <div className="flex items-center gap-1.5 text-primary">
                                        <FaSliders className="text-xs" />
                                        <h4 className="text-xs font-bold text-foreground truncate">
                                          Datos Adicionales: {p.name}
                                        </h4>
                                      </div>
                                      <p className="text-[11px] text-default-400 mt-0.5">
                                        Asigna proveedor, factura o ubicación para este producto.
                                      </p>
                                    </div>

                                    <div className="flex flex-col gap-2.5">
                                      {/* Proveedor */}
                                      <Select
                                        label="Proveedor"
                                        placeholder="Selecciona proveedor..."
                                        size="sm"
                                        variant="bordered"
                                        selectedKeys={st.supplier_id ? [st.supplier_id] : []}
                                        onChange={(e) => {
                                          updateRowExtraField(p, "supplier_id", e.target.value);
                                          if (!st.selected) toggleRowSelected(p, true);
                                        }}
                                        startContent={<FaTruck className="text-default-400 text-xs" />}
                                      >
                                        {suppliers.map((sup) => (
                                          <SelectItem key={sup.id} value={sup.id}>
                                            {sup.name}
                                          </SelectItem>
                                        ))}
                                      </Select>

                                      {/* Nro. Factura / Comprobante */}
                                      <Input
                                        label="Nro. Factura / Documento"
                                        placeholder="Ej. F001-002498"
                                        size="sm"
                                        variant="bordered"
                                        value={st.invoice_number}
                                        onValueChange={(val) => {
                                          updateRowExtraField(p, "invoice_number", val);
                                          if (!st.selected) toggleRowSelected(p, true);
                                        }}
                                        startContent={<FaReceipt className="text-default-400 text-xs" />}
                                      />

                                      {/* Ubicación en Almacén */}
                                      <Select
                                        label="Ubicación Física"
                                        placeholder="Estante o sección..."
                                        size="sm"
                                        variant="bordered"
                                        selectedKeys={st.location_id ? [st.location_id] : []}
                                        onChange={(e) => {
                                          updateRowExtraField(p, "location_id", e.target.value);
                                          if (!st.selected) toggleRowSelected(p, true);
                                        }}
                                        startContent={<FaLocationDot className="text-default-400 text-xs" />}
                                      >
                                        {locations.map((loc) => (
                                          <SelectItem key={loc.id} value={loc.id}>
                                            {loc.full_path || loc.name}
                                          </SelectItem>
                                        ))}
                                      </Select>

                                      {/* Stock Mínimo de Alerta */}
                                      <Input
                                        label="Stock Mínimo de Alerta"
                                        placeholder="0"
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="any"
                                        size="sm"
                                        variant="bordered"
                                        value={st.min_stock}
                                        onValueChange={(val) => {
                                          updateRowExtraField(p, "min_stock", val);
                                          if (!st.selected) toggleRowSelected(p, true);
                                        }}
                                      />

                                      {/* Notas / Observaciones */}
                                      <Input
                                        label="Observaciones"
                                        placeholder="Notas sobre el producto..."
                                        size="sm"
                                        variant="bordered"
                                        value={st.notes}
                                        onValueChange={(val) => {
                                          updateRowExtraField(p, "notes", val);
                                          if (!st.selected) toggleRowSelected(p, true);
                                        }}
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Sentinel para infinite scroll de compras */}
                    <div ref={sentinelRef} className="py-3 flex items-center justify-center min-h-[36px]">
                      {isLoadingMorePurchaseProducts && (
                        <div className="flex items-center gap-2 text-default-400 text-xs py-2">
                          <Spinner size="sm" />
                          <span>Cargando más productos del catálogo...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </ModalBody>

              {/* FOOTER DEL MODAL: TOTALES Y CONFIRMACIÓN */}
              <ModalFooter
                style={footerStyle}
                className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5"
              >
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-[11px] text-default-400 uppercase tracking-wider font-semibold">
                      Seleccionados:
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {selectedProductsList.length} prod. ({totalUnits} un.)
                    </span>
                  </div>

                  <div className="h-8 w-px bg-default-200 hidden sm:block" />

                  <div className="flex flex-col text-right sm:text-left">
                    <span className="text-[10px] sm:text-[11px] text-default-400 uppercase tracking-wider font-semibold">
                      Inversión Total:
                    </span>
                    <span className="text-base sm:text-xl font-extrabold text-success-600 dark:text-success-400">
                      <PriceDisplay amount={totalInvestment} />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                  <Button
                    variant="light"
                    color="default"
                    size="sm"
                    onPress={onClose}
                    isDisabled={isSubmitting}
                    className="flex-1 sm:flex-none h-8 text-xs font-medium order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>

                  <Button
                    color="primary"
                    variant="shadow"
                    size="sm"
                    isLoading={isSubmitting}
                    isDisabled={selectedProductsList.length === 0 || isSubmitting}
                    startContent={!isSubmitting ? <FaCheck className="text-xs" /> : undefined}
                    onPress={() => handleSubmitPurchase()}
                    className="flex-1 sm:flex-none font-bold shadow-primary/25 px-4 h-8 text-xs order-1 sm:order-2"
                  >
                    Registrar Compra {selectedProductsList.length > 0 && `(${selectedProductsList.length})`}
                  </Button>
                </div>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default ModalRegisterPurchase;

