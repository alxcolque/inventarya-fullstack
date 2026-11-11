import { create } from "zustand";
import { toast } from "sonner";
import { getLeafCategoryName } from "@/modules/tenant/pos/utils/category";

export interface ShopCartItem {
  inventory_id: string | number;
  product_id: string | number;
  name: string;
  category?: string;
  brand?: string;
  sku?: string;
  thumbnail?: string;
  unit?: string;
  price: number;
  quantity: number;
  stock_quantity: number;
}

interface ShopCartState {
  slug: string;
  cart: ShopCartItem[];
  isCartModalOpen: boolean;
  totalUnits: number;
  totalAmount: number;
  totalItemsCount: number;

  // Actions
  initCartForShop: (slug: string) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: any, qtyToAdd?: number, customPrice?: number) => boolean;
  updateQty: (inventoryId: string | number, newQty: number) => void;
  updatePrice: (inventoryId: string | number, newPrice: number) => void;
  removeItem: (inventoryId: string | number) => void;
  clearCart: () => void;
  getItemQty: (inventoryId: string | number) => number;
}

const getStorageKey = (slug: string) => `pos_cart_${slug}`;

const loadCartFromStorage = (slug: string): ShopCartItem[] => {
  if (!slug || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCartToStorage = (slug: string, items: ShopCartItem[]) => {
  if (!slug || typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
  } catch (e) {
    console.error("Error saving shop cart to localStorage", e);
  }
};

const calculateTotals = (items: ShopCartItem[]) => {
  const totalUnits = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const totalAmount = items.reduce(
    (acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.price) || 0),
    0
  );
  return {
    totalUnits,
    totalAmount,
    totalItemsCount: items.length,
  };
};

export const useShopCartStore = create<ShopCartState>((set, get) => ({
  slug: "",
  cart: [],
  isCartModalOpen: false,
  totalUnits: 0,
  totalAmount: 0,
  totalItemsCount: 0,

  initCartForShop: (slug: string) => {
    if (!slug) return;
    const currentSlug = get().slug;
    if (currentSlug === slug && get().cart.length > 0) return;

    const items = loadCartFromStorage(slug);
    const totals = calculateTotals(items);
    set({
      slug,
      cart: items,
      ...totals,
    });
  },

  openCart: () => set({ isCartModalOpen: true }),
  closeCart: () => set({ isCartModalOpen: false }),
  toggleCart: () => set((state) => ({ isCartModalOpen: !state.isCartModalOpen })),

  addItem: (product: any, qtyToAdd: number = 1, customPrice?: number): boolean => {
    const { slug, cart } = get();
    if (!product) return false;

    const inventoryId = product.inventory_id ?? product.id;
    const productId = product.id ?? product.product_id;
    const stockAvailable = Number(product.stock_quantity ?? product.stock ?? 0);

    if (stockAvailable <= 0) {
      toast.error(`'${product.name}' está agotado en esta tienda.`);
      return false;
    }

    if (qtyToAdd <= 0) {
      toast.error("La cantidad a agregar debe ser mayor a 0.");
      return false;
    }

    const price =
      customPrice !== undefined && !isNaN(customPrice)
        ? Number(customPrice)
        : Number(product.sale_price ?? product.saleprice ?? product.price ?? 0);

    const existingIndex = cart.findIndex((i) => i.inventory_id === inventoryId);
    const currentQtyInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    if (currentQtyInCart + qtyToAdd > stockAvailable) {
      toast.warning(
        `Stock máximo disponible: ${stockAvailable} ${product.unit || "u."} (ya tienes ${currentQtyInCart} en carrito).`
      );
      return false;
    }

    let updatedCart: ShopCartItem[];
    if (existingIndex > -1) {
      updatedCart = cart.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              quantity: item.quantity + qtyToAdd,
              price: customPrice !== undefined ? price : item.price,
            }
          : item
      );
      toast.success(`Cantidad aumentada a ${currentQtyInCart + qtyToAdd} para '${product.name}'.`);
    } else {
      const newItem: ShopCartItem = {
        inventory_id: inventoryId,
        product_id: productId,
        name: product.name || "Producto",
        category: getLeafCategoryName(product.category || product.category_path || product.category_name || ""),
        brand: product.brand || "",
        sku: product.sku || product.barcode || "",
        thumbnail: product.thumbnail || product.image,
        unit: product.unit || "Unidad",
        price,
        quantity: qtyToAdd,
        stock_quantity: stockAvailable,
      };
      updatedCart = [...cart, newItem];
      toast.success(`'${product.name}' agregado a la venta.`);
    }

    saveCartToStorage(slug, updatedCart);
    const totals = calculateTotals(updatedCart);
    set({ cart: updatedCart, ...totals });
    return true;
  },

  updateQty: (inventoryId: string | number, newQty: number) => {
    const { slug, cart } = get();
    const item = cart.find((i) => String(i.inventory_id) === String(inventoryId));
    if (!item) return;

    if (newQty <= 0) {
      get().removeItem(inventoryId);
      return;
    }

    const safeQty = Math.min(newQty, item.stock_quantity);
    if (newQty > item.stock_quantity) {
      toast.warning(`Stock máximo en tienda: ${item.stock_quantity} unidades.`);
    }

    const updatedCart = cart.map((i) =>
      String(i.inventory_id) === String(inventoryId) ? { ...i, quantity: safeQty } : i
    );

    saveCartToStorage(slug, updatedCart);
    const totals = calculateTotals(updatedCart);
    set({ cart: updatedCart, ...totals });
  },

  updatePrice: (inventoryId: string | number, newPrice: number) => {
    const { slug, cart } = get();
    const safePrice = Math.max(0, Number(newPrice) || 0);

    const updatedCart = cart.map((i) =>
      String(i.inventory_id) === String(inventoryId) ? { ...i, price: safePrice } : i
    );

    saveCartToStorage(slug, updatedCart);
    const totals = calculateTotals(updatedCart);
    set({ cart: updatedCart, ...totals });
  },

  removeItem: (inventoryId: string | number) => {
    const { slug, cart } = get();
    const updatedCart = cart.filter((i) => String(i.inventory_id) !== String(inventoryId));

    saveCartToStorage(slug, updatedCart);
    const totals = calculateTotals(updatedCart);
    set({ cart: updatedCart, ...totals });
    toast.info("Producto removido del carrito.");
  },

  clearCart: () => {
    const { slug } = get();
    saveCartToStorage(slug, []);
    set({
      cart: [],
      totalUnits: 0,
      totalAmount: 0,
      totalItemsCount: 0,
    });
  },

  getItemQty: (inventoryId: string | number): number => {
    const item = get().cart.find((i) => String(i.inventory_id) === String(inventoryId));
    return item ? item.quantity : 0;
  },
}));
