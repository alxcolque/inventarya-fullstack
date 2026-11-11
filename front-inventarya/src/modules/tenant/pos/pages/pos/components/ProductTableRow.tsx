import React from "react";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
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

export interface ProductTableRowProps {
  product: any;
  qtyInCart: number;
  canEditInventory: boolean;
  onAddToCart: (product: any) => void;
  onUpdateQty: (inventoryId: number | string, newQty: number) => void;
  onOpenEdit: (product: any) => void;
  onReturn: (inventoryId: number | string) => void;
  onViewProduct: (productId: number | string) => void;
}

export const ProductTableRow: React.FC<ProductTableRowProps> = React.memo(
  ({
    product,
    qtyInCart,
    canEditInventory,
    onAddToCart,
    onUpdateQty,
    onOpenEdit,
    onReturn,
    onViewProduct,
  }) => {
    const stockAvailable = Number(product.stock_quantity ?? product.stock ?? 0);
    const isOutOfStock = stockAvailable <= 0;
    const prodCartId = product.inventory_id ?? product.id;
    const price = Number(product.sale_price ?? product.saleprice ?? product.price ?? 0);
    const imageSrc = product.thumbnail || product.image;

    return (
      <tr
        className={`hover:bg-default-50/70 transition-colors ${
          isOutOfStock ? "opacity-60 grayscale-[30%]" : ""
        }`}
      >
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-default-200 shrink-0 bg-default-100 overflow-hidden flex items-center justify-center">
              {!imageSrc ? (
                <FaBoxesStacked className="text-default-400 text-xs" />
              ) : (
                <img
                  src={getImageUrl(imageSrc)}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e: any) => {
                    e.currentTarget.src = "/favicon.ico";
                  }}
                />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-foreground truncate max-w-[220px]">
                {product.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {Boolean(getLeafCategoryName(product.category_name)) && (
                  <Chip
                    size="sm"
                    variant="flat"
                    className="h-3.5 text-[8px] font-bold px-1 border"
                    style={{
                      backgroundColor: `${product.category_color || "#6366f1"}18`,
                      color: product.category_color || "#6366f1",
                      borderColor: `${product.category_color || "#6366f1"}35`,
                    }}
                  >
                    <span className="truncate max-w-[110px]">{getLeafCategoryName(product.category_name)}</span>
                  </Chip>
                )}
                <span className="text-[10px] text-default-400 truncate">
                  {product.brand || product.unit || "Unidad"}
                </span>
              </div>
            </div>
          </div>
        </td>

        <td className="py-2 px-2 text-center">
          <Chip
            size="sm"
            variant="flat"
            color={isOutOfStock ? "danger" : "success"}
            className="font-black text-[10px] h-4.5"
          >
            {isOutOfStock ? "0" : stockAvailable}
          </Chip>
        </td>

        <td className="py-2 px-2 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs">
          <PriceDisplay amount={price} />
        </td>

        <td className="py-2 px-3 text-center">
          {qtyInCart > 0 ? (
            <div className="inline-flex items-center bg-default-100 rounded-xl p-0.5 border border-emerald-500/40">
              <Button
                size="sm"
                isIconOnly
                aria-label="Disminuir"
                variant="light"
                className="h-6 w-6 min-w-6"
                onPress={() => onUpdateQty(prodCartId, qtyInCart - 1)}
              >
                <FaMinus className="text-[8px]" />
              </Button>
              <span className="font-black text-xs px-1.5">{qtyInCart}</span>
              <Button
                size="sm"
                isIconOnly
                aria-label="Aumentar"
                variant="light"
                color="success"
                className="h-6 w-6 min-w-6"
                isDisabled={qtyInCart >= stockAvailable}
                onPress={() => onUpdateQty(prodCartId, qtyInCart + 1)}
              >
                <FaPlus className="text-[8px]" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              color="primary"
              variant="solid"
              className="h-7 text-[11px] font-bold px-2.5"
              isDisabled={isOutOfStock}
              onPress={() => onAddToCart(product)}
            >
              Agregar
            </Button>
          )}
        </td>

        {canEditInventory && (
          <td className="py-2 px-2 text-center">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  size="sm"
                  isIconOnly
                  aria-label="Acciones de producto"
                  variant="light"
                  className="h-7 w-7 min-w-7 text-default-400"
                >
                  <FaEllipsisVertical className="text-[10px]" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Acciones">
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
          </td>
        )}
      </tr>
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
      prev.canEditInventory === next.canEditInventory
    );
  }
);
