import React from "react";
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
} from "@nextui-org/react";
import {
  FaPlus,
  FaMinus,
  FaEye,
  FaTag,
  FaArrowRightArrowLeft,
  FaBoxesStacked,
  FaEllipsisVertical,
} from "react-icons/fa6";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getImageUrl } from "@/utils/image";
import { getLeafCategoryName } from "@/modules/tenant/pos/utils/category";

export interface ProductCardProps {
  product: any;
  qtyInCart: number;
  isJustScanned: boolean;
  canEditInventory: boolean;
  isOnline: boolean;
  onAddToCart: (product: any) => void;
  onUpdateQty: (inventoryId: number | string, newQty: number) => void;
  onOpenEdit: (product: any) => void;
  onReturn: (inventoryId: number | string) => void;
  onViewProduct: (productId: number | string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(
  ({
    product,
    qtyInCart,
    isJustScanned,
    canEditInventory,
    isOnline,
    onAddToCart,
    onUpdateQty,
    onOpenEdit,
    onReturn,
    onViewProduct,
  }) => {
    const stockAvailable = Number(product.stock_quantity ?? product.stock ?? 0);
    const minStock = Number(product.min_stock ?? 0);
    const isOutOfStock = stockAvailable <= 0;
    const isLowStock = stockAvailable > 0 && stockAvailable <= minStock;
    const prodCartId = product.inventory_id ?? product.id;
    const price = Number(product.sale_price ?? product.saleprice ?? product.price ?? 0);
    const imageSrc = product.thumbnail || product.image;

    return (
      <Card
        onClick={() => {
          if (!isOutOfStock) {
            onAddToCart(product);
          }
        }}
        className={`group border transition-all duration-200 shadow-sm flex flex-col justify-between bg-background text-left ${
          isJustScanned
            ? "ring-2 ring-emerald-500 scale-[1.02] border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
            : qtyInCart > 0
            ? "border-emerald-500/70 ring-1 ring-emerald-500/20"
            : "border-default-200 hover:border-primary/50"
        } ${isOutOfStock ? "opacity-60 grayscale-[30%] cursor-not-allowed" : "cursor-pointer"}`}
      >
        {/* Imagen y Badges */}
        <div className="relative aspect-square w-full overflow-hidden bg-default-100 flex items-center justify-center">
          {!isOnline || !imageSrc ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-default-100 text-default-400 gap-1 p-2 text-center select-none">
              <FaBoxesStacked size={18} className="text-primary-500" />
              <span className="text-[10px] font-bold text-default-600 line-clamp-1">
                {product.brand || getLeafCategoryName(product.category_name) || "Producto"}
              </span>
            </div>
          ) : (
            <Image
              removeWrapper
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              src={getImageUrl(imageSrc)}
              fallbackSrc="/favicon.ico"
            />
          )}

          {/* Badges Superiores */}
          <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1 items-start">
            <Chip
              size="sm"
              variant="flat"
              color={isOutOfStock ? "danger" : isLowStock ? "warning" : "success"}
              className="font-extrabold text-[9px] h-4.5 px-1 shadow-sm backdrop-blur-md bg-background/85"
            >
              {isOutOfStock ? "Agotado" : `Stock: ${stockAvailable}`}
            </Chip>
          </div>

          {/* Admin Menu (top-right) */}
          {canEditInventory && (
            <div
              className="absolute top-1 right-1 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    size="sm"
                    isIconOnly
                    aria-label={`Acciones para ${product.name}`}
                    variant="flat"
                    className="h-7 w-7 min-w-7 bg-background/80 backdrop-blur-sm border border-default-200 shadow-sm"
                  >
                    <FaEllipsisVertical className="text-[10px] text-default-600" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Acciones de producto">
                  <DropdownItem
                    key="view"
                    startContent={<FaEye className="text-xs text-primary" />}
                    onPress={() => onViewProduct(product.id ?? product.product_id)}
                  >
                    Ver Producto
                  </DropdownItem>
                  <DropdownItem
                    key="edit"
                    startContent={<FaTag className="text-xs text-warning" />}
                    onPress={() => onOpenEdit(product)}
                  >
                    Editar Inventario
                  </DropdownItem>
                  <DropdownItem
                    key="return"
                    className="text-danger"
                    color="danger"
                    startContent={<FaArrowRightArrowLeft className="text-xs" />}
                    onPress={() => onReturn(prodCartId)}
                  >
                    Devolver al Almacén
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          )}

          {qtyInCart > 0 && (
            <div className="absolute bottom-1.5 right-1.5 z-10 bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-md animate-pulse">
              {qtyInCart} en caja
            </div>
          )}
        </div>

        {/* Info del Producto */}
        <CardBody className="p-1.5 sm:p-2.5 flex flex-col gap-0.5 sm:gap-1 justify-between flex-1">
          <div>
            {/* Chip de Categoría */}
            {Boolean(getLeafCategoryName(product.category_name)) && (
              <div className="mb-1 flex items-center">
                <Chip
                  size="sm"
                  variant="flat"
                  className="h-4 sm:h-4.5 text-[8.5px] sm:text-[9.5px] font-bold px-1 sm:px-1.5 border max-w-full"
                  style={{
                    backgroundColor: `${product.category_color || "#6366f1"}18`,
                    color: product.category_color || "#6366f1",
                    borderColor: `${product.category_color || "#6366f1"}35`,
                  }}
                >
                  <span className="truncate">{getLeafCategoryName(product.category_name)}</span>
                </Chip>
              </div>
            )}

            <h3
              title={product.name}
              className="font-bold text-[11px] sm:text-xs text-foreground line-clamp-2 leading-tight sm:leading-snug group-hover:text-primary transition-colors"
            >
              {product.name}
            </h3>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-default-400 mt-0.5">
              {product.barcode && (
                <span className="font-mono text-primary-600 dark:text-primary-400">
                  #{product.barcode}
                </span>
              )}
              {product.sku && !product.barcode && (
                <span className="font-mono">#{product.sku}</span>
              )}
            </div>
          </div>

          <div className="mt-1 pt-1 sm:mt-1.5 sm:pt-1.5 border-t border-default-100 flex items-center justify-between gap-1">
            <span className="text-[10px] text-default-400 uppercase font-semibold">
              {product.unit || "u."}
            </span>
            <span className="text-xs min-[390px]:text-sm font-black text-emerald-600 whitespace-nowrap dark:text-emerald-400">
              <PriceDisplay amount={price} />
            </span>
          </div>

          {/* Botón de Adición / Stepper */}
          <div
            className="mt-0.5 sm:mt-1"
            onClick={(e) => e.stopPropagation()} // Evitar doble click en el card
          >
            {qtyInCart > 0 ? (
              <div className="flex items-center justify-between bg-default-100 rounded-xl p-0.5 border border-emerald-500/40">
                <Button
                  size="sm"
                  isIconOnly
                  aria-label="Disminuir cantidad"
                  variant="light"
                  className="h-7 w-7 min-w-7 sm:h-6 sm:w-6 sm:min-w-6"
                  onPress={() => onUpdateQty(prodCartId, qtyInCart - 1)}
                >
                  <FaMinus className="text-[9px]" />
                </Button>
                <span className="font-black text-xs text-foreground px-1 text-center">
                  {qtyInCart}
                </span>
                <Button
                  size="sm"
                  isIconOnly
                  aria-label="Aumentar cantidad"
                  variant="light"
                  color="success"
                  className="h-7 w-7 min-w-7 sm:h-6 sm:w-6 sm:min-w-6"
                  isDisabled={qtyInCart >= stockAvailable}
                  onPress={() => onUpdateQty(prodCartId, qtyInCart + 1)}
                >
                  <FaPlus className="text-[9px]" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                color="primary"
                variant="flat"
                className="font-bold text-[10px] sm:text-[11px] w-full h-7 sm:h-7 shadow-none"
                startContent={<FaPlus className="text-[9px]" />}
                isDisabled={isOutOfStock}
                onPress={() => onAddToCart(product)}
              >
                {isOutOfStock ? "Agotado" : "Agregar"}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  },
  (prev, next) => {
    return (
      prev.product.inventory_id === next.product.inventory_id &&
      prev.product.id === next.product.id &&
      prev.product.stock_quantity === next.product.stock_quantity &&
      prev.product.stock === next.product.stock &&
      prev.product.sale_price === next.product.sale_price &&
      prev.product.price === next.product.price &&
      prev.qtyInCart === next.qtyInCart &&
      prev.isJustScanned === next.isJustScanned &&
      prev.canEditInventory === next.canEditInventory &&
      prev.isOnline === next.isOnline
    );
  }
);
