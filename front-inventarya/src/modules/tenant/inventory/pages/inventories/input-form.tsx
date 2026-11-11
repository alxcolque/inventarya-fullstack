import React, { useEffect, useState, useMemo } from "react";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  Chip,
  Spinner,
} from "@nextui-org/react";
import { DynamicBreadcrumbs } from "@/components/ui/dynamic-breadcrumbs";
import {
  useProductsStore,
  useSupplierStore,
  useLocationsStore,
  useWarehouseStore,
  useCurrencyStore,
  useTenantAuthStore,
} from "@/stores";
import { useNavigate } from "react-router-dom";
import {
  FaCartPlus,
  FaSearch,
  FaTimes,
  FaCheck,
  FaBoxOpen,
  FaMapMarkerAlt,
  FaTruck,
  FaChevronDown,
  FaChevronUp,
  FaArrowLeft,
} from "react-icons/fa";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/image";

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

export const InputForm = () => {
  const navigate = useNavigate();
  const token = useTenantAuthStore((s) => s.token);
  const products = useProductsStore((s) => s.products);
  const getProducts = useProductsStore((s) => s.getProducts);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const getSuppliers = useSupplierStore((s) => s.getSuppliers);
  const locations = useLocationsStore((s) => s.locations);
  const getLocations = useLocationsStore((s) => s.getLocations);
  const addWarehouseProduct = useWarehouseStore((s) => s.addWarehouseProduct);
  const registeredProductIds = useWarehouseStore((s) => s.registeredProductIds);
  const getRegisteredProductIds = useWarehouseStore((s) => s.getRegisteredProductIds);
  const currencySymbol = useCurrencyStore((s) => s.symbol);

  // Form states
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [price, setPrice] = useState<string>("");
  const [unit, setUnit] = useState<string>("Unidad");
  const [quantity, setQuantity] = useState<string>("1");
  const [supplierId, setSupplierId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [minStock, setMinStock] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    setIsLoadingData(true);
    Promise.all([
      getProducts(token || undefined),
      getSuppliers(token || undefined),
      getLocations(),
      getRegisteredProductIds(),
    ]).finally(() => {
      setIsLoadingData(false);
    });
  }, [token]);

  // Set de IDs ya registrados para exclusión
  const registeredIdsSet = useMemo(() => {
    return new Set(registeredProductIds.map((id) => String(id)));
  }, [registeredProductIds]);

  // Productos disponibles para compra (excluye los ya existentes en almacén)
  const availableProducts = useMemo(() => {
    return products.filter((p) => !registeredIdsSet.has(String(p.id)));
  }, [products, registeredIdsSet]);

  // Búsqueda rápida
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) {
      return availableProducts.slice(0, 15);
    }
    const term = productSearch.toLowerCase().trim();
    return availableProducts.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const brand = (p.brand || "").toLowerCase();
      const category = (p.category_path || p.category || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      return (
        name.includes(term) ||
        brand.includes(term) ||
        category.includes(term) ||
        sku.includes(term) ||
        barcode.includes(term)
      );
    });
  }, [availableProducts, productSearch]);

  // Total calculado
  const calculatedTotal = useMemo(() => {
    const p = parseFloat(price) || 0;
    const q = parseFloat(quantity) || 0;
    return p * q;
  }, [price, quantity]);

  const handleRegisterInput = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedProduct) {
      toast.error("Por favor, selecciona un producto para registrar la compra.");
      return;
    }

    const numericPrice = parseFloat(price);
    const safePrice = isNaN(numericPrice) || numericPrice < 0 ? 0 : numericPrice;

    const parsedQty = parseFloat(quantity);
    const safeQuantity = isNaN(parsedQty) || parsedQty <= 0 ? 1 : parsedQty;

    const payload = {
      product_id: String(selectedProduct.id),
      price: safePrice,
      quantity: safeQuantity,
      unit: unit.trim() || "Unidad",
      stock_quantity: safeQuantity,
      supplier_id: supplierId ? Number(supplierId) : null,
      location_id: locationId ? Number(locationId) : null,
      min_stock: minStock ? parseFloat(minStock) : 0,
      metadata: notes.trim() ? { notes: notes.trim() } : null,
    };

    setIsLoading(true);
    const success = await addWarehouseProduct(payload, token || undefined);
    setIsLoading(false);

    if (success) {
      navigate("/inventories");
    }
  };

  return (
    <div className="my-2 px-4 lg:px-6 max-w-[80rem] mx-auto w-full flex flex-col gap-4">
      <DynamicBreadcrumbs title="Entrada de Inventario" />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={() => navigate("/inventories")}
            title="Volver a inventarios"
          >
            <FaArrowLeft />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FaCartPlus className="text-primary" />
              <span>Registrar Compra</span>
            </h2>
            <p className="text-xs text-default-500">
              Registra compras o existencias iniciales con precio de compra para el almacén.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleRegisterInput} className="flex flex-col gap-5 max-w-3xl">
        {isLoadingData && (
          <div className="flex items-center gap-2 text-default-500 text-sm">
            <Spinner size="sm" />
            <span>Cargando catálogo...</span>
          </div>
        )}

        {/* 1. SELECCIÓN DE PRODUCTO */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FaBoxOpen className="text-primary" />
              <span>Producto <span className="text-danger">*</span></span>
            </label>
            <span className="text-xs text-default-400">
              {availableProducts.length} productos disponibles
            </span>
          </div>

          {!selectedProduct ? (
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Buscar producto por nombre, marca, categoría o SKU..."
                value={productSearch}
                onValueChange={setProductSearch}
                startContent={<FaSearch className="text-default-400 text-sm" />}
                isClearable
                onClear={() => setProductSearch("")}
                size="sm"
                variant="bordered"
              />

              <div className="max-h-56 overflow-y-auto border border-default-200 dark:border-default-100 rounded-xl p-1 bg-default-50/50 flex flex-col gap-1">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-default-400 text-sm">
                    {availableProducts.length === 0
                      ? "Todos los productos ya se encuentran registrados en el almacén."
                      : "No se encontraron productos coincidentes."}
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            p.thumbnail
                              ? getImageUrl(p.thumbnail)
                              : "/placeholder.png"
                          }
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-md border border-default-200 flex-shrink-0"
                          onError={(e: any) => {
                            e.target.src =
                              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23e2e8f0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='10' fill='%2394a3b8'>IMG</text></svg>";
                          }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-default-500">
                            <span>{p.category_path || p.category}</span>
                            {p.brand && (
                              <span className="text-primary-600 font-medium">
                                • {p.brand}
                              </span>
                            )}
                            {p.sku && (
                              <span className="text-default-400 font-mono text-[11px]">
                                SKU: {p.sku}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        className="h-8 text-xs font-semibold shrink-0"
                      >
                        Seleccionar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Card className="border border-primary-200 bg-primary-50/20 dark:bg-primary-950/20 shadow-none">
              <CardBody className="p-3 flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={
                      selectedProduct.thumbnail
                        ? getImageUrl(selectedProduct.thumbnail)
                        : "/placeholder.png"
                    }
                    alt={selectedProduct.name}
                    className="w-12 h-12 object-cover rounded-lg border border-primary/30 flex-shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-bold text-foreground truncate">
                      {selectedProduct.name}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-[11px]">
                        {selectedProduct.category_path || selectedProduct.category}
                      </Chip>
                      {selectedProduct.brand && (
                        <Chip size="sm" variant="flat" color="secondary" className="h-5 text-[11px]">
                          {selectedProduct.brand}
                        </Chip>
                      )}
                      {selectedProduct.sku && (
                        <span className="text-default-500 font-mono text-xs">
                          SKU: {selectedProduct.sku}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  isIconOnly
                  onPress={() => setSelectedProduct(null)}
                  title="Cambiar producto"
                >
                  <FaTimes />
                </Button>
              </CardBody>
            </Card>
          )}
        </div>

        {/* 2. CAMPOS DE COMPRA: PRECIO, UNIDAD, CANTIDAD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Precio de Compra"
            placeholder="0.00"
            type="number"
            step="any"
            min="0"
            isRequired
            size="sm"
            variant="bordered"
            value={price}
            onValueChange={setPrice}
            startContent={
              <span className="text-default-500 font-bold text-sm">
                {currencySymbol || "$"}
              </span>
            }
            description="Costo unitario de compra"
          />

          <div className="flex flex-col">
            <Input
              label="Unidad de Medida"
              placeholder="Escribe o selecciona..."
              list="input-form-unit-datalist"
              size="sm"
              variant="bordered"
              value={unit}
              onValueChange={setUnit}
              isRequired
              description="Por defecto: Unidad"
            />
            <datalist id="input-form-unit-datalist">
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <Input
            label="Cantidad Comprada"
            placeholder="1"
            type="number"
            min="0.001"
            step="any"
            isRequired
            size="sm"
            variant="bordered"
            value={quantity}
            onValueChange={setQuantity}
            description="Cantidad que ingresa a almacén"
          />
        </div>

        {/* Resumen Total */}
        <div className="flex justify-between items-center p-3 rounded-xl bg-default-100 dark:bg-default-50/50 border border-default-200">
          <span className="text-xs font-semibold text-default-600">
            Inversión Total de la Compra:
          </span>
          <span className="text-base font-bold text-success-600 dark:text-success-400">
            <PriceDisplay amount={calculatedTotal} />
          </span>
        </div>

        {/* 3. CAMPOS OPCIONALES */}
        <div className="flex flex-col border border-default-200 dark:border-default-100 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="flex justify-between items-center w-full px-4 py-2.5 bg-default-50 hover:bg-default-100 transition-colors text-xs font-semibold text-default-700"
          >
            <span className="flex items-center gap-1.5">
              <span>Datos Adicionales (Opcionales)</span>
              {(supplierId || locationId || (minStock && minStock !== "0") || notes) && (
                <Chip size="sm" color="primary" variant="flat" className="h-4 text-[10px]">
                  Completados
                </Chip>
              )}
            </span>
            {showOptionalFields ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          {showOptionalFields && (
            <div className="p-3 bg-background flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Proveedor (Opcional)"
                  placeholder="Selecciona proveedor..."
                  size="sm"
                  variant="bordered"
                  selectedKeys={supplierId ? [supplierId] : []}
                  onChange={(e) => setSupplierId(e.target.value)}
                  startContent={<FaTruck className="text-default-400 text-xs" />}
                >
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  label="Ubicación Física (Opcional)"
                  placeholder="Selecciona ubicación..."
                  size="sm"
                  variant="bordered"
                  selectedKeys={locationId ? [locationId] : []}
                  onChange={(e) => setLocationId(e.target.value)}
                  startContent={<FaMapMarkerAlt className="text-default-400 text-xs" />}
                >
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.full_path || loc.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Stock Mínimo de Alerta (Opcional)"
                  placeholder="0"
                  type="number"
                  min="0"
                  step="any"
                  size="sm"
                  variant="bordered"
                  value={minStock}
                  onValueChange={setMinStock}
                  description="Alerta cuando el stock caiga a esta cifra"
                />

                <Input
                  label="Notas / Nro. Factura (Opcional)"
                  placeholder="Ej. Factura #45892 o Proveedor Central"
                  size="sm"
                  variant="bordered"
                  value={notes}
                  onValueChange={setNotes}
                  description="Detalle o referencia de la compra"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 items-center">
          <Button
            type="submit"
            color="primary"
            variant="shadow"
            isLoading={isLoading}
            isDisabled={!selectedProduct || !price || isLoading}
            startContent={!isLoading ? <FaCheck /> : undefined}
            className="font-semibold"
          >
            Registrar Compra
          </Button>
          <Button
            type="button"
            variant="flat"
            onPress={() => navigate("/inventories")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
};
