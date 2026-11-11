import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Image,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react";
import { FaArrowLeft, FaBox, FaStore, FaWarehouse, FaMapMarkerAlt } from "react-icons/fa";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useProductsStore } from "@/modules/tenant/products/store/products/products.store";
import { getImageUrl } from "@/utils/image";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getLeafCategoryName } from "../../utils/category";

export const KardexProduct = () => {
  const navigate = useNavigate();
  const { slug, productSlug } = useParams();
  const token = useTenantAuthStore((state) => state.token);
  const getProductBySlug = useProductsStore((state) => state.getProductBySlug);

  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [storeStock, setStoreStock] = useState<any[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      const targetSlug = productSlug || slug;
      if (targetSlug && token) {
        setIsLoading(true);
        const data = await getProductBySlug(targetSlug, token);
        if (data) {
          setProduct(data.product || null);
          setWarehouseStock(data.productInventoryWarehouse || []);
          setStoreStock(data.productInventoryStore || []);
        }
        setIsLoading(false);
      }
    };
    fetchProduct();
  }, [productSlug, slug, token]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Spinner size="lg" color="primary" />
        <p className="text-default-400 text-sm">Cargando información de inventario...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Botón Atrás y Título */}
      <div className="flex items-center justify-between border-b border-default-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="flat"
            color="default"
            isIconOnly
            startContent={<FaArrowLeft />}
            onPress={() => navigate(-1)}
          />
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Control de Stock: {product?.name || "Producto"}
            </h1>
            <p className="text-xs text-default-400">
              Disponibilidad en almacén central y sucursales distribuidas
            </p>
          </div>
        </div>

        {product?.category && (
          <Chip size="sm" variant="flat" color="primary" className="font-semibold">
            {getLeafCategoryName(product.category_path || product.category)}
          </Chip>
        )}
      </div>

      {/* Tarjeta de Resumen del Producto */}
      {product && (
        <Card className="border border-default-200 shadow-sm bg-default-50/50">
          <CardBody className="p-5 flex flex-col sm:flex-row items-center gap-5">
            <Image
              alt={product.name}
              src={getImageUrl(product.thumbnail) || "/favicon.ico"}
              fallbackSrc="/favicon.ico"
              width={100}
              height={100}
              className="object-cover rounded-xl border border-default-200"
            />
            <div className="flex flex-col gap-1 w-full text-center sm:text-left">
              <h2 className="text-xl font-bold text-foreground">{product.name}</h2>
              {product.description && (
                <p className="text-xs text-default-500 line-clamp-2">{product.description}</p>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-xs">
                {product.brand && (
                  <span className="text-default-600">
                    Marca: <b>{product.brand}</b>
                  </span>
                )}
                {product.sku && (
                  <span className="text-default-600">
                    SKU: <b className="font-mono">{product.sku}</b>
                  </span>
                )}
                {product.barcode && (
                  <span className="text-default-600">
                    Código: <b className="font-mono">{product.barcode}</b>
                  </span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tablas de Existencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Existencias en Almacén Central */}
        <Card className="border border-default-200 shadow-sm">
          <CardBody className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary font-bold text-base">
              <FaWarehouse />
              <h3>Stock en Almacén Central</h3>
            </div>
            <Divider />

            {warehouseStock.length === 0 ? (
              <p className="text-default-400 text-xs py-4 text-center">
                Sin registros de entrada en almacén central.
              </p>
            ) : (
              <Table aria-label="Stock en bodega" removeWrapper>
                <TableHeader>
                  <TableColumn>UBICACIÓN</TableColumn>
                  <TableColumn align="center">STOCK</TableColumn>
                  <TableColumn align="center">PRECIO</TableColumn>
                  <TableColumn align="center">UNIDAD</TableColumn>
                </TableHeader>
                <TableBody>
                  {warehouseStock.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-default-100 last:border-none">
                      <TableCell className="text-xs">
                        {item.location ? (
                          <span className="flex items-center gap-1 text-warning-600 font-medium">
                            <FaMapMarkerAlt size={10} /> {item.location}
                          </span>
                        ) : (
                          <span className="text-default-400">General</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        {item.stock_quantity}
                      </TableCell>
                      <TableCell className="text-center font-medium text-sm text-primary">
                        <PriceDisplay amount={item.price} />
                      </TableCell>
                      <TableCell className="text-center text-xs capitalize text-default-500">
                        {item.unit || "Unidad"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Existencias en Tiendas Distribuidas */}
        <Card className="border border-default-200 shadow-sm">
          <CardBody className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-success-600 font-bold text-base">
              <FaStore />
              <h3>Stock en Tiendas / Sucursales</h3>
            </div>
            <Divider />

            {storeStock.length === 0 ? (
              <p className="text-default-400 text-xs py-4 text-center">
                Este producto no ha sido distribuido a ninguna tienda aún.
              </p>
            ) : (
              <Table aria-label="Stock en tiendas" removeWrapper>
                <TableHeader>
                  <TableColumn>TIENDA / SUCURSAL</TableColumn>
                  <TableColumn align="center">STOCK EN TIENDA</TableColumn>
                  <TableColumn align="center">UBICACIÓN</TableColumn>
                </TableHeader>
                <TableBody>
                  {storeStock.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-default-100 last:border-none">
                      <TableCell className="font-semibold text-sm">
                        {item.store || "Sucursal"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={item.stock_quantity > 0 ? "success" : "danger"}
                          className="font-bold"
                        >
                          {item.stock_quantity} unid.
                        </Chip>
                      </TableCell>
                      <TableCell className="text-center text-xs text-default-500">
                        {item.location || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};