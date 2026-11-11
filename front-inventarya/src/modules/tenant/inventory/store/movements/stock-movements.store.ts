import { create, StateCreator } from "zustand";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { tenantApi } from "@/api";

export interface TransferCartItem {
  cart_item_id?: string;
  inventory_id?: string | number;
  product_id: string | number;
  product_name: string;
  thumbnail?: string;
  category?: string;
  brand?: string;
  sku?: string;
  warehouse_unit?: string;
  unit: string;
  min_stock: number;
  available_stock: number;
  quantity: number;
  cost_price: number;
  sale_price: number;
  expiration_date?: string | null;
}

export interface StockMovementRecord {
  id: string | number;
  source_warehouse_id?: string | number | null;
  destination_store_id?: string | number | null;
  user_id: number;
  document_type: string;
  document_number: string;
  status: "pending" | "in_transit" | "completed" | "returned" | "cancelled";
  notes?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
  destinationStore?: {
    id: string | number;
    name: string;
    address?: string;
    phone?: string;
  };
  user?: {
    id: number;
    name: string;
    email: string;
  };
  items: Array<{
    id: string | number;
    stock_movement_id: string | number;
    product_id: string | number;
    quantity: number;
    cost_price: number;
    sale_price: number;
    unit?: string;
    min_stock?: number;
    product?: {
      id: string | number;
      name: string;
      sku?: string;
      barcode?: string;
      thumbnail?: string;
      category?: string;
    };
  }>;
}

interface StockMovementsState {
  cartItems: TransferCartItem[];
  movements: StockMovementRecord[];
  isLoading: boolean;
  totalCartItems: number;
  totalCartUnits: number;
}

interface StockMovementsActions {
  addToCart: (product: any, initialQuantity?: number) => void;
  addAllToCart: (products: any[], mode?: "full" | "one") => void;
  removeFromCart: (identifier: string | number) => void;
  updateQuantity: (identifier: string | number, quantity: number, unit?: string) => void;
  updateSalePrice: (identifier: string | number, price: number, unit?: string) => void;
  updateUnit: (identifier: string | number, unit: string) => void;
  updateMinStock: (identifier: string | number, minStock: number) => void;
  updateExpirationDate: (identifier: string | number, date: string) => void;
  clearCart: () => void;
  getMovements: (params?: any) => Promise<void>;
  createMovement: (payload: {
    destination_store_id: string | number;
    notes?: string;
    direct_to_store?: boolean;
    items: Array<{
      inventory_id?: string | number;
      product_id: string | number;
      quantity: number;
      cost_price?: number;
      sale_price?: number;
      unit?: string;
      min_stock?: number;
      expiration_date?: string | null;
    }>;
  }) => Promise<StockMovementRecord | null>;
  returnMovement: (id: number | string, reason?: string) => Promise<boolean>;
  receiveMovement: (id: number | string) => Promise<boolean>;
}

// Generador de clave única para cada ítem del carrito (evita colisiones por unidad y por registro de almacén)
export const getCartKey = (itemOrProduct: any): string => {
  if (itemOrProduct.cart_item_id) return String(itemOrProduct.cart_item_id);
  if (itemOrProduct.inventory_id) return `inv_${itemOrProduct.inventory_id}`;
  const prodId = itemOrProduct.product_id ?? itemOrProduct.id;
  const unit = (itemOrProduct.unit || itemOrProduct.warehouse_unit || "Unidad").trim().toLowerCase();
  return `prod_${prodId}_${unit}`;
};

// Persistencia en sessionStorage del carrito para no perderlo al recargar
const loadCartFromStorage = (): TransferCartItem[] => {
  try {
    const raw = sessionStorage.getItem("inv_transfer_cart");
    if (!raw) return [];
    const parsed: TransferCartItem[] = JSON.parse(raw);
    return parsed.map((item) => ({
      ...item,
      cart_item_id: item.cart_item_id || getCartKey(item),
      quantity: Math.max(1, Number(item.quantity) || 1),
      sale_price: Number((Number(item.sale_price) || 0).toFixed(2)),
    }));
  } catch {
    return [];
  }
};

