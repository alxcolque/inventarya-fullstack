import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
  Switch,
} from "@nextui-org/react";
import {
  FaBoxesStacked,
  FaCalendarDay,
  FaCoins,
  FaTag,
  FaFloppyDisk,
  FaXmark,
  FaTriangleExclamation,
  FaStore,
  FaPlus,
  FaMinus,
} from "react-icons/fa6";
import { tenantApi } from "@/api";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { updateOfflineProductInventory } from "@/modules/tenant/pos/offline/pos-db";
import { useCurrency } from "@/stores/currency/currency.store";
import { useMobileKeyboardViewport } from "@/hooks";
import { getImageUrl } from "@/utils/image";

interface ModalEditStoreInventoryProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null;
  onSuccess: () => void;
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

export const ModalEditStoreInventory: React.FC<ModalEditStoreInventoryProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const { symbol: currencySymbol } = useCurrency();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [salePrice, setSalePrice] = useState<string>("0");
  const [costPrice, setCostPrice] = useState<string>("0");
  const [stockQuantity, setStockQuantity] = useState<string>("0");
  const [minStock, setMinStock] = useState<string>("0");
  const [unit, setUnit] = useState<string>("Unidad");
  const [expirationDate, setExpirationDate] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);

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

  useEffect(() => {
    if (product && isOpen) {
      setSalePrice(String(product.sale_price ?? product.saleprice ?? product.price ?? 0));
      setCostPrice(String(product.price ?? 0));
      setStockQuantity(String(product.stock_quantity ?? product.stock ?? product.quantity ?? 0));
      setMinStock(String(product.min_stock ?? 0));
      setUnit(product.unit || "Unidad");
      setExpirationDate(product.expiration_date ? String(product.expiration_date).split("T")[0] : "");
      setIsPublic(product.is_public !== undefined ? Boolean(product.is_public) : true);
    }
  }, [product, isOpen]);

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
      maxHeight: "92dvh",
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

  // Stepper rápido para ajuste cómodo de stock en celular
  const handleStockStep = (delta: number) => {
    const current = parseFloat(stockQuantity) || 0;
    const next = Math.max(0, Number((current + delta).toFixed(3)));
    setStockQuantity(String(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const inventoryId = product.inventory_id ?? product.id;
    if (!inventoryId) {
      toast.error("Identificador de inventario no encontrado.");
      return;
    }

    const numSalePrice = parseFloat(salePrice);
    const numCostPrice = parseFloat(costPrice);
    const numStock = parseFloat(stockQuantity);
    const numMinStock = parseFloat(minStock);

    if (isNaN(numSalePrice) || numSalePrice < 0) {
      toast.error("El precio de venta debe ser un número válido mayor o igual a 0.");
      return;
    }

    if (isNaN(numStock) || numStock < 0) {
      toast.error("El stock debe ser un número válido mayor o igual a 0.");
      return;
    }

    setIsSubmitting(true);

    const payload: Record<string, any> = {
      sale_price: numSalePrice,
      price: !isNaN(numCostPrice) && numCostPrice >= 0 ? numCostPrice : numSalePrice,
      stock_quantity: numStock,
      quantity: numStock,
      min_stock: !isNaN(numMinStock) && numMinStock >= 0 ? numMinStock : 0,
      unit: unit.trim() || "Unidad",
      expiration_date: expirationDate || null,
      is_public: isPublic,
    };

    try {
      if (navigator.onLine) {
        await tenantApi.put(`/inventory-stores/${inventoryId}`, payload);
      }

      // Actualizar en IndexedDB localmente para persistencia offline inmediata
      await updateOfflineProductInventory(inventoryId, {
        sale_price: payload.sale_price,
        price: payload.price,
        stock_quantity: payload.stock_quantity,
        quantity: payload.quantity,
        min_stock: payload.min_stock,
        unit: payload.unit,
        expiration_date: payload.expiration_date,
        is_public: payload.is_public,
      });

      toast.success("Inventario de tienda actualizado correctamente.");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al actualizar inventario:", error);
      if (isAxiosError(error)) {
        toast.error(
          error.response?.data?.message ||
            error.response?.data?.errors
            ? Object.values(error.response?.data?.errors).flat().join(" ")
            : "Error al actualizar el registro de inventario."
        );
      } else {
        toast.error("Error inesperado al intentar guardar los cambios.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product) return null;

  return (
    <>
      <datalist id="pos-common-units-list">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
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
            "w-full max-w-full sm:max-w-xl",
            "m-0 sm:my-auto",
            "overflow-hidden min-h-0",
            isMobile
              ? (isKeyboardOpen
                ? "rounded-none max-h-full h-full"
                : "rounded-t-3xl rounded-b-none sm:rounded-2xl max-h-[92dvh] sm:max-h-[90vh]")
              : "rounded-2xl sm:max-h-[90vh]",
          ].join(" "),
          header: "border-b border-default-200/80 pb-2.5 sm:pb-3 px-4 sm:px-6 shrink-0",
          body: "py-3 px-4 sm:px-6 flex flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0",
          footer: "border-t border-default-200/80 pt-2.5 sm:pt-3 px-4 sm:px-6 shrink-0 bg-background",
        }}
      >
        <ModalContent style={modalStyle}>
          {() => (
            <div ref={containerRef} className="flex flex-col h-full w-full min-h-0 overflow-hidden">
              {/* Indicador visual táctil para celulares con gesto de arrastre */}
              {isMobile && !isKeyboardOpen && (
                <div
                  className="sm:hidden w-full flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
                  onTouchStart={handleDragTouchStart}
                  onTouchMove={handleDragTouchMove}
                  onTouchEnd={handleDragTouchEnd}
                  onTouchCancel={handleDragTouchEnd}
                  onClick={onClose}
                  title="Deslizar hacia abajo para cerrar"
                >
                  <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col h-full w-full min-h-0">
                {/* ENCABEZADO */}
                <ModalHeader
                  className="flex flex-col gap-2 select-none cursor-grab active:cursor-grabbing touch-none"
                  onTouchStart={handleDragTouchStart}
                  onTouchMove={handleDragTouchMove}
                  onTouchEnd={handleDragTouchEnd}
                  onTouchCancel={handleDragTouchEnd}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                      <FaStore className="text-base sm:text-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
                        Editar Inventario en Tienda
                      </h3>
                      <p className="text-xs font-normal text-default-400 truncate">
                        Ajusta existencias, precios y vencimiento para el punto de venta
                      </p>
                    </div>
                  </div>

                  {/* Ficha rápida del Producto con foto, nombre y SKU */}
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-default-100/70 border border-default-200/70 min-w-0">
                    <img
                      src={
                        getImageUrl(product.thumbnail || product.image) ||
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8'>IMG</text></svg>"
                      }
                      alt={product.name}
                      className="w-10 h-10 object-cover rounded-lg border border-default-200 shrink-0 bg-default-100 shadow-2xs"
                      onError={(e: any) => {
                        e.target.src =
                          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8'>IMG</text></svg>";
                      }}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate" title={product.name}>
                        {product.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.sku && (
                          <Chip size="sm" variant="flat" className="font-mono text-[9px] sm:text-[10px] h-4.5 px-1">
                            SKU: {product.sku}
                          </Chip>
                        )}
                        <span className="text-[11px] text-default-400 font-medium">
                          Unidad: <b className="text-foreground">{unit || "Unidad"}</b>
                        </span>
                      </div>
                    </div>
                  </div>
                </ModalHeader>

                {/* CUERPO DEL FORMULARIO CON SECCIONES OPTIMIZADAS */}
                <ModalBody className="py-2.5 sm:py-3.5 flex flex-col gap-3">
                  {/* SECCIÓN 1: PRECIOS */}
                  <div className="p-3 rounded-2xl bg-default-50 dark:bg-default-100/40 border border-default-200/80 flex flex-col gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                      <FaCoins className="text-warning-500 text-xs" />
                      <span>Precios en Tienda</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* PRECIO DE VENTA */}
                      <Input
                        label="Precio de Venta (PVP)"
                        aria-label="Precio de Venta"
                        placeholder="0.00"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        size="sm"
                        variant="bordered"
                        isRequired
                        value={salePrice}
                        onValueChange={setSalePrice}
                        startContent={<span className="text-primary font-bold text-xs">{currencySymbol}</span>}
                        classNames={{
                          inputWrapper: "bg-background border-default-300 font-bold",
                          input: "font-bold text-sm text-foreground",
                        }}
                        description="Precio cobrado al cliente en POS"
                      />

                      {/* PRECIO DE COSTO */}
                      <Input
                        label="Precio de Costo"
                        aria-label="Precio de Costo"
                        placeholder="0.00"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        size="sm"
                        variant="bordered"
                        value={costPrice}
                        onValueChange={setCostPrice}
                        startContent={<span className="text-default-400 font-bold text-xs">{currencySymbol}</span>}
                        classNames={{
                          inputWrapper: "bg-background border-default-300",
                          input: "text-xs text-foreground",
                        }}
                        description="Costo unitario de adquisición"
                      />
                    </div>
                  </div>

                  {/* SECCIÓN 2: CONTROL DE EXISTENCIAS */}
                  <div className="p-3 rounded-2xl bg-default-50 dark:bg-default-100/40 border border-default-200/80 flex flex-col gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                      <FaBoxesStacked className="text-primary text-xs" />
                      <span>Existencias & Alertas</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* STOCK EN TIENDA CON STEPPERS */}
                      <div className="flex flex-col gap-1">
                        <Input
                          label="Stock Actual en Tienda"
                          aria-label="Stock Actual en Tienda"
                          placeholder="0"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          size="sm"
                          variant="bordered"
                          isRequired
                          value={stockQuantity}
                          onValueChange={setStockQuantity}
                          startContent={<FaBoxesStacked className="text-default-400 text-xs shrink-0" />}
                          endContent={
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                isIconOnly
                                variant="light"
                                className="h-6 w-6 min-w-6 text-default-500 hover:text-danger"
                                onPress={() => handleStockStep(-1)}
                                title="Restar 1"
                              >
                                <FaMinus className="text-[10px]" />
                              </Button>
                              <Button
                                size="sm"
                                isIconOnly
                                variant="light"
                                className="h-6 w-6 min-w-6 text-default-500 hover:text-success"
                                onPress={() => handleStockStep(1)}
                                title="Sumar 1"
                              >
                                <FaPlus className="text-[10px]" />
                              </Button>
                            </div>
                          }
                          classNames={{
                            inputWrapper: "bg-background border-default-300",
                            input: "font-bold text-sm text-foreground",
                          }}
                        />

                        {/* Botones de ajuste rápido en móvil */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-default-400">Rápido:</span>
                          {[1, 5, 10, 50].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleStockStep(num)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-default-200/60 hover:bg-default-300/60 text-default-700 active:scale-95 transition-transform"
                            >
                              +{num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* STOCK MÍNIMO PARA ALERTAS */}
                      <Input
                        label="Stock Mínimo de Alerta"
                        aria-label="Stock Mínimo de Alerta"
                        placeholder="0"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        size="sm"
                        variant="bordered"
                        value={minStock}
                        onValueChange={setMinStock}
                        startContent={<FaTriangleExclamation className="text-warning-500 text-xs shrink-0" />}
                        classNames={{
                          inputWrapper: "bg-background border-default-300",
                          input: "text-xs text-foreground",
                        }}
                        description="Alerta cuando el stock baje de este valor"
                      />
                    </div>
                  </div>

                  {/* SECCIÓN 3: UNIDAD Y VENCIMIENTO */}
                  <div className="p-3 rounded-2xl bg-default-50 dark:bg-default-100/40 border border-default-200/80 flex flex-col gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                      <FaTag className="text-secondary text-xs" />
                      <span>Unidad & Caducidad</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* UNIDAD DE MEDIDA */}
                      <Input
                        label="Unidad de Medida"
                        aria-label="Unidad de Medida"
                        placeholder="Ej. Unidad, Kg, Caja..."
                        size="sm"
                        variant="bordered"
                        value={unit}
                        onValueChange={setUnit}
                        list="pos-common-units-list"
                        classNames={{
                          inputWrapper: "bg-background border-default-300",
                          input: "text-xs text-foreground",
                        }}
                        description="Unidad para venta y fraccionamiento"
                      />

                      {/* FECHA DE VENCIMIENTO */}
                      <Input
                        label="Fecha de Vencimiento"
                        aria-label="Fecha de Vencimiento"
                        type="date"
                        size="sm"
                        variant="bordered"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        startContent={<FaCalendarDay className="text-default-400 text-xs shrink-0" />}
                        classNames={{
                          inputWrapper: "bg-background border-default-300",
                          input: "text-xs text-foreground",
                        }}
                        description="Fecha de caducidad del lote (opcional)"
                      />
                    </div>
                  </div>

                  {/* SECCIÓN 4: VISIBILIDAD PÚBLICA */}
                  <div className="p-3 rounded-2xl bg-default-50 dark:bg-default-100/40 border border-default-200/80 flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-default-700">
                          Visibilidad en consultas públicas
                        </span>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={isPublic ? "success" : "default"}
                          className="h-5 text-[10px] font-bold"
                        >
                          {isPublic ? "Público" : "Privado"}
                        </Chip>
                      </div>
                      <span className="text-[11px] text-default-400">
                        {isPublic
                          ? "Público: visible en catálogo externo y consultas públicas."
                          : "Privado: oculto en consultas públicas; disponible internamente en POS."}
                      </span>
                    </div>
                    <Switch
                      size="sm"
                      color="success"
                      isSelected={isPublic}
                      onValueChange={setIsPublic}
                      aria-label="Visibilidad pública del inventario"
                    />
                  </div>
                </ModalBody>

                {/* FOOTER ADAPTADO PARA MÓVILES */}
                <ModalFooter
                  style={footerStyle}
                  className="flex items-center justify-between sm:justify-end gap-2"
                >
                  <Button
                    size="sm"
                    variant="flat"
                    color="default"
                    className="font-bold text-xs flex-1 sm:flex-initial h-9"
                    startContent={<FaXmark className="text-xs" />}
                    onPress={onClose}
                    isDisabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    type="submit"
                    className="font-bold text-xs shadow-md flex-1 sm:flex-initial h-9"
                    startContent={<FaFloppyDisk className="text-xs" />}
                    isLoading={isSubmitting}
                  >
                    Guardar Cambios
                  </Button>
                </ModalFooter>
              </form>
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
