import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Input,
  Textarea,
  Chip,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import {
  FaTruckFast,
  FaTrashCan,
  FaCheck,
  FaMinus,
  FaPlus,
  FaStore,
  FaBoxesStacked,
  FaCircleInfo,
  FaMagnifyingGlass,
  FaFilter,
  FaCartPlus,
  FaWarehouse,
  FaCheckDouble,
  FaSliders,
  FaCalendarDay,
} from "react-icons/fa6";
import { useStockMovementsStore, StockMovementRecord } from "../../store/movements/stock-movements.store";
import { useWarehouseStore } from "../../store/inventories/inv-warehouse.store";
import { useCategoriesStore } from "@/modules/tenant/products/store/categories/categories.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { useCurrencyStore } from "@/stores";
import { getImageUrl } from "@/utils/image";
import { getLeafCategoryName } from "@/utils/category";
import { toast } from "sonner";
import { useMobileKeyboardViewport } from "@/hooks";

interface DrawerTransferCartProps {
  isOpen: boolean;
  onClose: () => void;
  onMovementCreated: (movement: StockMovementRecord) => void;
}

const COMMON_UNITS = [
  "Unidad",
  "Pieza",
  "Caja",
  "Paquete",
  "Docena",
  "Kg",
  "Gramo",
  "Litro",
  "Metro",
  "Par",
  "Bolsa",
  "Rollo",
];