const saveCartToStorage = (items: TransferCartItem[]) => {
  try {
    sessionStorage.setItem("inv_transfer_cart", JSON.stringify(items));
  } catch (e) {
    console.error("Error saving cart to storage", e);
  }
};

const storeApi: StateCreator<StockMovementsState & StockMovementsActions> = (set, get) => ({
  cartItems: loadCartFromStorage(),
  movements: [],
  isLoading: false,
  totalCartItems: loadCartFromStorage().length,
  totalCartUnits: loadCartFromStorage().reduce((sum, item) => sum + item.quantity, 0),

  addToCart: (product: any, initialQuantity: number = 1) => {
    const current = get().cartItems;
    const availableStock = Number(product.stock_quantity ?? product.stock ?? 0);
    if (isNaN(availableStock) || availableStock <= 0) {
      toast.error(`'${product.name}' no tiene existencias disponibles en almacén.`);
      return;
    }

    const itemKey = getCartKey(product);
    const existingIndex = current.findIndex((item) => {
      if (item.cart_item_id && item.cart_item_id === itemKey) return true;
      if (item.inventory_id && product.inventory_id && String(item.inventory_id) === String(product.inventory_id)) return true;
      return (
        String(item.product_id) === String(product.id) &&
        (item.unit || "").trim().toLowerCase() === (product.unit || "Unidad").trim().toLowerCase()
      );
    });

    let updated: TransferCartItem[];
    if (existingIndex > -1) {
      const existing = current[existingIndex];
      const warehouseUnit = existing.warehouse_unit || existing.unit || product.unit || "Unidad";
      const newQty = Math.min(existing.quantity + initialQuantity, availableStock);

      if (newQty === existing.quantity && existing.quantity >= availableStock) {
        toast.info(`Has alcanzado el límite de stock en almacén (${availableStock} ${warehouseUnit}) para '${product.name}'.`);
        return;
      }

      updated = current.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              quantity: newQty,
              available_stock: availableStock,
              warehouse_unit: warehouseUnit,
              inventory_id: product.inventory_id || item.inventory_id,
            }
          : item
      );
      toast.success(`Cantidad aumentada a ${newQty} para '${product.name}'.`);
    } else {
      const costPrice = Number(product.price || 0);
      const salePrice = Number(product.saleprice || product.sale_price || costPrice * 1.3);
      const minStock = Number(product.min_stock ?? 0);
      const baseUnit = product.unit || "Unidad";
      const newItem: TransferCartItem = {
        cart_item_id: itemKey,
        inventory_id: product.inventory_id,
        product_id: product.id,
        product_name: product.name || "Producto",
        thumbnail: product.thumbnail || product.image,
        category: product.category_path || product.category,
        brand: product.brand || "",
        sku: product.sku || product.barcode || "",
        warehouse_unit: baseUnit,
        unit: baseUnit,
        min_stock: minStock,
        available_stock: availableStock,
        quantity: Math.min(initialQuantity, availableStock),
        cost_price: costPrice,
        sale_price: salePrice > 0 ? salePrice : costPrice,
        expiration_date: product.expiration_date || null,
      };
      updated = [...current, newItem];
      toast.success(`'${product.name}' añadido al carrito de transferencia.`);
    }

    saveCartToStorage(updated);
    set({
      cartItems: updated,
      totalCartItems: updated.length,
      totalCartUnits: updated.reduce((sum, i) => sum + i.quantity, 0),
    });
  },

  addAllToCart: (products: any[], mode: "full" | "one" = "full") => {
    const current = get().cartItems;
    const currentMap = new Map<string, TransferCartItem>();
    current.forEach((item) => {
      const k = item.cart_item_id || getCartKey(item);
      currentMap.set(k, { ...item, cart_item_id: k });
    });

    let count = 0;
    products.forEach((product: any) => {
      const prodId = product.product_id ?? product.id;
      if (!prodId) return;

      // ESTRICTO: Solo productos con stock > 0
      const availableStock = Number(product.stock_quantity ?? product.stock ?? 0);
      if (isNaN(availableStock) || availableStock <= 0) return;

      const k = getCartKey(product);
      const targetQty = mode === "one" ? 1 : availableStock;
      const safeQty = Math.max(1, Math.min(targetQty, availableStock));

      const existing = currentMap.get(k);
      if (existing) {
        existing.available_stock = availableStock;
        existing.quantity = safeQty;
        existing.unit = product.unit || existing.unit || "Unidad";
        existing.warehouse_unit = product.unit || existing.warehouse_unit || "Unidad";
        existing.inventory_id = product.inventory_id || existing.inventory_id;
        count++;
      } else {
        const costPrice = Number(product.price || 0);
        const salePrice = Number((Number(product.saleprice || product.sale_price || costPrice * 1.3) || 0).toFixed(2));
        const minStock = Number(product.min_stock ?? 0);
        const baseUnit = product.unit || "Unidad";
        const newItem: TransferCartItem = {
          cart_item_id: k,
          inventory_id: product.inventory_id,
          product_id: prodId,
          product_name: product.name || "Producto",
          thumbnail: product.thumbnail || product.image,
          category: product.category_path || product.category,
          brand: product.brand || "",
          sku: product.sku || product.barcode || "",
          warehouse_unit: baseUnit,
          unit: baseUnit,
          min_stock: minStock,
          available_stock: availableStock,
          quantity: safeQty,
          cost_price: costPrice,
          sale_price: salePrice > 0 ? salePrice : costPrice,
          expiration_date: product.expiration_date || null,
        };
        currentMap.set(k, newItem);
        count++;
      }
    });

    const updated = Array.from(currentMap.values());
    saveCartToStorage(updated);
    set({
      cartItems: updated,
      totalCartItems: updated.length,
      totalCartUnits: updated.reduce((sum, i) => sum + i.quantity, 0),
    });

    if (count > 0) {
      toast.success(
        mode === "full"
          ? `Se cargaron ${count} productos con stock disponible al carrito.`
          : `Se cargaron ${count} productos (1 unidad c/u) al carrito.`
      );
    } else {
      toast.info("No se encontraron productos con existencias disponibles (> 0) para agregar.");
    }
  },

  removeFromCart: (identifier: string | number) => {
    const matchKey = String(identifier);
    const updated = get().cartItems.filter((i) => {
      if (i.cart_item_id && i.cart_item_id === matchKey) return false;
      if (i.inventory_id && String(i.inventory_id) === matchKey) return false;
      if (String(itemKey => itemKey) === matchKey) return false;
      if (String(i.product_id) === matchKey) return false;
      return true;
    });

    saveCartToStorage(updated);
    set({
      cartItems: updated,
      totalCartItems: updated.length,
      totalCartUnits: updated.reduce((sum, i) => sum + i.quantity, 0),
    });
    toast.info("Producto eliminado del carrito.");
  },

  updateQuantity: (identifier: string | number, quantity: number, unit?: string) => {
    const matchKey = String(identifier);
    const updated = get().cartItems.map((item) => {
      const isMatch =
        (item.cart_item_id && item.cart_item_id === matchKey) ||
        (item.inventory_id && String(item.inventory_id) === matchKey) ||
        (String(item.product_id) === matchKey && (!unit || item.unit === unit));

      if (isMatch) {
        const targetUnit = (unit !== undefined ? unit : item.unit) || "Unidad";
        const warehouseUnit = item.warehouse_unit || item.unit || "Unidad";

        let safeQty = isNaN(quantity) ? 1 : quantity;

        // La cantidad nunca puede superar el stock disponible en almacén
        if (quantity > item.available_stock) {
          toast.warning(`El stock máximo disponible en almacén para '${item.product_name}' es ${item.available_stock} ${warehouseUnit}.`);
        }
        safeQty = Math.max(1, Math.min(safeQty, item.available_stock));

        return {
          ...item,
          quantity: safeQty,
          ...(unit !== undefined ? { unit: targetUnit } : {}),
        };
      }
      return item;
    });

    saveCartToStorage(updated);
    set({
      cartItems: updated,
      totalCartItems: updated.length,
      totalCartUnits: updated.reduce((sum, i) => sum + i.quantity, 0),
    });
  },

  updateSalePrice: (identifier: string | number, price: number, unit?: string) => {
    const matchKey = String(identifier);
    const updated = get().cartItems.map((item) => {
      const isMatch =
        (item.cart_item_id && item.cart_item_id === matchKey) ||
        (item.inventory_id && String(item.inventory_id) === matchKey) ||
        (String(item.product_id) === matchKey && (!unit || item.unit === unit));

      if (isMatch) {
        const safePrice = isNaN(price) ? 0 : Math.max(0, Number(Number(price).toFixed(2)));
        return {
          ...item,
          sale_price: safePrice,
          ...(unit !== undefined ? { unit } : {}),
        };
      }
      return item;
    });

    saveCartToStorage(updated);
    set({ cartItems: updated });
  },

  updateUnit: (identifier: string | number, unit: string) => {
    const matchKey = String(identifier);
    const updated = get().cartItems.map((item) => {
      const isMatch =
        (item.cart_item_id && item.cart_item_id === matchKey) ||
        (item.inventory_id && String(item.inventory_id) === matchKey) ||
        String(item.product_id) === matchKey;

      if (isMatch) {
        let safeQty = item.quantity;
        if (safeQty > item.available_stock) {
          safeQty = item.available_stock;
        }
        return { ...item, unit, quantity: safeQty };
      }
      return item;
    });
    saveCartToStorage(updated);
    set({
      cartItems: updated,
      totalCartUnits: updated.reduce((sum, i) => sum + i.quantity, 0),
    });
  },

  updateMinStock: (identifier: string | number, minStock: number) => {
    const matchKey = String(identifier);
    const updated = get().cartItems.map((item) => {
      const isMatch =
        (item.cart_item_id && item.cart_item_id === matchKey) ||
        (item.inventory_id && String(item.inventory_id) === matchKey) ||
        String(item.product_id) === matchKey;

      if (isMatch) {
        return { ...item, min_stock: Math.max(0, minStock) };
      }
      return item;
    });
    saveCartToStorage(updated);
    set({ cartItems: updated });
  },

  updateExpirationDate: (identifier: string | number, date: string) => {
    const matchKey = String(identifier);
    const updated = get().cartItems.map((item) => {
      const isMatch =
        (item.cart_item_id && item.cart_item_id === matchKey) ||
        (item.inventory_id && String(item.inventory_id) === matchKey) ||
        String(item.product_id) === matchKey;

      if (isMatch) {
        return { ...item, expiration_date: date || null };
      }
      return item;
    });
    saveCartToStorage(updated);
    set({ cartItems: updated });
  },

  clearCart: () => {
    saveCartToStorage([]);
    set({ cartItems: [], totalCartItems: 0, totalCartUnits: 0 });
  },

  getMovements: async (params?: any) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.get("/stock-movements", {
        params: params || {},
      });
      const list = response.data.data || response.data || [];
      set({ movements: list, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al obtener traslados");
      }
    }
  },

  createMovement: async (payload) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.post("/stock-movements", payload);
      const movement = response.data.movement as StockMovementRecord;
      toast.success(response.data.message || "Envío registrado con éxito");
      get().clearCart();
      set({ isLoading: false });
      return movement;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al registrar el traslado");
      }
      return null;
    }
  },

  returnMovement: async (id: number | string, reason?: string) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.post(`/stock-movements/${id}/return`, {
        reason: reason || "Cancelación / rechazo de tienda",
      });
      toast.success(response.data.message || "Envío devuelto al almacén con éxito");
      await get().getMovements();
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al devolver envío");
      }
      return false;
    }
  },

  receiveMovement: async (id: number | string) => {
    set({ isLoading: true });
    try {
      const response = await tenantApi.post(`/stock-movements/${id}/receive`);
      toast.success(response.data.message || "Envío completado y recibido en tienda");
      await get().getMovements();
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error al confirmar recepción");
      }
      return false;
    }
  },
});

export const useStockMovementsStore = create<StockMovementsState & StockMovementsActions>()(storeApi);
