import React, { useState, useEffect, useMemo } from "react";
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
  Card,
  CardBody,
  Chip,
  Tabs,
  Tab,
  Tooltip,
} from "@nextui-org/react";
import {
  FaBoxesStacked,
  FaPlus,
  FaMinus,
  FaCheck,
  FaTruck,
  FaLocationDot,
  FaDollarSign,
  FaTag,
  FaBarcode,
  FaLayerGroup,
  FaArrowRight,
  FaShieldHalved,
  FaClipboardList,
} from "react-icons/fa6";
import { toast } from "sonner";
import { useWarehouseStore } from "../../store/inventories/inv-warehouse.store";
import { useSupplierStore, useLocationsStore, useCurrencyStore } from "@/stores";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getImageUrl } from "@/utils/image";
import { getLeafCategoryName } from "@/utils/category";

interface ModalAddStockProps {
  open: boolean;
  onClose: () => void;
  data: any;
  change?: (value: boolean) => void;
  token?: string;
  onSuccess?: () => void;
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

const ADJUSTMENT_REASONS = [
  "Conteo físico / Auditoría periódica",
  "Ingreso de mercadería sin orden de compra",
  "Ajuste por merma, rotura o vencimiento",
  "Corrección de error en registro inicial",
  "Devolución de cliente o tienda",
  "Reubicación o reorganización de almacén",
  "Otro ajuste manual",
];

export const ModalAddStock: React.FC<ModalAddStockProps> = ({
  open,
  onClose,
  data,
  change,
  token,
  onSuccess,
}) => {
  const { updatePriceQuantity } = useWarehouseStore();
  const suppliers = useSupplierStore((s) => s.suppliers);
  const getSuppliers = useSupplierStore((s) => s.getSuppliers);
  const locations = useLocationsStore((s) => s.locations);
  const getLocations = useLocationsStore((s) => s.getLocations);
  const currencySymbol = useCurrencyStore((s) => s.symbol) || "S/";

  // Modo de operación: "add" (Sumar stock) o "adjust" (Ajuste directo / conteo)
  const [activeTab, setActiveTab] = useState<"add" | "adjust">("add");

  // Estado del formulario
  const [addQuantity, setAddQuantity] = useState<string>("1");
  const [directStock, setDirectStock] = useState<string>("0");
  const [price, setPrice] = useState<string>("");
  const [minStock, setMinStock] = useState<string>("0");
  const [unit, setUnit] = useState<string>("Unidad");
  const [supplierId, setSupplierId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Cargar proveedores y ubicaciones cuando el modal se abre
  useEffect(() => {
    if (open) {
      if (suppliers.length === 0) {
        getSuppliers(token);
      }
      if (locations.length === 0) {
        getLocations();
      }
    }
  }, [open, suppliers.length, locations.length, getSuppliers, getLocations, token]);

  // Sincronizar datos del producto al abrir o cambiar data
  useEffect(() => {
    if (data && open) {
      const currentStock = Number(data.stock_quantity ?? data.stock ?? 0);
      const currentPrice = Number(data.price ?? 0);
      const currentMin = Number(data.min_stock ?? 0);

      setAddQuantity("1");
      setDirectStock(String(currentStock));
      setPrice(currentPrice > 0 ? String(currentPrice) : "");
      setMinStock(String(currentMin));
      setUnit(data.unit || "Unidad");
      setSupplierId(data.supplier_id ? String(data.supplier_id) : "");
      setLocationId(data.location_id ? String(data.location_id) : "");
      setReason(ADJUSTMENT_REASONS[0]);
      setCustomReason("");
      setActiveTab("add");
    }
  }, [data, open]);

  if (!data) return null;

  // Valores numéricos seguros
  const currentStock = Number(data.stock_quantity ?? data.stock ?? 0);
  const currentPrice = Number(data.price ?? 0);
  const numAddQty = Math.max(0, parseFloat(addQuantity) || 0);
  const numDirectStock = Math.max(0, parseFloat(directStock) || 0);
  const numPrice = Math.max(0, parseFloat(price) || 0);
  const numMinStock = Math.max(0, parseFloat(minStock) || 0);

  // Cálculo proyectado del nuevo stock según pestaña
  const projectedStock = activeTab === "add" ? currentStock + numAddQty : numDirectStock;
  const stockDifference = projectedStock - currentStock;

  // Subtotal de la inversión del lote agregado
  const addInvestmentTotal = numAddQty * (numPrice > 0 ? numPrice : currentPrice);

  // Valoración total proyectada del inventario en almacén
  const totalValuation = projectedStock * (numPrice > 0 ? numPrice : currentPrice);

  // Estado del stock proyectado
  const projectedStatus = useMemo(() => {
    if (projectedStock <= 0) {
      return {
        label: "Agotado",
        color: "danger" as const,
        bg: "bg-danger-50 dark:bg-danger-950/40 border-danger-200 text-danger-600",
      };
    }
    if (projectedStock <= numMinStock) {
      return {
        label: "Bajo Stock",
        color: "warning" as const,
        bg: "bg-warning-50 dark:bg-warning-950/40 border-warning-200 text-warning-600",
      };
    }
    return {
      label: "Stock Óptimo",
      color: "success" as const,
      bg: "bg-success-50 dark:bg-success-950/40 border-success-200 text-success-600",
    };
  }, [projectedStock, numMinStock]);

  // Envío del formulario
  const handleSubmit = async () => {
    if (activeTab === "add" && numAddQty <= 0) {
      toast.error("Ingresa una cantidad mayor a 0 para sumar al stock");
      return;
    }

    if (activeTab === "adjust" && isNaN(numDirectStock)) {
      toast.error("Ingresa una cantidad válida para el stock disponible");
      return;
    }

    const inventoryId = data.inventory_id || data.id;
    if (!inventoryId) {
      toast.error("No se encontró el identificador del registro de almacén");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalStock = activeTab === "add" ? currentStock + numAddQty : numDirectStock;
      const finalTotalQty =
        activeTab === "add"
          ? (Number(data.quantity) || currentStock) + numAddQty
          : Math.max(Number(data.quantity) || 0, numDirectStock);

      const resolvedReason =
        reason === "Otro ajuste manual" && customReason.trim()
          ? customReason.trim()
          : reason;

      const currentMetadata =
        typeof data.metadata === "object" && data.metadata !== null
          ? data.metadata
          : {};

      const newHistoryEntry = {
        date: new Date().toISOString(),
        mode: activeTab,
        previous_stock: currentStock,
        final_stock: finalStock,
        diff: stockDifference,
        price: numPrice,
        reason: resolvedReason,
      };

      const updatedHistory = Array.isArray(currentMetadata.stock_adjustments)
        ? [newHistoryEntry, ...currentMetadata.stock_adjustments].slice(0, 10)
        : [newHistoryEntry];

      const dataUpdate = {
        product_id: data.product_id || data.id,
        supplier_id: supplierId ? Number(supplierId) : null,
        location_id: locationId ? Number(locationId) : null,
        quantity: finalTotalQty,
        stock_quantity: finalStock,
        price: numPrice,
        unit: unit.trim() || "Unidad",
        min_stock: numMinStock,
        metadata: {
          ...currentMetadata,
          last_stock_adjustment: newHistoryEntry,
          stock_adjustments: updatedHistory,
        },
      };

      const success = await updatePriceQuantity(inventoryId, dataUpdate, token);

      if (success !== false) {
        if (change) change(false);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error("Error al actualizar el stock del producto");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Atajo de teclado Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      size="2xl"
      isOpen={open}
      onClose={onClose}
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
      classNames={{
        base: "border border-default-200/80 bg-background/95 dark:bg-background/90 shadow-2xl rounded-3xl",
        header: "border-b border-default-200/60 pb-3 pt-5 px-6",
        body: "py-5 px-6",
        footer: "border-t border-default-200/60 py-3.5 px-6 bg-default-50/50",
      }}
    >
      <ModalContent>
        {() => (
          <>
            {/* HEADER DEL MODAL */}
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <FaBoxesStacked className="text-xl" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                    Gestión de Stock & Almacén
                  </h2>
                  <p className="text-xs text-default-400 font-normal">
                    Reabastece inventario, ajusta existencias físicas y actualiza costos
                  </p>
                </div>
              </div>
            </ModalHeader>

            {/* CUERPO DEL MODAL */}
            <ModalBody className="gap-5">
              {/* 1. TARJETA DE IDENTIDAD DEL PRODUCTO */}
              <Card className="border border-default-200/80 bg-default-50/70 shadow-none rounded-2xl">
                <CardBody className="p-3 sm:p-4 flex flex-row items-center gap-3.5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-background border border-default-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                    <img
                      src={getImageUrl(data.thumbnail || data.image)}
                      alt={data.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e: any) => {
                        e.target.src =
                          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%23f1f5f9'/><path d='M40 24 L24 33 L40 42 L56 33 Z M24 36 L24 50 L38 58 L38 44 Z M42 44 L42 58 L56 50 L56 36 Z' fill='%2394a3b8'/></svg>";
                      }}
                    />
                  </div>

                  <div className="flex flex-col flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-foreground truncate" title={data.name}>
                      {data.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {data.category && (
                        <Chip
                          size="sm"
                          variant="flat"
                          className="h-5 text-[10px] font-semibold border border-default-200"
                        >
                          <FaLayerGroup className="text-[9px] mr-1" />
                          {getLeafCategoryName(data.category)}
                        </Chip>
                      )}

                      {data.brand && data.brand.toUpperCase() !== "DESCONOCIDO" && (
                        <Chip
                          size="sm"
                          variant="dot"
                          color="secondary"
                          className="h-5 text-[10px] font-semibold border border-default-200"
                        >
                          {data.brand}
                        </Chip>
                      )}

                      {data.sku && (
                        <Chip
                          size="sm"
                          variant="bordered"
                          className="h-5 text-[10px] font-mono text-default-500"
                        >
                          <FaTag className="text-[8px] mr-1" />
                          {data.sku}
                        </Chip>
                      )}

                      {data.barcode && (
                        <Chip
                          size="sm"
                          variant="bordered"
                          className="h-5 text-[10px] font-mono text-default-500 hidden sm:inline-flex"
                        >
                          <FaBarcode className="text-[8px] mr-1" />
                          {data.barcode}
                        </Chip>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-default-500">
                      <span>
                        Costo actual:{" "}
                        <strong className="text-foreground">
                          {currencySymbol} {currentPrice.toFixed(2)}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Unidad: <strong className="text-foreground">{data.unit || "Unidad"}</strong>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* 2. PANEL DE PROYECCIÓN INTERACTIVA DE STOCK */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-default-100/60 border border-default-200/80 items-center text-center">
                {/* Stock Actual */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase text-default-400">
                    Stock Actual
                  </span>
                  <span className="text-base sm:text-xl font-black text-foreground">
                    {currentStock}{" "}
                    <span className="text-[10px] font-normal text-default-400">
                      {data.unit || "unid."}
                    </span>
                  </span>
                </div>

                {/* Variación / Flecha */}
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-1.5">
                    <FaArrowRight className="text-default-400 text-xs sm:text-sm" />
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        stockDifference > 0
                          ? "success"
                          : stockDifference < 0
                          ? "danger"
                          : "default"
                      }
                      className="font-bold text-[10px] sm:text-xs h-6 px-2"
                    >
                      {stockDifference > 0 ? `+${stockDifference}` : stockDifference}
                    </Chip>
                  </div>
                  <span className="text-[9px] text-default-400 mt-0.5 font-medium">
                    {activeTab === "add" ? "A sumar" : "Variación neta"}
                  </span>
                </div>

                {/* Nuevo Stock Proyectado */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase text-primary">
                    Nuevo Stock
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-2xl font-black text-primary">
                      {projectedStock}
                    </span>
                    <span className="text-[10px] font-medium text-default-400">
                      {unit || "unid."}
                    </span>
                  </div>
                  <Chip
                    size="sm"
                    color={projectedStatus.color}
                    variant="dot"
                    className="h-4 text-[9px] font-bold mt-0.5 border-none"
                  >
                    {projectedStatus.label}
                  </Chip>
                </div>
              </div>

              {/* 3. SELECTOR DE MODO: TABS */}
              <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as "add" | "adjust")}
                color="primary"
                variant="bordered"
                fullWidth
                classNames={{
                  tabList: "p-1 border border-default-200 bg-default-50/80 rounded-2xl",
                  cursor: "bg-primary text-primary-foreground shadow-md rounded-xl",
                  tab: "h-9 text-xs sm:text-sm font-bold rounded-xl",
                }}
              >
                <Tab
                  key="add"
                  title={
                    <div className="flex items-center gap-2">
                      <FaPlus className="text-xs" />
                      <span>Sumar al Stock (Reabastecer)</span>
                    </div>
                  }
                />
                <Tab
                  key="adjust"
                  title={
                    <div className="flex items-center gap-2">
                      <FaClipboardList className="text-xs" />
                      <span>Ajuste Directo / Conteo Físico</span>
                    </div>
                  }
                />
              </Tabs>

              {/* 4. FORMULARIO DINÁMICO SEGÚN PESTAÑA */}
              {activeTab === "add" ? (
                /* ==================== MODO 1: SUMAR AL STOCK ==================== */
                <div className="flex flex-col gap-4">
                  {/* Campo de cantidad a sumar con botones rápidos */}
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 flex items-center justify-between">
                      <span>Cantidad de unidades a sumar</span>
                      <span className="text-[11px] font-normal text-default-400">
                        Unidades recibidas en almacén
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Button
                        isIconOnly
                        variant="flat"
                        color="default"
                        className="h-11 w-11 shrink-0 rounded-xl border border-default-200"
                        onPress={() => {
                          const current = parseFloat(addQuantity) || 1;
                          const val = Math.max(0.001, +(current - 1).toFixed(3));
                          setAddQuantity(String(val));
                        }}
                      >
                        <FaMinus className="text-xs" />
                      </Button>

                      <Input
                        type="number"
                        step="any"
                        min="0.001"
                        size="md"
                        variant="bordered"
                        value={addQuantity}
                        onValueChange={(val) => setAddQuantity(val)}
                        onKeyDown={handleKeyDown}
                        classNames={{
                          inputWrapper:
                            "h-11 rounded-xl border-default-200 hover:border-primary focus-within:!border-primary",
                          input: "text-center text-lg font-black",
                        }}
                        endContent={
                          <span className="text-xs text-default-400 font-medium select-none pr-1">
                            {unit || "unidades"}
                          </span>
                        }
                      />

                      <Button
                        isIconOnly
                        variant="flat"
                        color="primary"
                        className="h-11 w-11 shrink-0 rounded-xl border border-primary/20 bg-primary/10 text-primary"
                        onPress={() => {
                          const current = parseFloat(addQuantity) || 0;
                          const val = +(current + 1).toFixed(3);
                          setAddQuantity(String(val));
                        }}
                      >
                        <FaPlus className="text-xs" />
                      </Button>
                    </div>

                    {/* Botones de incremento rápido */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[11px] text-default-400 font-medium mr-1 select-none">
                        Accesos rápidos:
                      </span>
                      {[1, 5, 10, 25, 50, 100].map((step) => (
                        <Button
                          key={step}
                          size="sm"
                          variant="flat"
                          className="h-6 text-[10px] font-bold px-2 min-w-0 rounded-lg bg-default-100 hover:bg-primary/20 hover:text-primary transition-colors"
                          onPress={() => {
                            const current = parseFloat(addQuantity) || 0;
                            setAddQuantity(String(+(current + step).toFixed(3)));
                          }}
                        >
                          +{step}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Costo Unitario de Ingreso */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1.5 flex items-center justify-between">
                        <span>Costo Unitario de Compra</span>
                        <Tooltip content="Precio de costo por unidad con el que ingresará este lote">
                          <span className="text-[11px] text-primary cursor-pointer">
                            ¿Modificar costo?
                          </span>
                        </Tooltip>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        size="md"
                        variant="bordered"
                        value={price}
                        onValueChange={setPrice}
                        onKeyDown={handleKeyDown}
                        startContent={
                          <span className="text-xs font-bold text-default-400 select-none">
                            {currencySymbol}
                          </span>
                        }
                        classNames={{
                          inputWrapper:
                            "h-10 rounded-xl border-default-200 hover:border-primary focus-within:!border-primary",
                          input: "font-semibold text-sm",
                        }}
                      />
                    </div>

                    {/* Subtotal estimado de la inversión */}
                    <div className="flex flex-col justify-end">
                      <div className="p-2.5 rounded-xl bg-default-50 border border-default-200/80 flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-semibold text-default-400">
                          Inversión del nuevo lote
                        </span>
                        <div className="flex items-baseline gap-1 text-sm font-black text-foreground">
                          <PriceDisplay amount={addInvestmentTotal} />
                          <span className="text-[10px] font-normal text-default-400">
                            ({numAddQty} x {currencySymbol} {numPrice.toFixed(2)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ubicación y Proveedor opcional en restock */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Select
                      label="Ubicación en Almacén"
                      placeholder="Seleccionar ubicación..."
                      size="sm"
                      variant="bordered"
                      selectedKeys={locationId ? [locationId] : []}
                      onChange={(e) => setLocationId(e.target.value)}
                      startContent={<FaLocationDot className="text-warning-500 text-xs" />}
                      classNames={{
                        trigger: "rounded-xl border-default-200 h-10",
                      }}
                    >
                      {locations.map((loc: any) => (
                        <SelectItem key={String(loc.id)} textValue={loc.full_path || loc.name}>
                          {loc.full_path || loc.name}
                        </SelectItem>
                      ))}
                    </Select>

                    <Select
                      label="Proveedor"
                      placeholder="Seleccionar proveedor..."
                      size="sm"
                      variant="bordered"
                      selectedKeys={supplierId ? [supplierId] : []}
                      onChange={(e) => setSupplierId(e.target.value)}
                      startContent={<FaTruck className="text-primary text-xs" />}
                      classNames={{
                        trigger: "rounded-xl border-default-200 h-10",
                      }}
                    >
                      {suppliers.map((sup: any) => (
                        <SelectItem key={String(sup.id)} textValue={sup.name}>
                          {sup.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
              ) : (
                /* ==================== MODO 2: AJUSTE DIRECTO / CONTEO FÍSICO ==================== */
                <div className="flex flex-col gap-4">
                  {/* Stock total disponible */}
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 flex items-center justify-between">
                      <span>Stock Físico Real en Almacén</span>
                      <span className="text-[11px] font-normal text-default-400">
                        Cantidad exacta disponible tras conteo
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Button
                        isIconOnly
                        variant="flat"
                        color="default"
                        className="h-11 w-11 shrink-0 rounded-xl border border-default-200"
                        onPress={() => {
                          const current = parseFloat(directStock) || 0;
                          const val = Math.max(0, +(current - 1).toFixed(3));
                          setDirectStock(String(val));
                        }}
                      >
                        <FaMinus className="text-xs" />
                      </Button>

                      <Input
                        type="number"
                        step="any"
                        min="0"
                        size="md"
                        variant="bordered"
                        value={directStock}
                        onValueChange={(val) => setDirectStock(val)}
                        onKeyDown={handleKeyDown}
                        classNames={{
                          inputWrapper:
                            "h-11 rounded-xl border-default-200 hover:border-primary focus-within:!border-primary",
                          input: "text-center text-lg font-black",
                        }}
                        endContent={
                          <span className="text-xs text-default-400 font-medium select-none pr-1">
                            {unit || "unidades"}
                          </span>
                        }
                      />

                      <Button
                        isIconOnly
                        variant="flat"
                        color="primary"
                        className="h-11 w-11 shrink-0 rounded-xl border border-primary/20 bg-primary/10 text-primary"
                        onPress={() => {
                          const current = parseFloat(directStock) || 0;
                          const val = +(current + 1).toFixed(3);
                          setDirectStock(String(val));
                        }}
                      >
                        <FaPlus className="text-xs" />
                      </Button>
                    </div>
                  </div>

                  {/* Costo, Stock Mínimo y Unidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 block">
                        Costo Unitario
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        size="sm"
                        variant="bordered"
                        value={price}
                        onValueChange={setPrice}
                        onKeyDown={handleKeyDown}
                        startContent={
                          <span className="text-xs font-bold text-default-400 select-none">
                            {currencySymbol}
                          </span>
                        }
                        classNames={{
                          inputWrapper: "rounded-xl border-default-200",
                          input: "font-semibold text-xs",
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 flex items-center justify-between">
                        <span>Stock Mínimo</span>
                        <Tooltip content="Alerta amarilla cuando el stock caiga por debajo de este valor">
                          <FaShieldHalved className="text-default-400 text-[10px] cursor-help" />
                        </Tooltip>
                      </label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        size="sm"
                        variant="bordered"
                        value={minStock}
                        onValueChange={setMinStock}
                        onKeyDown={handleKeyDown}
                        classNames={{
                          inputWrapper: "rounded-xl border-default-200",
                          input: "font-semibold text-xs",
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 block">
                        Unidad de Medida
                      </label>
                      <Select
                        placeholder="Unidad..."
                        size="sm"
                        variant="bordered"
                        selectedKeys={unit ? [unit] : ["Unidad"]}
                        onChange={(e) => setUnit(e.target.value)}
                        classNames={{
                          trigger: "rounded-xl border-default-200 h-10",
                        }}
                      >
                        {COMMON_UNITS.map((u) => (
                          <SelectItem key={u} textValue={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {/* Ubicación y Proveedor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Ubicación Física en Almacén"
                      placeholder="Sin ubicación asignada"
                      size="sm"
                      variant="bordered"
                      selectedKeys={locationId ? [locationId] : []}
                      onChange={(e) => setLocationId(e.target.value)}
                      startContent={<FaLocationDot className="text-warning-500 text-xs" />}
                      classNames={{
                        trigger: "rounded-xl border-default-200 h-10",
                      }}
                    >
                      {locations.map((loc: any) => (
                        <SelectItem key={String(loc.id)} textValue={loc.full_path || loc.name}>
                          {loc.full_path || loc.name}
                        </SelectItem>
                      ))}
                    </Select>

                    <Select
                      label="Proveedor Principal"
                      placeholder="Sin proveedor asignado"
                      size="sm"
                      variant="bordered"
                      selectedKeys={supplierId ? [supplierId] : []}
                      onChange={(e) => setSupplierId(e.target.value)}
                      startContent={<FaTruck className="text-primary text-xs" />}
                      classNames={{
                        trigger: "rounded-xl border-default-200 h-10",
                      }}
                    >
                      {suppliers.map((sup: any) => (
                        <SelectItem key={String(sup.id)} textValue={sup.name}>
                          {sup.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  {/* Motivo del Ajuste */}
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1 block">
                      Motivo del Ajuste de Inventario
                    </label>
                    <Select
                      size="sm"
                      variant="bordered"
                      selectedKeys={[reason]}
                      onChange={(e) => setReason(e.target.value)}
                      classNames={{
                        trigger: "rounded-xl border-default-200 h-10",
                      }}
                    >
                      {ADJUSTMENT_REASONS.map((r) => (
                        <SelectItem key={r} textValue={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </Select>

                    {reason === "Otro ajuste manual" && (
                      <Input
                        size="sm"
                        variant="bordered"
                        placeholder="Especifica el motivo del ajuste..."
                        value={customReason}
                        onValueChange={setCustomReason}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 5. RESUMEN DE VALORACIÓN TOTAL */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary/20 text-xs">
                <div className="flex items-center gap-2">
                  <FaDollarSign className="text-primary text-sm" />
                  <span className="text-default-600 font-medium">
                    Valor total de este producto en almacén:
                  </span>
                </div>
                <div className="text-sm font-black text-primary">
                  <PriceDisplay amount={totalValuation} />
                </div>
              </div>
            </ModalBody>

            {/* FOOTER DEL MODAL */}
            <ModalFooter className="flex items-center justify-between gap-2">
              <Button
                variant="flat"
                color="default"
                size="md"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="font-semibold text-xs px-4 rounded-xl"
              >
                Cancelar
              </Button>

              <Button
                color="primary"
                variant="solid"
                size="md"
                isLoading={isSubmitting}
                startContent={!isSubmitting && <FaCheck className="text-sm" />}
                onPress={handleSubmit}
                className="font-bold text-xs px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"
              >
                {activeTab === "add"
                  ? `Confirmar Ingreso (+${numAddQty} ${unit || "unid."})`
                  : `Guardar Ajuste (${projectedStock} ${unit || "unid."})`}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
export default ModalAddStock;
