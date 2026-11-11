import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Tabs,
  Tab,
  Image,
} from "@nextui-org/react";
import {
  FaArrowLeft,
  FaWarehouse,
  FaStore,
  FaBoxesStacked,
  FaCoins,
  FaLocationDot,
  FaPlus,
  FaRotate,
  FaCopy,
  FaCheck,
  FaBarcode,
  FaTag,
  FaTriangleExclamation,
  FaImages,
  FaBuilding,
} from "react-icons/fa6";
import { toast } from "sonner";
import { DynamicBreadcrumbs, PriceDisplay, CompactNumber } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useProductsStore } from "@/modules/tenant/products/store/products/products.store";
import { getImageUrl } from "@/utils/image";
import { ModalAddStock } from "./modal-add-stock";

export const KardexProductWarehouse: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const getProductBySlug = useProductsStore((state) => state.getProductBySlug);

  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [productImages, setProductImages] = useState<any[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [storeStock, setStoreStock] = useState<any[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal para agregar / ajustar stock de almacén
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [selectedWarehouseRow, setSelectedWarehouseRow] = useState<any>(null);

  // Carga de datos del producto y sus inventarios
  const loadProductData = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    try {
      const data = await getProductBySlug(slug, token || undefined);
      if (data) {
        setProduct(data.product || null);
        setProductImages(data.productImages || []);
        setWarehouseStock(data.productInventoryWarehouse || []);
        setStoreStock(data.productInventoryStore || []);
      } else {
        setProduct(null);
      }
    } catch (err) {
      console.error("Error al cargar Kardex de almacén:", err);
      toast.error("No se pudo cargar la información del producto");
    } finally {
      setIsLoading(false);
    }
  }, [slug, token, getProductBySlug]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  // Copiar al portapapeles
  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copiado: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // KPIs y Estadísticas consolidadas
  const stats = useMemo(() => {
    const totalWarehouse = warehouseStock.reduce(
      (sum, item) => sum + (Number(item.stock_quantity) || 0),
      0
    );
    const totalWarehouseValuation = warehouseStock.reduce(
      (sum, item) => sum + (Number(item.stock_quantity) || 0) * (Number(item.price) || 0),
      0
    );
    const totalStores = storeStock.reduce(
      (sum, item) => sum + (Number(item.stock_quantity) || 0),
      0
    );
    const totalGlobal = totalWarehouse + totalStores;

    const minStock = Number(product?.min_stock) || 0;
    const isOutOfStock = totalWarehouse <= 0;
    const isLowStock = !isOutOfStock && totalWarehouse <= minStock;

    return {
      totalWarehouse,
      totalWarehouseValuation,
      totalStores,
      totalGlobal,
      isOutOfStock,
      isLowStock,
      unit: warehouseStock[0]?.unit || product?.unit || "Unidad",
    };
  }, [warehouseStock, storeStock, product]);

  // Manejador para abrir modal de agregar stock
  const handleOpenAddStock = (warehouseItem?: any) => {
    const wh = warehouseItem || warehouseStock[0];
    if (wh) {
      setSelectedWarehouseRow({
        inventory_id: wh.id || wh.inventory_id,
        id: product?.id,
        product_id: product?.id,
        name: product?.name,
        thumbnail: product?.thumbnail || product?.image,
        sku: product?.sku,
        barcode: product?.barcode,
        brand: product?.brand?.name || product?.brand,
        category: product?.category?.name || product?.category,
        supplier_id: wh.supplier_id || null,
        supplier: wh.supplier?.name || wh.supplier || "",
        location_id: wh.location_id || null,
        location: wh.location?.name || wh.location || "",
        price: wh.price || 0,
        stock_quantity: wh.stock_quantity || 0,
        quantity: wh.quantity || 0,
        unit: wh.unit || product?.unit || "Unidad",
        min_stock: wh.min_stock || product?.min_stock || 0,
      });
    }
    setIsAddStockOpen(true);
  };

  if (isLoading) {
    return (
      <div className="my-6 px-4 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Spinner size="lg" color="primary" />
        <p className="text-sm text-default-400 font-medium animate-pulse">
          Cargando Kardex de Almacén...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="my-6 px-4 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 rounded-3xl bg-danger/10 text-danger-500">
          <FaTriangleExclamation className="text-4xl" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Producto no encontrado</h2>
        <p className="text-sm text-default-400 text-center max-w-md">
          El producto solicitado con el slug <b>"{slug}"</b> no existe o no tiene registros en el almacén.
        </p>
        <Button
          color="primary"
          variant="flat"
          startContent={<FaArrowLeft />}
          onPress={() => navigate("/inventories")}
        >
          Volver al Inventario
        </Button>
      </div>
    );
  }

  return (
    <div className="my-2 px-3 sm:px-6 lg:px-8 max-w-[98rem] mx-auto w-full flex flex-col gap-5 animate-in fade-in duration-300">
      <DynamicBreadcrumbs title={product?.name ? `Kardex: ${product.name}` : "Kardex de Producto"} />

      {/* 1. BARRA SUPERIOR DE CABECERA Y NAVEGACIÓN */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-background/80 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-default-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Tooltip content="Volver a Productos en Almacén">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              color="default"
              className="h-9 w-9 border border-default-200"
              onPress={() => navigate("/inventories")}
            >
              <FaArrowLeft className="text-sm" />
            </Button>
          </Tooltip>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold text-foreground tracking-tight">
                Kardex de Almacén
              </h1>
              <Chip
                size="sm"
                variant="flat"
                color={
                  stats.isOutOfStock
                    ? "danger"
                    : stats.isLowStock
                      ? "warning"
                      : "success"
                }
                className="font-bold text-[10px] h-5"
              >
                {stats.isOutOfStock
                  ? "AGOTADO EN BODEGA"
                  : stats.isLowStock
                    ? "STOCK BAJO"
                    : "DISPONIBLE"}
              </Chip>
            </div>
            <p className="text-xs text-default-400 line-clamp-1">
              Control de existencias, ubicaciones físicas, costo de compra y transferencias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <Tooltip content="Recargar datos de Kardex">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              color="default"
              className="h-9 w-9 border border-default-200"
              onPress={loadProductData}
            >
              <FaRotate className={isLoading ? "animate-spin" : "text-sm"} />
            </Button>
          </Tooltip>

          <Button
            size="sm"
            color="primary"
            variant="shadow"
            startContent={<FaPlus className="text-xs" />}
            onPress={() => handleOpenAddStock()}
            className="font-bold text-xs h-9 shadow-primary/25"
          >
            Agregar Stock
          </Button>
        </div>
      </div>

      {/* 2. CARD PRINCIPAL: IDENTIDAD DEL PRODUCTO */}
      <Card className="border border-default-200/80 shadow-sm bg-background/60">
        <CardBody className="p-4 sm:p-5 flex flex-col md:flex-row items-center md:items-start gap-5">
          {/* Imagen Principal */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-default-100 border border-default-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
            <img
              src={
                getImageUrl(product.thumbnail || product.image) ||
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='120' height='120' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='%2394a3b8'>SIN FOTO</text></svg>"
              }
              alt={product.name}
              className="w-full h-full object-cover rounded-xl"
              onError={(e: any) => {
                e.target.src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='120' height='120' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='%2394a3b8'>SIN FOTO</text></svg>";
              }}
            />
          </div>

          {/* Información Detallada del Producto */}
          <div className="flex flex-col gap-2.5 flex-1 min-w-0 text-center md:text-left">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-xs sm:text-sm text-default-500 line-clamp-3">
                  {product.description}
                </p>
              )}
            </div>

            {/* Badges y Chips de Clasificación */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              {product.category && (
                <Chip
                  size="sm"
                  variant="flat"
                  className="h-6 text-xs font-semibold"
                  style={{
                    borderColor: product.color || "#6366f1",
                    color: product.color || "#6366f1",
                  }}
                >
                  {product.category_path || product.category}
                </Chip>
              )}

              {product.brand && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="secondary"
                  startContent={<FaTag className="text-[10px] ml-1 mr-0.5" />}
                  className="h-6 text-xs font-semibold"
                >
                  {product.brand}
                </Chip>
              )}

              {/* SKU con Botón de Copiar */}
              {product.sku && (
                <div className="flex items-center gap-1 bg-default-100 px-2.5 py-1 rounded-lg border border-default-200 text-xs">
                  <span className="text-default-400 font-medium">SKU:</span>
                  <span className="font-mono font-bold text-foreground">{product.sku}</span>
                  <Tooltip content={copiedField === "sku" ? "¡Copiado!" : "Copiar SKU"}>
                    <button
                      onClick={() => handleCopy(product.sku, "sku")}
                      className="ml-1 text-default-400 hover:text-primary transition-colors cursor-pointer"
                    >
                      {copiedField === "sku" ? (
                        <FaCheck className="text-success-500 text-[11px]" />
                      ) : (
                        <FaCopy className="text-[11px]" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* Código de Barras con Botón de Copiar */}
              {product.barcode && (
                <div className="flex items-center gap-1 bg-default-100 px-2.5 py-1 rounded-lg border border-default-200 text-xs">
                  <FaBarcode className="text-default-400 text-xs" />
                  <span className="font-mono font-bold text-foreground">{product.barcode}</span>
                  <Tooltip content={copiedField === "barcode" ? "¡Copiado!" : "Copiar Código"}>
                    <button
                      onClick={() => handleCopy(product.barcode, "barcode")}
                      className="ml-1 text-default-400 hover:text-primary transition-colors cursor-pointer"
                    >
                      {copiedField === "barcode" ? (
                        <FaCheck className="text-success-500 text-[11px]" />
                      ) : (
                        <FaCopy className="text-[11px]" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 3. KPIS DE INVENTARIO BENTO CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Stock en Almacén */}
        <Card className="border border-default-200/80 bg-background/60 shadow-sm">
          <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                Almacén Central
              </span>
              <span className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                <CompactNumber value={stats.totalWarehouse} suffix={` ${stats.unit}`} />
              </span>
              <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                {warehouseStock.length} ubicación(es)
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
              <FaWarehouse className="text-xl sm:text-2xl" />
            </div>
          </CardBody>
        </Card>

        {/* Card 2: Valoración Inversión en Almacén */}
        <Card className="border border-default-200/80 bg-background/60 shadow-sm">
          <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                Inversión Almacén
              </span>
              <span className="text-xl sm:text-2xl font-black text-warning-600 dark:text-warning-500 mt-0.5">
                <PriceDisplay amount={stats.totalWarehouseValuation} compact />
              </span>
              <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                Valoración a costo compra
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-warning/10 text-warning-600 dark:text-warning-500 shrink-0">
              <FaCoins className="text-xl sm:text-2xl" />
            </div>
          </CardBody>
        </Card>

        {/* Card 3: Stock en Tiendas Distribuidas */}
        <Card className="border border-default-200/80 bg-background/60 shadow-sm">
          <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                En Sucursales
              </span>
              <span className="text-xl sm:text-2xl font-black text-success-600 dark:text-success-400 mt-0.5">
                <CompactNumber value={stats.totalStores} suffix={` ${stats.unit}`} />
              </span>
              <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                En {storeStock.length} tienda(s)
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-success/10 text-success-600 dark:text-success-400 shrink-0">
              <FaStore className="text-xl sm:text-2xl" />
            </div>
          </CardBody>
        </Card>

        {/* Card 4: Stock Total Global */}
        <Card className="border border-default-200/80 bg-background/60 shadow-sm">
          <CardBody className="p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-default-500 uppercase tracking-wider truncate">
                Stock Total Global
              </span>
              <span className="text-xl sm:text-2xl font-black text-secondary-600 dark:text-secondary-400 mt-0.5">
                <CompactNumber value={stats.totalGlobal} suffix={` ${stats.unit}`} />
              </span>
              <span className="text-[10px] sm:text-[11px] text-default-400 mt-1 truncate">
                Almacén + Sucursales
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-secondary/10 text-secondary-600 dark:text-secondary-400 shrink-0">
              <FaBoxesStacked className="text-xl sm:text-2xl" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 4. SECCIÓN DE PESTAÑAS: ALMACÉN, SUCURSALES Y GALERÍA */}
      <Card className="border border-default-200/80 shadow-sm overflow-hidden bg-background">
        <Tabs
          aria-label="Kardex de existencias"
          color="primary"
          variant="underlined"
          classNames={{
            tabList: "gap-6 px-4 pt-2 border-b border-default-200",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-1 h-11 text-xs sm:text-sm font-bold",
            tabContent: "group-data-[selected=true]:text-primary",
          }}
        >
          {/* Pestaña 1: Almacén Central */}
          <Tab
            key="warehouse"
            title={
              <div className="flex items-center gap-2">
                <FaWarehouse />
                <span>Almacén Central ({warehouseStock.length})</span>
              </div>
            }
          >
            <div className="p-4 flex flex-col gap-4">
              {warehouseStock.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
                  <div className="p-4 rounded-3xl bg-default-100 text-default-400">
                    <FaWarehouse size={32} />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Sin registros de stock en almacén central
                  </p>
                  <p className="text-xs text-default-400 max-w-sm">
                    Este producto aún no cuenta con unidades físicas ingresadas en la bodega central.
                  </p>
                  <Button
                    size="sm"
                    color="primary"
                    variant="solid"
                    startContent={<FaPlus />}
                    onPress={() => handleOpenAddStock()}
                    className="font-bold text-xs"
                  >
                    Ingresar Primer Stock
                  </Button>
                </div>
              ) : (
                <Table aria-label="Tabla de inventario de almacén" removeWrapper>
                  <TableHeader>
                    <TableColumn>UBICACIÓN EN BODEGA</TableColumn>
                    <TableColumn align="center">STOCK FÍSICO</TableColumn>
                    <TableColumn align="center">COSTO UNITARIO</TableColumn>
                    <TableColumn align="center">SUBTOTAL INVERSIÓN</TableColumn>
                    <TableColumn align="center">UNIDAD</TableColumn>
                    <TableColumn align="end">ACCIONES</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {warehouseStock.map((wh, idx) => {
                      const rowTotal = (Number(wh.stock_quantity) || 0) * (Number(wh.price) || 0);
                      return (
                        <TableRow key={wh.id || idx} className="border-b border-default-100 last:border-none hover:bg-default-50/60">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-warning-500/10 text-warning-600">
                                <FaLocationDot size={14} />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs sm:text-sm text-foreground">
                                  {wh.location_path || wh.location_name || wh.location || "Área General"}
                                </span>
                                {wh.supplier && wh.supplier !== "Sin proveedor" && (
                                  <span className="text-[10px] text-default-400 flex items-center gap-1">
                                    <FaBuilding size={9} /> {wh.supplier}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell align="center">
                            <span
                              className={`font-black text-sm sm:text-base ${Number(wh.stock_quantity) <= 0
                                ? "text-danger-500"
                                : "text-foreground"
                                }`}
                            >
                              <CompactNumber value={wh.stock_quantity} />
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <span className="font-bold text-xs sm:text-sm text-foreground">
                              <PriceDisplay amount={wh.price} compact />
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <span className="font-black text-xs sm:text-sm text-primary">
                              <PriceDisplay amount={rowTotal} compact />
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <Chip size="sm" variant="flat" className="h-5 text-[10px] font-semibold">
                              {wh.unit || stats.unit}
                            </Chip>
                          </TableCell>

                          <TableCell align="right">
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              startContent={<FaPlus size={11} />}
                              onPress={() => handleOpenAddStock(wh)}
                              className="font-semibold text-xs h-8"
                            >
                              Ajustar Stock
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Tab>

          {/* Pestaña 2: Sucursales / Tiendas Distribuidas */}
          <Tab
            key="stores"
            title={
              <div className="flex items-center gap-2">
                <FaStore />
                <span>Sucursales ({storeStock.length})</span>
              </div>
            }
          >
            <div className="p-4 flex flex-col gap-4">
              {storeStock.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2 text-default-400">
                  <div className="p-4 rounded-3xl bg-default-100 text-default-400">
                    <FaStore size={32} />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Sin distribución en sucursales
                  </p>
                  <p className="text-xs text-default-400 max-w-sm">
                    Este producto aún no ha sido despachado ni asignado a ninguna tienda física.
                  </p>
                </div>
              ) : (
                <Table aria-label="Tabla de inventario en tiendas" removeWrapper>
                  <TableHeader>
                    <TableColumn>SUCURSAL / TIENDA</TableColumn>
                    <TableColumn align="center">STOCK EN TIENDA</TableColumn>
                    <TableColumn align="center">PRECIO PÚBLICO</TableColumn>
                    <TableColumn align="center">UBICACIÓN EN TIENDA</TableColumn>
                    <TableColumn align="center">VALOR VENTA PROYECTADO</TableColumn>
                    <TableColumn align="center">ESTADO</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {storeStock.map((st, idx) => {
                      const isOutOfStock = Number(st.stock_quantity) <= 0;
                      const storeRowValue =
                        (Number(st.stock_quantity) || 0) * (Number(st.price) || 0);

                      return (
                        <TableRow key={st.id || idx} className="border-b border-default-100 last:border-none hover:bg-default-50/60">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-success-500/10 text-success-600">
                                <FaStore size={14} />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs sm:text-sm text-foreground">
                                  {st.store_name || st.store || "Sucursal"}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell align="center">
                            <span
                              className={`font-black text-sm ${isOutOfStock ? "text-danger-500" : "text-foreground"
                                }`}
                            >
                              <CompactNumber value={st.stock_quantity} suffix={` ${stats.unit}`} />
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <span className="font-bold text-xs sm:text-sm text-foreground">
                              <PriceDisplay amount={st.price} compact />
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <span className="text-xs text-default-500">
                              {st.location_path || st.location_name || st.location || "Mostrador"}
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <span className="font-black text-xs sm:text-sm text-success-600 dark:text-success-400">
                              <PriceDisplay amount={storeRowValue} compact />
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <Chip
                              size="sm"
                              variant="flat"
                              color={isOutOfStock ? "danger" : "success"}
                              className="h-5 text-[10px] font-bold"
                            >
                              {isOutOfStock ? "Agotado" : "Disponible"}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Tab>

          {/* Pestaña 3: Galería de Fotos */}
          {productImages.length > 0 && (
            <Tab
              key="gallery"
              title={
                <div className="flex items-center gap-2">
                  <FaImages />
                  <span>Galería ({productImages.length})</span>
                </div>
              }
            >
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {productImages.map((imgItem: any, idx: number) => {
                  const url = getImageUrl(imgItem.image);
                  return (
                    <div
                      key={imgItem.id || idx}
                      className="group relative rounded-2xl overflow-hidden border border-default-200 aspect-square bg-default-100 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <Image
                        src={url || ""}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        removeWrapper
                      />
                    </div>
                  );
                })}
              </div>
            </Tab>
          )}
        </Tabs>
      </Card>

      {/* MODAL PARA AGREGAR O AJUSTAR STOCK EN BODEGA */}
      {selectedWarehouseRow && (
        <ModalAddStock
          open={isAddStockOpen}
          onClose={() => {
            setIsAddStockOpen(false);
            setSelectedWarehouseRow(null);
          }}
          data={selectedWarehouseRow}
          change={() => {
            loadProductData();
          }}
          token={token || ""}
        />
      )}
    </div>
  );
};
export default KardexProductWarehouse;