export const DrawerTransferCart: React.FC<DrawerTransferCartProps> = ({
  isOpen,
  onClose,
  onMovementCreated,
}) => {
  const {
    cartItems,
    addToCart,
    addAllToCart,
    removeFromCart,
    updateQuantity,
    updateSalePrice,
    updateUnit,
    updateMinStock,
    updateExpirationDate,
    clearCart,
    createMovement,
    isLoading,
    totalCartItems,
    totalCartUnits,
  } = useStockMovementsStore();

  const warehouseProducts = useWarehouseStore((state) => state.warehouseProducts);
  const categories = useCategoriesStore((state) => state.categories);
  const shops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);
  const currencySymbol = useCurrencyStore((state) => state.symbol);

  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);

  // Estados del Buscador y Filtro de Categoría dentro del Modal
  const [searchProductQuery, setSearchProductQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // Hook de adaptación responsiva y gestión del teclado móvil (Android/Capacitor, iOS, Web)
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
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea")) {
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

  // Cargar tiendas e inventario actualizado siempre que se abra el modal
  useEffect(() => {
    if (isOpen) {
      if (useShopsStore.getState().shops.length === 0) {
        getShops();
      }
      // Siempre obtener la lista más reciente de productos de almacén
      useWarehouseStore.getState().getWarehouseProducts();
    }
  }, [isOpen, getShops]);

  // Asignar tienda inicial si aún no se seleccionó ninguna
  useEffect(() => {
    if (isOpen && !selectedStoreId && shops.length > 0) {
      setSelectedStoreId(String(shops[0].id));
    }
  }, [isOpen, shops, selectedStoreId]);

  // Aplanar todos los productos disponibles en almacén estrictamente con stock > 0
  const availableWarehouseProducts = useMemo(() => {
    const flattened = (warehouseProducts || []).flatMap((g: any) =>
      (g.products || []).map((p: any) => ({
        ...p,
        category_name: g.category_path || g.category || p.category,
        category_slug: g.category_slug || "",
        category_id: g.category_id || p.category_id,
      }))
    );
    // Filtrar estrictamente solo productos con existencias disponibles positivas
    return flattened.filter((p: any) => {
      const stock = Number(p.stock_quantity ?? p.stock ?? 0);
      return !isNaN(stock) && stock > 0;
    });
  }, [warehouseProducts]);

  // Sincronizar existencias actuales de almacén con ítems cargados en el carrito
  useEffect(() => {
    if (isOpen && warehouseProducts.length > 0 && cartItems.length > 0) {
      const stockMap = new Map<string, number>();
      (warehouseProducts || []).forEach((g: any) => {
        (g.products || []).forEach((p: any) => {
          if (p.inventory_id) {
            stockMap.set(`inv_${p.inventory_id}`, Number(p.stock_quantity ?? p.stock ?? 0));
          }
          const unit = (p.unit || "").trim().toLowerCase();
          stockMap.set(`prod_${p.id}_${unit}`, Number(p.stock_quantity ?? p.stock ?? 0));
        });
      });

      let needsAdjustment = false;
      const adjusted = cartItems.map((item) => {
        const keyInv = item.inventory_id ? `inv_${item.inventory_id}` : null;
        const keyUnit = `prod_${item.product_id}_${(item.warehouse_unit || item.unit || "").trim().toLowerCase()}`;
        const latestStock =
          keyInv && stockMap.has(keyInv)
            ? stockMap.get(keyInv)!
            : stockMap.has(keyUnit)
              ? stockMap.get(keyUnit)!
              : item.available_stock;

        if (latestStock !== item.available_stock || item.quantity > latestStock) {
          needsAdjustment = true;
          return {
            ...item,
            available_stock: latestStock,
            quantity: latestStock <= 0 ? 0 : Math.max(1, Math.min(item.quantity, latestStock)),
          };
        }
        return item;
      });

      if (needsAdjustment) {
        useStockMovementsStore.setState({
          cartItems: adjusted,
          totalCartItems: adjusted.length,
          totalCartUnits: adjusted.reduce((s, i) => s + i.quantity, 0),
        });
      }
    }
  }, [isOpen, warehouseProducts]);

  // Funciones para trasladar todos los productos en bloque sin esfuerzo manual
  const handleTransferAllWarehouse = async (mode: "full" | "one" = "full") => {
    // 1. Refrescar inventario del almacén para garantizar datos en tiempo real
    await useWarehouseStore.getState().getWarehouseProducts();
    const freshProducts = useWarehouseStore.getState().warehouseProducts;

    const freshAvailable = (freshProducts || []).flatMap((g: any) =>
      (g.products || []).map((p: any) => ({
        ...p,
        category_name: g.category_path || g.category || p.category,
        category_slug: g.category_slug || "",
        category_id: g.category_id || p.category_id,
      }))
    ).filter((p: any) => {
      const stock = Number(p.stock_quantity ?? p.stock ?? 0);
      return !isNaN(stock) && stock > 0;
    });

    if (freshAvailable.length === 0) {
      toast.warning("No hay productos con existencias disponibles (> 0) en almacén para trasladar.");
      return;
    }
    addAllToCart(freshAvailable, mode);
  };

  const handleTransferFilteredProducts = (mode: "full" | "one" = "full") => {
    const validFiltered = filteredWarehouseProducts.filter((p: any) => {
      const stock = Number(p.stock_quantity ?? p.stock ?? 0);
      return !isNaN(stock) && stock > 0;
    });

    if (validFiltered.length === 0) {
      toast.warning("No hay productos con existencias disponibles (> 0) que coincidan con la búsqueda o filtro aplicado.");
      return;
    }
    addAllToCart(validFiltered, mode);
  };

  // Filtrar productos según búsqueda y categoría seleccionada
  const filteredWarehouseProducts = useMemo(() => {
    let result = availableWarehouseProducts;

    if (selectedCategoryFilter && selectedCategoryFilter !== "all") {
      result = result.filter((p: any) => {
        const catName = (p.category_name || "").toLowerCase();
        const catSlug = (p.category_slug || "").toLowerCase();
        const filterVal = selectedCategoryFilter.toLowerCase();
        return catName.includes(filterVal) || catSlug.includes(filterVal);
      });
    }

    if (searchProductQuery.trim()) {
      const q = searchProductQuery.toLowerCase().trim();
      result = result.filter(
        (p: any) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }

    return result;
  }, [availableWarehouseProducts, selectedCategoryFilter, searchProductQuery]);

  // Opciones combinadas para el selector de categorías
  const categoryOptions = useMemo(() => [
    { key: "all", name: "Todas las categorías" },
    ...(categories || []).map((c: any) => ({
      key: String(c.slug || c.name),
      name: getLeafCategoryName(c.name),
    })),
  ], [categories]);

  // Totales
  const totalCost = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity * item.cost_price, 0);
  }, [cartItems]);

  const totalSale = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity * item.sale_price, 0);
  }, [cartItems]);

  // Validación previa común
  const validateBeforeDispatch = (): boolean => {
    if (!selectedStoreId) {
      toast.error("Debes seleccionar una tienda de destino.");
      return false;
    }

    if (cartItems.length === 0) {
      toast.error("El carrito de transferencia está vacío.");
      return false;
    }

    // Validar existencias
    for (const item of cartItems) {
      if (item.available_stock <= 0) {
        toast.error(`'${item.product_name}' está agotado en almacén (0 existencias). Quítalo del carrito para continuar.`);
        return false;
      }

      if (item.quantity > item.available_stock) {
        toast.error(
          `La cantidad solicitada para '${item.product_name}' (${item.quantity}) supera el stock disponible en almacén (${item.available_stock}).`
        );
        return false;
      }
    }
    return true;
  };

  // 1. Confirmar Envío regular (En Tránsito)
  const handleConfirmDispatch = async () => {
    if (!validateBeforeDispatch()) return;

    const payload = {
      destination_store_id: selectedStoreId,
      notes: notes.trim() || undefined,
      direct_to_store: false,
      items: cartItems.map((item) => ({
        inventory_id: item.inventory_id || undefined,
        product_id: item.product_id,
        quantity: Math.min(Number(item.quantity), Number(item.available_stock)),
        cost_price: item.cost_price,
        sale_price: item.sale_price,
        unit: item.unit || "Unidad",
        min_stock: Number(item.min_stock) || 0,
        expiration_date: item.expiration_date || null,
      })),
    };

    const movement = await createMovement(payload);
    if (movement) {
      setNotes("");
      onClose();
      onMovementCreated(movement);
    }
  };

  // 2. Directo a la Tienda (Registro inmediato en inventory_stores y estado Recibido)
  const handleDirectToStore = async () => {
    if (!validateBeforeDispatch()) return;

    setIsSubmittingDirect(true);
    try {
      const payload = {
        destination_store_id: selectedStoreId,
        notes: notes.trim() || undefined,
        direct_to_store: true,
        items: cartItems.map((item) => ({
          inventory_id: item.inventory_id || undefined,
          product_id: item.product_id,
          quantity: Math.min(Number(item.quantity), Number(item.available_stock)),
          cost_price: item.cost_price,
          sale_price: item.sale_price,
          unit: item.unit || "Unidad",
          min_stock: Number(item.min_stock) || 0,
          expiration_date: item.expiration_date || null,
        })),
      };

      const movement = await createMovement(payload);
      if (movement) {
        setNotes("");
        onClose();
        onMovementCreated(movement);
      }
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  return (
    <>
      <datalist id="common-units-list">
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
          wrapper: isMobile
            ? (isKeyboardOpen
              ? "items-start justify-center p-0"
              : "items-end sm:items-center justify-center p-0 sm:p-4")
            : "items-center justify-center",
          base: [
            "bg-background border border-default-200 dark:border-default-100",
            "w-full max-w-full sm:max-w-5xl",
            "m-0 sm:my-auto",
            "overflow-hidden min-h-0",
            isMobile
              ? (isKeyboardOpen
                ? "rounded-none max-h-full h-full"
                : "rounded-t-2xl rounded-b-none sm:rounded-2xl max-h-[94dvh] sm:max-h-[92vh]")
              : "rounded-2xl sm:max-h-[92vh]",
          ].join(" "),
          header: "border-b border-default-200 dark:border-default-100 pb-2.5 sm:pb-3 px-3.5 sm:px-6 shrink-0",
          body: "py-2.5 sm:py-3 px-3.5 sm:px-6 flex flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0",
          footer: "border-t border-default-200 dark:border-default-100 pt-2.5 sm:pt-3 px-3.5 sm:px-6 shrink-0 bg-background",
        }}
      >
        <ModalContent style={modalStyle}>
          {() => (
            <div ref={containerRef} className="flex flex-col h-full w-full min-h-0 overflow-hidden">
              {/* Indicador visual de Mobile Sheet con gesto de arrastre hacia abajo para cerrar */}
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

              {/* ENCABEZADO */}
              <ModalHeader
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 select-none cursor-grab active:cursor-grabbing touch-none"
                onTouchStart={handleDragTouchStart}
                onTouchMove={handleDragTouchMove}
                onTouchEnd={handleDragTouchEnd}
                onTouchCancel={handleDragTouchEnd}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-primary/10 text-primary shrink-0">
                    <FaTruckFast className="text-base sm:text-xl" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                      <span>Carrito de Traslado</span>
                      <Chip size="sm" color="primary" variant="flat" className="font-semibold text-xs">
                        {totalCartItems} prod. • {totalCartUnits} u.
                      </Chip>
                    </h2>
                    <p className="text-xs text-default-500 font-normal hidden sm:block">
                      Distribución y traslado de existencias de Almacén Central hacia Tienda destino
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end flex-wrap">
                  {/* BOTÓN / DROPDOWN: LLEVAR TODO EL ALMACÉN A TIENDA */}
                  {availableWarehouseProducts.length > 0 && (
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button
                          size="sm"
                          color="secondary"
                          variant="flat"
                          startContent={<FaBoxesStacked className="text-xs" />}
                          className="text-xs font-semibold h-8 bg-secondary-50 dark:bg-secondary-900/40 text-secondary-600 dark:text-secondary-300 border border-secondary-200/80 hover:bg-secondary-100"
                        >
                          <span className="hidden xs:inline">Llevar Todo a Tienda</span>
                          <span className="xs:hidden">Llevar Todo</span>
                          <Chip
                            size="sm"
                            variant="solid"
                            color="secondary"
                            className="h-4.5 text-[10px] font-bold px-1 min-w-0 ml-0.5"
                          >
                            {availableWarehouseProducts.length}
                          </Chip>
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Opciones para llevar todo el almacén">
                        <DropdownItem
                          key="all-full"
                          description="Traslada el 100% del stock disponible de todos los productos"
                          startContent={<FaBoxesStacked className="text-secondary text-base" />}
                          onPress={() => handleTransferAllWarehouse("full")}
                        >
                          <span className="font-bold text-xs">Con todo su stock disponible</span>
                        </DropdownItem>
                        <DropdownItem
                          key="all-one"
                          description="Carga 1 unidad de cada producto (ideal para muestras o catálogo inicial)"
                          startContent={<FaPlus className="text-primary text-base" />}
                          onPress={() => handleTransferAllWarehouse("one")}
                        >
                          <span className="font-bold text-xs">Con 1 unidad cada uno</span>
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  )}

                  <Button
                    size="sm"
                    color={isProductPickerOpen ? "primary" : "default"}
                    variant={isProductPickerOpen ? "solid" : "flat"}
                    onPress={() => setIsProductPickerOpen(!isProductPickerOpen)}
                    startContent={<FaMagnifyingGlass className="text-xs" />}
                    className="text-xs font-semibold h-8"
                  >
                    {isProductPickerOpen ? "Ocultar Buscador" : "Buscar Productos"}
                  </Button>

                  {cartItems.length > 0 && (
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={clearCart}
                      startContent={<FaTrashCan className="text-xs" />}
                      className="text-xs h-8"
                    >
                      Vaciar
                    </Button>
                  )}
                </div>
              </ModalHeader>

              {/* CUERPO DEL MODAL */}
              <ModalBody className="py-2 flex flex-col gap-2">
                {/* 1. SELECCIÓN DE TIENDA DESTINO */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1.5 rounded-2xl bg-default-100/70 dark:bg-default-50/50 border border-default-200">
                  <div className="flex items-center gap-2 text-default-700 min-w-fit">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary hidden sm:block">
                      <FaStore className="text-base" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider block">
                        Tienda Destino <span className="text-danger">*</span>
                      </span>
                      <span className="text-[11px] text-default-400 hidden sm:block">
                        Sucursal que recibirá los productos
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:max-w-md">
                    <Select
                      aria-label="Seleccionar tienda destino"
                      placeholder="Selecciona la tienda destino..."
                      size="sm"
                      variant="bordered"
                      selectedKeys={selectedStoreId ? [selectedStoreId] : []}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                      classNames={{
                        trigger: "bg-background border-default-300 font-medium",
                      }}
                    >
                      {shops.map((shop) => (
                        <SelectItem key={shop.id} value={shop.id} textValue={shop.name}>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground">{shop.name}</span>
                            {shop.address && (
                              <span className="text-[11px] text-default-400">
                                📍 {shop.address}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* 2. BUSCADOR DE PRODUCTOS Y FILTRO POR CATEGORÍAS (Colapsable o siempre accesible) */}
                <div className="p-1.5 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        Buscar y Agregar Productos de Almacén:
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                      {/* Botón rápido para llevar todos los filtrados */}
                      {filteredWarehouseProducts.length > 0 && (
                        <Button
                          size="sm"
                          color="secondary"
                          variant="flat"
                          className="text-xs font-bold h-9 px-2.5 bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-300 border border-secondary-200"
                          startContent={<FaCheckDouble className="text-xs" />}
                          onPress={() => handleTransferFilteredProducts("full")}
                        >
                          {searchProductQuery || selectedCategoryFilter !== "all"
                            ? `Llevar ${filteredWarehouseProducts.length} filtrados`
                            : `Llevar todos (${availableWarehouseProducts.length})`}
                        </Button>
                      )}

                      {/* Filtro por Categoría */}
                      <div className="w-full sm:w-48">
                        <Select
                          aria-label="Filtrar por categoría"
                          size="sm"
                          variant="bordered"
                          placeholder="Categoría"
                          selectedKeys={[selectedCategoryFilter]}
                          onChange={(e) => setSelectedCategoryFilter(e.target.value || "all")}
                          startContent={<FaFilter className="text-default-400 text-xs" />}
                          classNames={{
                            trigger: "bg-background border-default-300 text-xs h-9",
                          }}
                        >
                          {categoryOptions.map((c) => (
                            <SelectItem key={c.key} value={c.key}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>

                      {/* Input de Búsqueda */}
                      <div className="w-full sm:w-64">
                        <Input
                          size="sm"
                          variant="bordered"
                          placeholder="Buscar por nombre, SKU, código..."
                          value={searchProductQuery}
                          onValueChange={setSearchProductQuery}
                          isClearable
                          onClear={() => setSearchProductQuery("")}
                          startContent={<FaMagnifyingGlass className="text-default-400 text-xs" />}
                          classNames={{
                            inputWrapper: "bg-background border-default-300 h-9",
                            input: "text-xs",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resultados Rápidos de Productos para Agregar */}
                  {(isProductPickerOpen || searchProductQuery.trim().length > 0 || selectedCategoryFilter !== "all") && (
                    <div className="mt-1">
                      {filteredWarehouseProducts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-default-400 border border-dashed border-default-300 rounded-xl bg-background/50">
                          No se encontraron productos disponibles en almacén con los filtros aplicados.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto overscroll-contain pr-1">
                          {filteredWarehouseProducts.map((prod: any) => {
                            const inCart = cartItems.find(
                              (ci) =>
                                (ci.inventory_id && prod.inventory_id && String(ci.inventory_id) === String(prod.inventory_id)) ||
                                (String(ci.product_id) === String(prod.id) &&
                                  (ci.unit || "").trim().toLowerCase() === (prod.unit || "Unidad").trim().toLowerCase())
                            );
                            const stockAvailable = Number(prod.stock_quantity ?? prod.stock ?? 0);
                            const isMaxInCart = inCart && inCart.quantity >= stockAvailable;
                            const pickerKey = prod.inventory_id ? String(prod.inventory_id) : `${prod.id}_${prod.unit || ""}`;

                            return (
                              <div
                                key={pickerKey}
                                className="flex items-center justify-between gap-2.5 p-2 bg-background rounded-xl border border-default-200 hover:border-primary/50 transition-colors shadow-sm"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <img
                                    src={
                                      getImageUrl(prod.thumbnail || prod.image) ||
                                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'><rect width='36' height='36' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8'>IMG</text></svg>"
                                    }
                                    alt={prod.name}
                                    className="w-10 h-10 object-cover rounded-lg border border-default-200 shrink-0 bg-default-100"
                                    onError={(e: any) => {
                                      e.target.src =
                                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'><rect width='36' height='36' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8'>IMG</text></svg>";
                                    }}
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-semibold text-foreground truncate" title={prod.name}>
                                      {prod.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[11px] text-default-400">
                                      {prod.sku && <span className="font-mono">{prod.sku}</span>}
                                      <span>•</span>
                                      <span className="text-success-600 dark:text-success-400 font-bold">
                                        Disp: {stockAvailable} {prod.unit || "u."}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  size="sm"
                                  isIconOnly={Boolean(inCart)}
                                  color={inCart ? "secondary" : "primary"}
                                  variant={inCart ? "flat" : "solid"}
                                  isDisabled={isMaxInCart}
                                  onPress={() => addToCart(prod, 1)}
                                  className="h-8 min-w-8 text-xs font-bold shrink-0"
                                  title={isMaxInCart ? "Límite de stock alcanzado" : "Añadir a la lista de envío"}
                                >
                                  {inCart ? (
                                    <span className="font-bold text-xs">{inCart.quantity}</span>
                                  ) : (
                                    <FaCartPlus className="text-xs" />
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. TABLA DE "PRODUCTOS A DESPACHAR" */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                        <span>Productos a Despachar:</span>
                      </span>
                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-xs font-semibold">
                        {cartItems.length} ítems
                      </Chip>
                    </div>

                    <div className="flex items-center gap-2">
                      {cartItems.length > 0 && cartItems.length < availableWarehouseProducts.length && (
                        <Button
                          size="sm"
                          color="secondary"
                          variant="light"
                          className="h-7 text-xs font-semibold text-secondary-600 dark:text-secondary-300"
                          startContent={<FaBoxesStacked className="text-xs" />}
                          onPress={() => handleTransferAllWarehouse("full")}
                        >
                          Completar con todo el Almacén ({availableWarehouseProducts.length})
                        </Button>
                      )}
                      <span className="text-xs text-default-400">
                        {totalCartUnits} unidades en total
                      </span>
                    </div>
                  </div>

                  {/* Alerta de discrepancia si algún producto excede stock o está agotado */}
                  {cartItems.some((i) => i.available_stock <= 0 || i.quantity > i.available_stock) && (
                    <div className="p-2.5 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-danger text-sm shrink-0">⚠️</span>
                        <span className="text-xs text-danger font-semibold">
                          Hay productos en el carrito con stock insuficiente o agotados en almacén.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          color="danger"
                          variant="solid"
                          className="h-7 text-xs font-bold"
                          onPress={() => {
                            const adjusted = cartItems
                              .filter((i) => i.available_stock > 0)
                              .map((i) => ({ ...i, quantity: Math.min(i.quantity, i.available_stock) }));
                            useStockMovementsStore.setState({
                              cartItems: adjusted,
                              totalCartItems: adjusted.length,
                              totalCartUnits: adjusted.reduce((s, i) => s + i.quantity, 0),
                            });
                            toast.success("Cantidades ajustadas al stock disponible y productos agotados descartados.");
                          }}
                        >
                          Ajustar al Stock Disponible
                        </Button>
                      </div>
                    </div>
                  )}

                  {cartItems.length === 0 ? (
                    <div className="p-8 sm:p-10 text-center border-2 border-dashed border-default-200 rounded-2xl flex flex-col items-center justify-center gap-3 bg-default-50/40">
                      <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                        <FaTruckFast className="text-3xl" />
                      </div>
                      <div className="flex flex-col gap-1 max-w-sm">
                        <span className="font-bold text-sm text-foreground">
                          El carrito de distribución está vacío
                        </span>
                        <p className="text-xs text-default-500">
                          Agrega productos individuales o pulsa el botón para trasladar todos los productos del almacén de una sola vez.
                        </p>
                      </div>

                      {availableWarehouseProducts.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
                          <Button
                            color="secondary"
                            variant="shadow"
                            size="md"
                            onPress={() => handleTransferAllWarehouse("full")}
                            startContent={<FaBoxesStacked className="text-base" />}
                            className="font-bold text-xs"
                          >
                            Llevar Todo el Almacén a Tienda ({availableWarehouseProducts.length} productos)
                          </Button>
                          <Button
                            color="default"
                            variant="flat"
                            size="md"
                            onPress={() => handleTransferAllWarehouse("one")}
                            startContent={<FaPlus className="text-xs" />}
                            className="font-medium text-xs text-default-600 border border-default-200"
                          >
                            Llevar 1 unidad de c/u
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-default-200 rounded-2xl bg-background shadow-sm overscroll-contain">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-default-100/70 dark:bg-default-50/50 border-b border-default-200 text-default-500 font-bold uppercase text-[11px] tracking-wider">
                            <th className="py-3 px-3">Producto</th>
                            <th className="py-3 px-2 w-32">Unidad</th>
                            <th className="py-3 px-2 w-24 text-center">Stock Mín.</th>
                            <th className="py-3 px-2 w-32 text-center">Cantidad</th>
                            <th className="py-3 px-2 w-28 text-right">Precio Venta</th>
                            <th className="py-3 px-2 w-28 text-center">Datos Extra</th>
                            <th className="py-3 px-2 w-28 text-right">Subtotal Costo</th>
                            <th className="py-3 px-3 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                          {cartItems.map((item) => {
                            const maxStock = item.available_stock;
                            const warehouseUnit = item.warehouse_unit || item.unit || "Unidad";
                            const isExceeding = item.quantity > maxStock;
                            const isOutOfStock = maxStock <= 0;
                            const itemKey =
                              item.cart_item_id ||
                              (item.inventory_id
                                ? `inv_${item.inventory_id}`
                                : `prod_${item.product_id}_${(item.warehouse_unit || item.unit || "u").trim().toLowerCase()}`);

                            return (
                              <tr
                                key={itemKey}
                                className={`hover:bg-default-50/70 transition-colors ${isOutOfStock
                                  ? "bg-danger-50/30 dark:bg-danger-950/20"
                                  : isExceeding
                                    ? "bg-warning-50/30 dark:bg-warning-950/20"
                                    : ""
                                  }`}
                              >
                                {/* PRODUCTO */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2.5 min-w-[180px]">
                                    <img
                                      src={
                                        getImageUrl(item.thumbnail) ||
                                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8'>IMG</text></svg>"
                                      }
                                      alt={item.product_name}
                                      className="w-10 h-10 object-cover rounded-lg border border-default-200 shrink-0 bg-default-100"
                                      onError={(e: any) => {
                                        e.target.src =
                                          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8'>IMG</text></svg>";
                                      }}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-semibold text-foreground truncate max-w-[220px]" title={item.product_name}>
                                        {item.product_name}
                                      </span>
                                      <div className="flex items-center gap-1.5 text-[10px] text-default-400 flex-wrap">
                                        <Chip
                                          size="sm"
                                          variant="flat"
                                          color={isOutOfStock ? "danger" : isExceeding ? "danger" : "warning"}
                                          className="h-4 text-[9px] px-1 font-bold"
                                        >
                                          Almacén: {maxStock} {warehouseUnit}
                                        </Chip>
                                        {item.expiration_date && (
                                          <>
                                            <span>•</span>
                                            <Chip size="sm" variant="flat" color="danger" className="h-4 text-[9px] px-1 font-bold">
                                              Vence: {item.expiration_date}
                                            </Chip>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* UNIDAD (Editable, por defecto unidad de almacén) */}
                                <td className="py-2.5">
                                  <input
                                    type="text"
                                    list="common-units-list"
                                    value={item.unit}
                                    onChange={(e) => updateUnit(itemKey, e.target.value)}
                                    placeholder="Unidad"
                                    className="w-full text-xs font-semibold px-1 py-1 rounded-lg border border-default-200 bg-background focus:outline-none focus:border-primary text-foreground"
                                    title="Unidad de venta para la tienda (preseleccionada de almacén)"
                                  />
                                </td>

                                {/* STOCK MÍNIMO (min_stock editable) */}
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="any"
                                    value={item.min_stock ?? 0}
                                    onChange={(e) => updateMinStock(itemKey, parseFloat(e.target.value) || 0)}
                                    className="w-20 text-center text-xs font-bold px-1.5 py-1 rounded-lg border border-default-200 bg-background focus:outline-none focus:border-primary text-foreground"
                                    title="Stock mínimo para alertas en tienda destino"
                                  />
                                </td>

                                {/* CANTIDAD (- / + y entrada numérica) */}
                                <td className="py-2.5 px-2 text-center">
                                  <div className="inline-flex items-center gap-1 bg-default-100 rounded-lg p-0.5 border border-default-200">
                                    <Button
                                      size="sm"
                                      isIconOnly
                                      variant="light"
                                      className="h-6 w-6 min-w-6"
                                      isDisabled={item.quantity <= 1}
                                      onPress={() => updateQuantity(itemKey, Math.max(1, Number((item.quantity - 1).toFixed(3))), item.unit)}
                                    >
                                      <FaMinus className="text-[10px]" />
                                    </Button>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min={1}
                                      max={maxStock}
                                      step="any"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        updateQuantity(itemKey, isNaN(val) ? 1 : Math.max(1, val), item.unit);
                                      }}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (isNaN(val) || val < 1) {
                                          updateQuantity(itemKey, 1, item.unit);
                                        }
                                      }}
                                      className={`w-12 text-center text-xs font-bold bg-transparent focus:outline-none ${isExceeding ? "text-danger" : "text-foreground"
                                        }`}
                                    />
                                    <Button
                                      size="sm"
                                      isIconOnly
                                      variant="light"
                                      className="h-6 w-6 min-w-6"
                                      isDisabled={item.quantity >= maxStock}
                                      onPress={() => updateQuantity(itemKey, Math.min(maxStock, Number((item.quantity + 1).toFixed(3))), item.unit)}
                                    >
                                      <FaPlus className="text-[10px]" />
                                    </Button>
                                  </div>
                                </td>

                                {/* PRECIO VENTA TIENDA */}
                                <td className="py-2.5 px-2 text-right">
                                  <span className="text-[11px] text-default-400">Compra: </span>
                                  <span className="text-[11px] text-default-400 font-medium">{Number(item.cost_price || 0).toFixed(2)}</span>
                                  <div className="inline-flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.01"
                                      min={0}
                                      value={item.sale_price !== undefined && item.sale_price !== null ? item.sale_price : ""}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        updateSalePrice(itemKey, isNaN(val) ? 0 : val, item.unit);
                                      }}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        updateSalePrice(itemKey, isNaN(val) ? 0 : Number(val.toFixed(2)), item.unit);
                                      }}
                                      className="w-20 text-right text-xs font-bold px-1.5 py-1 rounded-lg border border-default-200 bg-background focus:outline-none focus:border-primary text-foreground"
                                    />
                                  </div>
                                </td>

                                {/* DATOS EXTRA / FORMULARIO OCULTO OPCIONAL */}
                                <td className="py-2.5 px-2 text-center">
                                  <Popover
                                    placement="bottom"
                                    showArrow
                                    backdrop="transparent"
                                    shouldBlockScroll={false}
                                    offset={8}
                                    classNames={{ content: "z-[9999]" }}
                                  >
                                    <PopoverTrigger>
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        className="h-8 text-xs font-medium border-default-200"
                                        startContent={<FaSliders className="text-xs" />}
                                      >
                                        <span>Datos</span>
                                        {item.expiration_date && (
                                          <Chip
                                            size="sm"
                                            color="warning"
                                            variant="solid"
                                            className="h-4 min-w-4 px-1 text-[9px] font-bold"
                                          >
                                            Exp
                                          </Chip>
                                        )}
                                      </Button>
                                    </PopoverTrigger>

                                    {/* CONTENIDO DEL POPOVER PARA ESTE PRODUCTO */}
                                    <PopoverContent className="w-80 p-3.5 flex flex-col gap-3 bg-background border border-default-200 shadow-xl rounded-2xl z-[9999]">
                                      <div className="border-b border-default-100 pb-2">
                                        <div className="flex items-center gap-1.5 text-primary">
                                          <FaSliders className="text-xs" />
                                          <h4 className="text-xs font-bold text-foreground truncate">
                                            Datos Adicionales: {item.product_name}
                                          </h4>
                                        </div>
                                        <p className="text-[11px] text-default-400 mt-0.5">
                                          Configura fecha de vencimiento y detalles opcionales para la tienda.
                                        </p>
                                      </div>

                                      <div className="flex flex-col gap-2.5">
                                        {/* Fecha de Vencimiento */}
                                        <Input
                                          label="Fecha de Vencimiento"
                                          type="date"
                                          size="sm"
                                          variant="bordered"
                                          value={item.expiration_date || ""}
                                          onChange={(e) => updateExpirationDate(itemKey, e.target.value)}
                                          startContent={<FaCalendarDay className="text-default-400 text-xs" />}
                                          description="Opcional. Caducidad del lote o producto."
                                        />
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </td>

                                {/* SUBTOTAL COSTO */}
                                <td className="py-2.5 px-2 text-right font-bold text-foreground">
                                  <PriceDisplay amount={item.quantity * item.cost_price} />
                                </td>

                                {/* ACCIÓN: QUITAR */}
                                <td className="py-2.5 px-3 text-center">
                                  <Tooltip content="Quitar del envío">
                                    <Button
                                      size="sm"
                                      isIconOnly
                                      color="danger"
                                      variant="light"
                                      className="h-7 w-7 min-w-7 text-danger"
                                      onPress={() => removeFromCart(itemKey)}
                                    >
                                      <FaTrashCan className="text-xs" />
                                    </Button>
                                  </Tooltip>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. NOTAS U OBSERVACIONES */}
                {cartItems.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <Textarea
                      label="Notas u Observaciones del Traslado (Opcional)"
                      placeholder="Ej. Distribución para reposición de stock, encargado del traslado, motivo..."
                      size="sm"
                      variant="bordered"
                      minRows={2}
                      value={notes}
                      onValueChange={setNotes}
                    />
                  </div>
                )}

                {/* 5. RESUMEN DE TOTALES */}
                {cartItems.length > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center p-3.5 bg-default-100 dark:bg-default-50/50 rounded-2xl border border-default-200 gap-3">
                    <div className="flex items-center gap-2 text-xs text-default-600">
                      <FaCircleInfo className="text-primary text-base shrink-0" />
                      <span>
                        <b>Opciones de Despacho:</b> Puedes enviar con guía en tránsito o registrarlo <b>Directo a la tienda</b> como recibido.
                      </span>
                    </div>
                    <div className="flex items-baseline gap-5 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-default-400 uppercase font-medium">Total Unidades</span>
                        <span className="text-sm font-bold text-foreground">{totalCartUnits} u.</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-default-400 uppercase font-medium">Costo Traslado</span>
                        <span className="text-base font-bold text-primary">
                          <PriceDisplay amount={totalCost} />
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-default-400 uppercase font-medium">Venta Estimada</span>
                        <span className="text-base font-bold text-success-600 dark:text-success-400">
                          <PriceDisplay amount={totalSale} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </ModalBody>

              {/* FOOTER CON BOTONES DE ACCIÓN */}
              <ModalFooter style={footerStyle} className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <Button
                  size="sm"
                  variant="light"
                  color="default"
                  onPress={onClose}
                  isDisabled={isLoading || isSubmittingDirect}
                  className="w-full sm:w-auto h-8 text-xs font-medium order-3 sm:order-1"
                >
                  Seguir Seleccionando
                </Button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
                  {/* BOTÓN 2: CONFIRMAR ENVÍO (En Tránsito) */}
                  <Button
                    color="primary"
                    variant="shadow"
                    size="sm"
                    isLoading={isLoading && !isSubmittingDirect}
                    isDisabled={cartItems.length === 0 || !selectedStoreId || isLoading || isSubmittingDirect}
                    startContent={!isLoading ? <FaTruckFast className="text-sm" /> : undefined}
                    onPress={handleConfirmDispatch}
                    className="flex-1 sm:flex-none font-bold shadow-primary/25 h-8 text-xs"
                    title="Crea el traslado en estado En Tránsito y genera Guía de Remisión"
                  >
                    Enviar en Carro
                  </Button>

                  {/* BOTÓN 1: DIRECTO A LA TIENDA (Registro inmediato en inventory_stores y estado Recibido) */}
                  <Button
                    color="success"
                    variant="shadow"
                    size="sm"
                    isLoading={isSubmittingDirect}
                    isDisabled={cartItems.length === 0 || !selectedStoreId || isLoading || isSubmittingDirect}
                    startContent={!isSubmittingDirect ? <FaCheck className="text-sm" /> : undefined}
                    onPress={handleDirectToStore}
                    className="flex-1 sm:flex-none font-bold text-white shadow-success/25 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 h-8 text-xs"
                    title="Registra inmediatamente los productos en la tienda destino en estado RECIBIDO y genera el PDF de Guía"
                  >
                    Recibir Ahora
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

export default DrawerTransferCart;
