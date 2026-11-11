import { useCashRegisterStore } from '../../../cash-register/cash-register.store';
import { getTenantSlug } from '@/utils/tenant';
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionItem,
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Tab,
  Tabs,
  Textarea,
} from "@nextui-org/react";
import {
  FaCartShopping,
  FaReceipt,
  FaMoneyBillWave,
  FaCreditCard,
  FaQrcode,
  FaCircleCheck,
  FaStore,
  FaTrash,
  FaPlus,
  FaMinus,
  FaBarcode,
  FaCamera,
  FaRotate,
  FaLightbulb,
  FaXmark,
  FaSliders,
  FaArrowRight,
  FaArrowLeft,
  FaUser,
  FaTag,
  FaTriangleExclamation,
} from "react-icons/fa6";
import { toast } from "sonner";
import { useScannerLifecycle } from '@/hooks/useScannerLifecycle';
import { CameraFocusIndicator } from '@/components/common/CameraFocusIndicator';
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCustomerStore } from "@/modules/tenant/customers/store/customer/customer.store";
import { useOrdersStore } from "@/modules/tenant/sales/store/orders/orders.store";
import { useStockStore } from "@/modules/tenant/inventory/store/inventories/inv-shops.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useShopCartStore } from "../../../store/cart/shop-cart.store";
import { getImageUrl } from "@/utils/image";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { parseDecimalInput } from "@/utils/number-format";
import { useCurrency } from "@/stores/currency/currency.store";
import { queueOfflineSale, decrementOfflineStock, validateOfflineStock } from "@/modules/tenant/pos/offline/pos-db";
import { scannerAudio } from "@/utils/scannerAudio";
import useNotificationStore from "@/modules/shared/store/notifications/notifications.store";
import { FaTimes, FaTimesCircle } from "react-icons/fa";
import { useMobileKeyboardViewport } from "@/hooks";
import { usePosBarcodeResolver } from "@/modules/tenant/pos/hooks/usePosBarcodeResolver";

interface CartModalProps {
  shopId?: string | number;
  slug?: string;
  onSaleCompleted?: (
    saleId: number | string,
    soldItems?: { inventory_id: number | string; quantity: number }[]
  ) => void;
}

export const CartModal: React.FC<CartModalProps> = ({ shopId, slug, onSaleCompleted }) => {
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const user = useTenantAuthStore((state) => state.user);

  // Active Shop Flags
  const currentShop = useShopsStore((state) => {
    if (state.shop && (state.shop.id === shopId || state.shop.slug === slug)) {
      return state.shop;
    }
    return state.shops.find((s) => s.id === shopId || s.slug === slug) || state.shop;
  });

  const enableCustomers = Boolean(currentShop?.enable_customers);
  const enablePayment = Boolean(currentShop?.enable_payment);
  const enableObservations = Boolean(currentShop?.enable_observations);
  const enableDiscount = Boolean(currentShop?.enable_discount);
  const enableElectronicInvoicing = Boolean(currentShop?.enable_electronic_invoicing);

  // Cart Store
  const cart = useShopCartStore((state) => state.cart);
  const isCartModalOpen = useShopCartStore((state) => state.isCartModalOpen);
  const closeCart = useShopCartStore((state) => state.closeCart);
  const addItem = useShopCartStore((state) => state.addItem);
  const updateQty = useShopCartStore((state) => state.updateQty);
  const updatePrice = useShopCartStore((state) => state.updatePrice);
  const removeItem = useShopCartStore((state) => state.removeItem);
  const clearCart = useShopCartStore((state) => state.clearCart);
  const totalUnits = useShopCartStore((state) => state.totalUnits);

  // Stock Store para búsqueda y escaneo directo
  const storeProducts = useStockStore((state) => state.storeProducts);

  // Clientes y Ventas
  const customers = useCustomerStore((state) => state.customers);
  const getCustomers = useCustomerStore((state) => state.getCustomers);
  const createSale = useOrdersStore((state) => state.createSale);
  const { symbol: currencySymbol } = useCurrency();

  // Estados locales de la vista
  const [activeTab, setActiveTab] = useState<string>("cart");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmSaleOpen, setIsConfirmSaleOpen] = useState<boolean>(false);
  const [saleErrorMessage, setSaleErrorMessage] = useState<string | null>(null);

  // Gesto táctil horizontal para cambiar entre pasos en celular y tablet
  const touchSwipeStartX = useRef<number>(0);
  const touchSwipeStartY = useRef<number>(0);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    touchSwipeStartX.current = e.touches[0].clientX;
    touchSwipeStartY.current = e.touches[0].clientY;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchSwipeStartX.current;
    const deltaY = endY - touchSwipeStartY.current;

    // Solo si el gesto es horizontal y tiene al menos 50px de recorrido
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        // Deslizar hacia la izquierda: ir al paso 2 (Pago)
        if (activeTab === "cart" && cart.length > 0) {
          setSaleErrorMessage(null);
          setActiveTab("checkout");
        }
      } else {
        // Deslizar hacia la derecha: volver al paso 1 (Carrito)
        if (activeTab === "checkout") {
          setActiveTab("cart");
        }
      }
    }
  };

  // Búsqueda / Escáner manual
  const [manualCodeInput, setManualCodeInput] = useState<string>("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Escáner de cámara integrado
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);
  const lastScanTimeRef = useRef(0);
  const lastScannedCodeRef = useRef<string | null>(null);
  const scannerContainerId = 'cart-inline-camera-scanner';

  // Cliente
  const [customerTab, setCustomerTab] = useState<string>("quick");
  const [inputName, setInputName] = useState<string>("Cliente");
  const [inputPhone, setInputPhone] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");

  // Descuento, Observación y Pago
  const [inputDiscount, setInputDiscount] = useState<string>("0");
  const [observation, setObservation] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [cashReceived, setCashReceived] = useState<string>("");

  // Pago Mixto / Split Payment (6B.2)
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [splitPayments, setSplitPayments] = useState<Array<{
    id: string;
    method: string;
    amount: string;
    received: string;
    reference: string;
  }>>([
    { id: "1", method: "efectivo", amount: "", received: "", reference: "" },
    { id: "2", method: "qr", amount: "", received: "", reference: "" },
  ]);

  useEffect(() => {
    if (token && customers.length === 0) {
      getCustomers(token);
    }
  }, [token, customers.length, getCustomers]);

  // Cálculos de totales
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const discountVal = Math.max(0, parseDecimalInput(inputDiscount));
  const total = Math.max(0, subtotal - discountVal);
  const cashReceivedVal = parseDecimalInput(cashReceived);
  const changeVal = cashReceivedVal > total ? cashReceivedVal - total : 0;
  const splitTotal = useMemo(() => {
    return splitPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  }, [splitPayments]);

  // Hook unificado de resolución de código de barras (mismo que en POS)
  const { resolveScannedProduct, isResolvingScan } = usePosBarcodeResolver({ slug });

  // Lógica centralizada para añadir producto escaneado
  const handleProcessCode = useCallback(
    async (codeToSearch: string) => {
      await resolveScannedProduct(codeToSearch);
    },
    [resolveScannedProduct]
  );

  const scanner = useScannerLifecycle({ enabled: showCameraScanner && isCartModalOpen && activeTab === 'cart', onScan: (decodedText) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;
    const now = Date.now();
    const same = cleanText === lastScannedCodeRef.current;
    if (same && now - lastScanTimeRef.current < 1500 || !same && now - lastScanTimeRef.current < 400) return;
    lastScanTimeRef.current = now;
    lastScannedCodeRef.current = cleanText;
    void handleProcessCode(cleanText);
  } });
  const { cameras, selectedCameraId, isScanning: isCameraActive, hasTorch, isTorchOn,
    errorMessage: scannerError, toggleTorch, switchCamera: handleToggleFlipCamera,
    start: startCameraScanner } = scanner;
  useEffect(() => {
    if (scanner.status !== 'RUNNING') { lastScanTimeRef.current = 0; lastScannedCodeRef.current = null; }
  }, [scanner.status]);
  useEffect(() => {
    if (!isCartModalOpen) { setShowCameraScanner(false); setManualCodeInput(''); }
  }, [isCartModalOpen]);

  // Manejo de envío manual de código
  const handleSubmitManualCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCodeInput.trim();
    if (!code) return;
    setManualCodeInput("");
    await resolveScannedProduct(code);
    manualInputRef.current?.focus();
  };

  // Solicitar confirmación antes de emitir la venta
  const handleRequestConfirmation = () => {
    if (cart.length === 0) {
      toast.error("El carrito de compras está vacío.");
      return;
    }

    if (!shopId) {
      toast.error("No se ha identificado la tienda activa para registrar la venta.");
      return;
    }

    const curr = currencySymbol ? `${currencySymbol} ` : "$ ";

    if (isSplitPayment) {
      if (Math.abs(splitTotal - total) > 0.01) {
        toast.error(
          `La suma de los pagos (${curr}${splitTotal.toFixed(2)}) debe coincidir con el total (${curr}${total.toFixed(2)}).`
        );
        return;
      }
      for (const p of splitPayments) {
        const amt = parseFloat(p.amount) || 0;
        if (amt <= 0) {
          toast.error("Cada método de pago dividido debe tener un monto mayor a 0.");
          return;
        }
        if (p.method === "efectivo" && p.received) {
          const rec = parseFloat(p.received) || 0;
          if (rec > 0 && rec < amt) {
            toast.error(`El monto recibido en efectivo (${curr}${rec.toFixed(2)}) es menor al monto asignado (${curr}${amt.toFixed(2)}).`);
            return;
          }
        }
      }
    } else {
      if (paymentMethod === "efectivo" && cashReceivedVal > 0 && cashReceivedVal < total) {
        toast.error(
          `El efectivo recibido (${curr}${cashReceivedVal.toFixed(2)}) es menor al total (${curr}${total.toFixed(2)}).`
        );
        return;
      }
    }

    // Validar existencias
    for (const item of cart) {
      if (item.quantity <= 0) {
        toast.error(`La cantidad para "${item.name}" debe ser mayor a 0.`);
        return;
      }
      if (item.quantity > item.stock_quantity) {
        const errorMsg = `Stock insuficiente para "${item.name}". Disponible: ${item.stock_quantity}, solicitada: ${item.quantity}.`;
        setSaleErrorMessage(errorMsg);
        toast.error(errorMsg);
        setActiveTab("cart");
        return;
      }
    }

    setSaleErrorMessage(null);
    setIsConfirmSaleOpen(true);
  };

  // Procesar venta
  const handleCheckout = async () => {
    const cash = useCashRegisterStore.getState();
    const context = [getTenantSlug(), user?.id, shopId].join(':');
    if (!cash.ready || cash.context !== context || cash.busy || !cash.session || cash.session.status !== 'open') {
      toast.error('No existe una caja abierta verificada para esta tienda. Abre la caja antes de registrar ventas.');
      return;
    }
    setIsConfirmSaleOpen(false);
    setSaleErrorMessage(null);

    if (cart.length === 0) {
      toast.error("El carrito de compras está vacío.");
      return;
    }

    if (!shopId) {
      toast.error("No se ha identificado la tienda activa para registrar la venta.");
      return;
    }

    const curr = currencySymbol ? `${currencySymbol} ` : "$ ";

    if (isSplitPayment) {
      if (Math.abs(splitTotal - total) > 0.01) {
        const errorMsg = `La suma de los pagos (${curr}${splitTotal.toFixed(2)}) no coincide con el total (${curr}${total.toFixed(2)}).`;
        setSaleErrorMessage(errorMsg);
        toast.error(errorMsg);
        return;
      }
    } else {
      if (paymentMethod === "efectivo" && cashReceivedVal > 0 && cashReceivedVal < total) {
        const errorMsg = `El efectivo recibido (${curr}${cashReceivedVal.toFixed(2)}) es menor al total (${curr}${total.toFixed(2)}).`;
        setSaleErrorMessage(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    // Validar existencias antes de emitir
    for (const item of cart) {
      if (item.quantity <= 0) {
        const errorMsg = `La cantidad para "${item.name}" debe ser mayor a 0.`;
        setSaleErrorMessage(errorMsg);
        toast.error(errorMsg);
        setActiveTab("cart");
        return;
      }
      if (item.quantity > item.stock_quantity) {
        const errorMsg = `Stock insuficiente para "${item.name}". Disponible: ${item.stock_quantity}, solicitada: ${item.quantity}.`;
        setSaleErrorMessage(errorMsg);
        toast.error(errorMsg);
        setActiveTab("cart");
        return;
      }
    }

    const finalDiscount = enableDiscount ? discountVal : 0;
    const finalTotal = Math.max(0, subtotal - finalDiscount);
    const finalObservation = enableObservations ? (observation.trim() || null) : null;

    let paymentsPayload: any[] = [];
    let finalPaymentMethod = paymentMethod;

    if (isSplitPayment) {
      paymentsPayload = splitPayments.map((p) => {
        const amt = parseFloat(p.amount) || 0;
        const isCash = p.method === "efectivo";
        const rec = isCash ? (parseFloat(p.received) || amt) : null;
        const chg = isCash && rec !== null ? Math.max(0, rec - amt) : null;
        return {
          payment_method: p.method,
          amount: amt,
          amount_received: rec,
          change_amount: chg,
          reference: p.reference.trim() || null,
        };
      });
      finalPaymentMethod = splitPayments.length > 1 ? "mixto" : (splitPayments[0]?.method || "efectivo");
    } else {
      const isCash = paymentMethod === "efectivo";
      const rec = isCash && cashReceivedVal > 0 ? cashReceivedVal : finalTotal;
      const chg = isCash && cashReceivedVal > 0 ? Math.max(0, cashReceivedVal - finalTotal) : 0;
      paymentsPayload = [
        {
          payment_method: paymentMethod,
          amount: finalTotal,
          amount_received: isCash ? rec : null,
          change_amount: isCash ? chg : null,
          reference: finalObservation,
        },
      ];
      finalPaymentMethod = paymentMethod;
    }

    const saleUuid = crypto.randomUUID();
    const salePayload: Record<string, any> = {
      id: saleUuid,
      cash_register_session_id: cash.session.id,
      total: finalTotal,
      seller_id: user?.id,
      user_id: user?.id,
      store_id: shopId,
      status: "completado",
      payment_method: finalPaymentMethod,
      payments: paymentsPayload,
      amount_received: !isSplitPayment && paymentMethod === "efectivo" && cashReceivedVal > 0 ? cashReceivedVal : null,
      change: !isSplitPayment && paymentMethod === "efectivo" && cashReceivedVal > 0 ? Math.max(0, cashReceivedVal - finalTotal) : null,
      discount: finalDiscount,
      observation: finalObservation,
      products: cart.map((i) => ({
        product_id: i.product_id,
        inventory_id: i.inventory_id,
        quantity: i.quantity,
        price: i.price,
      })),
    };

    if (enableCustomers) {
      if (customerTab === "quick") {
        salePayload.tab = "customer";
        salePayload.name = inputName.trim() || "Cliente";
        salePayload.phone = inputPhone.trim() || null;
      } else {
        salePayload.tab = "customer2";
        salePayload.customer_id = selectedCustomer ? Number(selectedCustomer) : 0;
      }
    } else {
      salePayload.tab = "customer";
      salePayload.name = "Cliente";
      salePayload.customer_id = 0;
    }

    setIsLoading(true);

    // Flujo offline
    if (!navigator.onLine) {
      try {
        const stockCheck = await validateOfflineStock(
          cart.map((i) => ({
            inventory_id: i.inventory_id,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          { storeSlug: slug }
        );
        if (!stockCheck.valid) {
          toast.error(stockCheck.error || "Stock local insuficiente.");
          setIsLoading(false);
          return;
        }

        await queueOfflineSale(saleUuid, slug || "", shopId || "", salePayload);
        await decrementOfflineStock(
          cart.map((i) => ({
            inventory_id: i.inventory_id,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          { storeSlug: slug }
        );
        clearCart();
        closeCart();
        toast.success("Venta guardada en este dispositivo. Se sincronizará automáticamente cuando vuelva la conexión.", {
          duration: 5000,
        });
        if (onSaleCompleted) onSaleCompleted(saleUuid);
      } catch (e: any) {
        console.error("Error al guardar venta offline:", e);
        toast.error(e?.message || "No se pudo guardar la venta localmente.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const result = await createSale(salePayload, token!);
      if (result) {
        const createdId = result?.id || result?.sale?.id || saleUuid;
        const soldItems = cart.map((i) => ({
          inventory_id: i.inventory_id,
          quantity: i.quantity,
        }));
        clearCart();
        closeCart();
        setInputDiscount("0");
        setObservation("");
        setCashReceived("");
        setActiveTab("cart");
        setSaleErrorMessage(null);

        useNotificationStore.getState().playNotificationSound({ type: 'sale', title: 'Ventas' });

        if (changeVal > 0 && paymentMethod === "efectivo") {
          toast.success(`¡Venta completada! Cambio a entregar: ${curr}${changeVal.toFixed(2)}`, {
            duration: 6000,
          });
        }

        if (onSaleCompleted && createdId) {
          onSaleCompleted(createdId, soldItems);
        }

        // Navegar DIRECTAMENTE a la página de detalle de venta del POS
        if (createdId && slug) {
          navigate(`/tienda/${slug}/ventas/detalle/${createdId}`);
        }
      } else if (!navigator.onLine) {
        const stockCheck = await validateOfflineStock(
          cart.map((i) => ({
            inventory_id: i.inventory_id,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          { storeSlug: slug }
        );
        if (stockCheck.valid) {
          await queueOfflineSale(saleUuid, slug || "", shopId || "", salePayload);
          await decrementOfflineStock(
            cart.map((i) => ({
              inventory_id: i.inventory_id,
              product_id: i.product_id,
              quantity: i.quantity,
            })),
            { storeSlug: slug }
          );
          clearCart();
          closeCart();
          toast.success("Venta guardada en este dispositivo. Se sincronizará automáticamente cuando vuelva la conexión.", {
            duration: 5000,
          });
          if (onSaleCompleted) onSaleCompleted(saleUuid);
        } else {
          toast.error(stockCheck.error || "No se pudo verificar el stock local para guardar offline.");
        }
      }
    } catch (err: any) {
      if (!navigator.onLine || err?.code === "ERR_NETWORK") {
        const stockCheck = await validateOfflineStock(
          cart.map((i) => ({
            inventory_id: i.inventory_id,
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          { storeSlug: slug }
        );
        if (stockCheck.valid) {
          await queueOfflineSale(saleUuid, slug || "", shopId || "", salePayload);
          await decrementOfflineStock(
            cart.map((i) => ({
              inventory_id: i.inventory_id,
              product_id: i.product_id,
              quantity: i.quantity,
            })),
            { storeSlug: slug }
          );
          clearCart();
          closeCart();
          toast.success("Venta guardada en este dispositivo. Se sincronizará automáticamente cuando vuelva la conexión.", {
            duration: 5000,
          });
          if (onSaleCompleted) onSaleCompleted(saleUuid);
        } else {
          toast.error(stockCheck.error || "No se pudo verificar el stock local para guardar offline.");
        }
      } else {
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al procesar la venta.";
        setSaleErrorMessage(errorMsg);

        // Si es error de stock insuficiente o no disponible, volver al paso 1 para que el vendedor corrija
        const isStockError =
          errorMsg.toLowerCase().includes("stock") ||
          errorMsg.toLowerCase().includes("agotado") ||
          errorMsg.toLowerCase().includes("no se encuentra registrado");

        if (isStockError) {
          setActiveTab("cart");
          // Si hay slug, recargar catálogo de la tienda para actualizar existencias reales
          if (slug) {
            useStockStore.getState().getStoreProducts(slug);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Bloqueo total del scroll del fondo mientras el carrito esté abierto
  useEffect(() => {
    if (isCartModalOpen) {
      const mainEl = (document.getElementById("pos-main") || document.querySelector("main")) as HTMLElement | null;
      const prevBodyOverflow = document.body.style.overflow;
      const prevMainOverflow = mainEl?.style.overflow;

      document.body.style.overflow = "hidden";
      if (mainEl) mainEl.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prevBodyOverflow || "";
        if (mainEl) mainEl.style.overflow = prevMainOverflow || "";
      };
    }
  }, [isCartModalOpen]);

  // Hook de adaptación responsiva y gestión del teclado móvil
  const {
    viewportHeight,
    isKeyboardOpen,
    isMobile,
    prefersReducedMotion,
    containerRef,
    scrollToElement,
  } = useMobileKeyboardViewport({
    autoScrollOnFocus: true,
  });

  // Gesto táctil estilo Google Maps: arrastrar hacia abajo para cerrar
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  const handleDragTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
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
    if (dragOffsetY > 75) {
      closeCart();
    }
    setDragOffsetY(0);
  };

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

  return (
    <>
      <Modal
        isOpen={isCartModalOpen}
        onClose={closeCart}
        size="4xl"
        scrollBehavior="inside"
        placement={modalPlacement}
        hideCloseButton
        backdrop="opaque"
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
          backdrop: "bg-black/60 backdrop-blur-sm",
          base: [
            "bg-background border border-default-200 dark:border-default-100",
            "w-full max-w-full sm:max-w-4xl",
            "m-0 sm:my-auto",
            "overflow-hidden min-h-0",
            isMobile
              ? (isKeyboardOpen
                ? "rounded-none max-h-full h-full"
                : "rounded-t-[28px] rounded-b-none sm:rounded-2xl max-h-[92dvh] sm:max-h-[90vh]")
              : "rounded-2xl sm:max-h-[90vh]",
            "shadow-2xl",
          ].join(" "),
          header: "border-b border-default-200 dark:border-default-100 pb-2.5 sm:pb-3 px-3.5 sm:px-6 shrink-0",
          body: "p-3 sm:p-5 flex flex-col gap-3 overflow-y-auto overscroll-contain min-h-0",
          footer: "border-t border-default-200 dark:border-default-100 pt-2.5 sm:pt-3 bg-default-50/60 dark:bg-default-100/20 shrink-0",
        }}
      >
        <ModalContent style={modalStyle}>
          {() => (
            <div ref={containerRef} className="flex flex-col h-full w-full min-h-0 overflow-hidden">
              {/* Indicador visual de bottom sheet (affordance estilo Google Maps) */}
              <div
                className="sm:hidden w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
                onTouchStart={handleDragTouchStart}
                onTouchMove={handleDragTouchMove}
                onTouchEnd={handleDragTouchEnd}
                onClick={closeCart}
                title="Deslizar hacia abajo o tocar para cerrar"
              >
                <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
              </div>

              {/* ENCABEZADO */}
              <ModalHeader
                className="flex items-center justify-between gap-2 pt-1 sm:pt-2 select-none"
                onTouchStart={handleDragTouchStart}
                onTouchMove={handleDragTouchMove}
                onTouchEnd={handleDragTouchEnd}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 flex-wrap leading-tight">
                      <span className="sm:hidden">Caja</span>
                      <span className="hidden sm:inline">Caja &amp; Punto de Venta</span>
                      <Chip size="sm" color="success" variant="flat" className="font-semibold text-xs h-5">
                        {cart.length} prod. • {totalUnits} u.
                      </Chip>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-default-500 font-normal truncate">
                      Revisa bien antes de cobrar
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {cart.length > 0 && (
                    <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-xl bg-default-100/70 dark:bg-default-50/40 border border-default-200">
                      <span className="text-[9px] uppercase font-bold text-default-400">Subtotal</span>
                      <span className="text-xs font-black text-foreground font-mono">
                        <PriceDisplay amount={subtotal} />
                      </span>
                    </div>
                  )}
                  {cart.length > 0 && (
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={clearCart}
                      startContent={<FaTrash className="text-xs" />}
                      className="text-xs font-semibold text-danger shrink-0 h-8 px-2.5"
                    >
                      Vaciar
                    </Button>
                  )}
                  {/* Botón de cierre con X explícito */}
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    aria-label="Cerrar carrito"
                    onPress={closeCart}
                    className="h-8 w-8 min-w-8 bg-default-100 dark:bg-default-100/50 text-default-500 hover:text-foreground active:scale-95 transition-all"
                  >
                    <FaXmark size={15} />
                  </Button>
                </div>
              </ModalHeader>

              {/* CUERPO DEL MODAL CON TABS PRINCIPALES Y GESTOS TÁCTILES */}
              <ModalBody
                onTouchStart={handleSwipeTouchStart}
                onTouchEnd={handleSwipeTouchEnd}
                className="p-1 sm:p-3 flex flex-col gap-2 overflow-y-auto overscroll-contain"
              >
                {/* BANNER DE ERROR DESTACADO (SI LA VENTA O EL STOCK FALLÓ) */}
                {saleErrorMessage && (
                  <div className="p-1.5 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-900 dark:text-danger-200 flex items-start justify-between gap-2 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-xl bg-danger-500/20 text-danger-600 dark:text-danger-400 mt-0.5 shrink-0">
                        <FaTriangleExclamation size={16} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-xs">Error al procesar la venta</span>
                        <p className="text-[11px] leading-snug text-danger-700 dark:text-danger-300 font-medium">
                          {saleErrorMessage}
                        </p>
                        <span className="text-[10px] text-default-500">
                          {saleErrorMessage.toLowerCase().includes("stock") || saleErrorMessage.toLowerCase().includes("agotado")
                            ? "Ajusta las cantidades o retira del carrito el producto agotado antes de volver a confirmar."
                            : "Verifica los datos e inténtalo nuevamente. El carrito sigue disponible."}
                        </span>
                      </div>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      className="h-7 w-7 min-w-7 rounded-lg shrink-0"
                      onPress={() => setSaleErrorMessage(null)}
                    >
                      <FaXmark size={14} />
                    </Button>
                  </div>
                )}

                <Tabs
                  aria-label="Navegación del carrito"
                  selectedKey={activeTab}
                  onSelectionChange={(k) => {
                    setSaleErrorMessage(null);
                    setActiveTab(k as string);
                  }}
                  color="primary"
                  variant="bordered"
                  size="md"
                  classNames={{
                    tabList: "w-full bg-default-100/80 dark:bg-default-50/40 p-1 rounded-2xl border border-default-200",
                    tab: "font-bold text-xs sm:text-sm rounded-xl transition-all",
                  }}
                >
                  {/* PESTAÑA 1: PRODUCTOS & ESCÁNER */}
                  <Tab
                    key="cart"
                    title={
                      <div className="flex items-center gap-1">
                        <span>1. Productos</span>
                        {cart.length > 0 && (
                          <Chip size="sm" color="primary" variant="flat" className="font-extrabold text-[10px] h-5 px-1.5 ml-0.5">
                            {cart.length}
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <div className="flex flex-col gap-1">
                      {/* BARRA DE ESCANEO Y ACCIONES RÁPIDAS */}
                      <div className="p-1rounded-2xl bg-default-100/60 dark:bg-default-50/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <form
                          onSubmit={handleSubmitManualCode}
                          className="flex-1 flex items-center gap-2"
                        >
                          <Input
                            ref={manualInputRef}
                            size="sm"
                            variant="bordered"
                            placeholder="Escanear código de barras o escribir SKU..."
                            value={manualCodeInput}
                            onValueChange={setManualCodeInput}
                            startContent={<FaBarcode className="text-default-400 text-sm" />}
                            classNames={{
                              inputWrapper: "bg-background border-default-200 shadow-none h-9",
                            }}
                          />
                          <Button
                            size="sm"
                            color="primary"
                            type="submit"
                            isLoading={isResolvingScan}
                            isDisabled={!manualCodeInput.trim() || isResolvingScan}
                            className="h-9 px-4 font-semibold text-xs shrink-0"
                          >
                            Agregar
                          </Button>
                        </form>

                        {/* Botón de alternancia de escáner de cámara */}
                        <Button
                          size="sm"
                          variant={showCameraScanner ? "solid" : "flat"}
                          color={showCameraScanner ? "danger" : "secondary"}
                          startContent={showCameraScanner ? <FaXmark /> : <FaCamera />}
                          onPress={() => setShowCameraScanner(!showCameraScanner)}
                          className="h-9 font-semibold text-xs shrink-0"
                        >
                          {showCameraScanner ? "Ocultar Cámara" : "Escanear con Cámara"}
                        </Button>
                      </div>

                      {/* VISOR DE CÁMARA EMBEBIDO (COLAPSABLE) */}
                      {showCameraScanner && (
                        <div className="relative rounded-2xl border-2 border-primary/40 bg-black/90 p-3 flex flex-col items-center gap-2.5 overflow-hidden transition-all duration-300">
                          <div className="w-full flex items-center justify-between text-white text-xs font-semibold px-1">
                            <span className="flex items-center gap-1.5 text-primary-400">
                              <FaBarcode /> Enfoque el código con la cámara
                            </span>
                            <div className="flex items-center gap-2">
                              {hasTorch && isCameraActive && (
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant={isTorchOn ? "solid" : "flat"}
                                  color={isTorchOn ? "warning" : "default"}
                                  className="h-7 w-7 text-xs"
                                  onPress={toggleTorch}
                                  title="Linterna"
                                >
                                  <FaLightbulb />
                                </Button>
                              )}
                              {cameras.length > 1 && isCameraActive && (
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="flat"
                                  className="h-7 w-7 text-xs text-white"
                                  onPress={handleToggleFlipCamera}
                                  title="Cambiar cámara"
                                >
                                  <FaRotate />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                isIconOnly
                                variant="flat"
                                color="danger"
                                className="h-7 w-7 text-xs"
                                onPress={() => setShowCameraScanner(false)}
                                title="Cerrar"
                              >
                                <FaXmark />
                              </Button>
                            </div>
                          </div>

                          {/* Contenedor del Lector HTML5 */}
                          <div onClick={scanner.focusOnTap} className="w-full max-w-sm rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center relative">
                            <div
                              ref={scanner.containerRef}
                              id={scannerContainerId}
                              className="w-full h-full [&_video]:object-contain [&_video]:w-full [&_video]:h-full"
                            />
                            <CameraFocusIndicator point={scanner.focusPoint} onDone={scanner.clearFocus} />
                            {!isCameraActive && !scannerError && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-default-400 text-xs">
                                <Spinner size="sm" color="primary" />
                                <span>Activando cámara...</span>
                              </div>
                            )}
                            {scannerError && (
                              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center gap-2 bg-black/85 text-danger text-xs">
                                <span>{scannerError}</span>
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => startCameraScanner(selectedCameraId)}
                                >
                                  Reintentar
                                </Button>
                              </div>
                            )}
                          </div>

                          {scanner.warning && <p role="status" className="text-xs text-warning">{scanner.warning.message}</p>}
                          <p className="text-[10px] text-default-400 text-center">
                            Centra el código y acerca o aleja el teléfono para enfocar. Los códigos leídos se añadirán automáticamente al carrito.
                          </p>
                        </div>
                      )}

                      {/* LISTA SCROLLEABLE DE PRODUCTOS */}
                      {cart.length === 0 ? (
                        <div className="py-12 px-4 text-center text-default-400 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-default-200 rounded-2xl bg-default-50/40">
                          <div className="p-3.5 rounded-full bg-default-100 text-default-400">
                            <FaStore className="text-3xl" />
                          </div>
                          <div className="flex flex-col gap-1 max-w-xs">
                            <span className="font-bold text-sm text-foreground">El carrito está vacío</span>
                            <p className="text-xs text-default-500">
                              Escanea un código de barras arriba o agrega productos desde la tienda.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-default-200 rounded-2xl overflow-hidden bg-background shadow-xs">
                          {/* Cabecera de columnas para modo PC/Tablet */}
                          <div className="hidden sm:flex items-center justify-between px-3.5 py-2 bg-default-100/70 dark:bg-default-50/40 border-b border-default-200 text-[10px] font-bold uppercase tracking-wider text-default-500">
                            <span className="flex-1">Producto</span>
                            <span className="w-24 text-right pr-2">Precio Unit.</span>
                            <span className="w-28 text-center">Cantidad</span>
                            <span className="w-24 text-right pr-2">Subtotal</span>
                            <span className="w-8"></span>
                          </div>

                          {/* Contenedor scrolleable: Todo en UNA sola fila horizontal compacta y elegante */}
                          <div className="max-h-[50vh] sm:max-h-[56vh] overflow-y-auto divide-y divide-default-100">
                            {cart.map((item) => (
                              <div
                                key={item.inventory_id}
                                className="p-3 hover:bg-default-50/70 transition-colors grid grid-cols-[56px_minmax(0,1fr)_auto] sm:flex sm:items-center sm:justify-between gap-2 sm:gap-3"
                              >
                                {/* 1. Miniatura + Nombre + Stock */}
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 col-span-2 sm:col-span-1">
                                  <img
                                    src={
                                      getImageUrl(item.thumbnail) ||
                                      "/favicon.ico"
                                    }
                                    alt={item.name}
                                    className="w-9 h-9 sm:w-10 sm:h-10 object-cover rounded-xl border border-default-200 shrink-0 bg-default-100"
                                    onError={(e: any) => {
                                      e.target.src = "/favicon.ico";
                                    }}
                                  />
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span
                                      className="font-bold text-xs sm:text-sm text-foreground truncate"
                                      title={item.name}
                                    >
                                      {item.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-default-400">
                                      {item.sku && <span className="font-mono">{item.sku}</span>}
                                      {item.sku && <span>•</span>}
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Disp: {item.stock_quantity} {item.unit}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {/* 2. Precio Unitario (NO EDITABLE, VISIBLE Y CLARO) */}
                                <div className="flex">
                                  <div className="hidden sm:flex flex-col items-end shrink-0 sm:w-24 text-right pr-0 sm:pr-2">
                                    <span className="text-[9px] uppercase font-bold text-default-400 sm:hidden">
                                      Unit.
                                    </span>
                                    <span className="text-xs sm:text-sm font-semibold text-default-700 font-mono">
                                      <PriceDisplay amount={item.price} />
                                    </span>
                                  </div>

                                  {/* 3. Stepper de Cantidad Compacto */}
                                  <div className="inline-flex items-center gap-0.5 sm:gap-0 bg-default-100 dark:bg-default-50/80 rounded-xl p-0.5 border border-default-200 shrink-0 sm:justify-center col-start-2 sm:col-auto justify-self-start">
                                    <Button
                                      size="sm"
                                      isIconOnly
                                      variant="light"
                                      className="h-6 w-6 min-w-6"
                                      isDisabled={item.quantity <= 0.001}
                                      onPress={() => updateQty(item.inventory_id, Math.max(0.001, +(item.quantity - 1).toFixed(3)))}
                                      title="Disminuir"
                                    >
                                      <FaMinus className="text-[9px]" />
                                    </Button>
                                    <input
                                      type="number"
                                      step="any"
                                      min={0.001}
                                      max={item.stock_quantity}
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = parseDecimalInput(e.target.value);
                                        updateQty(item.inventory_id, isNaN(val) ? 0 : val);
                                      }}
                                      className="w-10 sm:w-12 text-center text-xs font-bold bg-transparent focus:outline-none text-foreground"
                                    />
                                    <Button
                                      size="sm"
                                      isIconOnly
                                      variant="light"
                                      className="h-6 w-6 min-w-6"
                                      isDisabled={item.quantity >= item.stock_quantity}
                                      onPress={() => updateQty(item.inventory_id, Math.min(item.stock_quantity, +(item.quantity + 1).toFixed(3)))}
                                      title="Aumentar"
                                    >
                                      <FaPlus className="text-[9px]" />
                                    </Button>
                                  </div>

                                  {/* 4. Subtotal */}
                                  <div className="flex flex-col items-end shrink-0 sm:w-24 text-right pr-0 sm:pr-2 col-start-3 row-start-2 sm:col-auto sm:row-auto mt-1 sm:mt-0">

                                    <span className="font-extrabold text-xs sm:text-sm text-foreground font-mono">

                                      <PriceDisplay amount={item.price * item.quantity} />
                                    </span>

                                  </div>
                                  {/* 5. Botón Quitar */}
                                  <Button
                                    size="sm"
                                    isIconOnly
                                    variant="flat"
                                    color="danger"
                                    className="h-7 w-7 min-w-7 text-danger shrink-0 sm:w-8"
                                    onPress={() => removeItem(item.inventory_id)}
                                    title="Eliminar"
                                  >
                                    <FaTimes className="text-xs" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Tab>

                  {/* PESTAÑA 2: CLIENTE, PAGO & LIQUIDACIÓN */}
                  <Tab
                    key="checkout"
                    title={
                      <div className="flex items-center gap-2">
                        <span>2. Cliente &amp; Pago</span>
                      </div>
                    }
                    isDisabled={cart.length === 0}
                  >
                    <div className="flex flex-col gap-3.5 pt-2 max-h-[60vh] sm:max-h-[62vh] overflow-y-auto pr-1">
                      {/* 1. SECCIÓN CLIENTE (Sub-tabs limpias) */}
                      {enableCustomers && (
                        <div className="bg-default-100/60 dark:bg-default-50/40 p-3 rounded-2xl border border-default-200 flex flex-col gap-2">
                          <span className="text-[11px] font-bold text-default-600 uppercase tracking-wider flex items-center gap-1.5">
                            <FaUser className="text-xs" /> Datos del Cliente
                          </span>
                          <Tabs
                            aria-label="Tipo de cliente"
                            size="sm"
                            selectedKey={customerTab}
                            onSelectionChange={(k) => setCustomerTab(k as string)}
                            color="primary"
                            variant="underlined"
                          >
                            <Tab key="quick" title="Venta Mostrador / Rápida">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                                <Input
                                  size="sm"
                                  variant="bordered"
                                  label="Nombre del Cliente"
                                  placeholder="Juan Perez"
                                  value={inputName}
                                  onValueChange={setInputName}
                                  classNames={{ inputWrapper: "bg-background shadow-none h-9" }}
                                />
                                <Input
                                  size="sm"
                                  variant="bordered"
                                  label="Teléfono (Opcional)"
                                  placeholder="Ej. 70012345"
                                  value={inputPhone}
                                  onValueChange={setInputPhone}
                                  classNames={{ inputWrapper: "bg-background shadow-none h-9" }}
                                />
                              </div>
                            </Tab>

                            <Tab key="registered" title="Cliente Registrado">
                              <div className="pt-2">
                                <Select
                                  aria-label="Buscar cliente en el sistema"
                                  size="sm"
                                  variant="bordered"
                                  placeholder="Buscar cliente en el sistema..."
                                  selectedKeys={selectedCustomer ? [selectedCustomer] : []}
                                  onChange={(e) => setSelectedCustomer(e.target.value)}
                                  classNames={{ trigger: "bg-background shadow-none h-9" }}
                                >
                                  {customers.map((c) => {
                                    const doc = c.document_number || c.cinit;
                                    return (
                                      <SelectItem key={c.id} value={c.id} textValue={`${c.name} ${doc ? `(${doc})` : ''}`}>
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-xs text-foreground">{c.name}</span>
                                          <div className="flex items-center gap-2 text-[10px] text-default-400">
                                            {doc && (
                                              <span>Doc: {doc}{c.document_complement ? `-${c.document_complement}` : ''}</span>
                                            )}
                                            {c.phone && <span>📞 {c.phone}</span>}
                                          </div>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </Select>
                              </div>
                            </Tab>
                          </Tabs>
                        </div>
                      )}

                      {/* 2. FORMA DE PAGO */}
                      {enablePayment && (
                        <div className="bg-default-100/60 dark:bg-default-50/40 p-2.5 rounded-2xl border border-default-200 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-default-600 uppercase tracking-wider flex items-center gap-1.5">
                              <FaMoneyBillWave className="text-xs" /> Método de Pago
                            </span>
                            <Button
                              size="sm"
                              variant="flat"
                              color={isSplitPayment ? "secondary" : "default"}
                              className="h-6 text-[10px] font-semibold px-2.5"
                              onPress={() => setIsSplitPayment(!isSplitPayment)}
                            >
                              {isSplitPayment ? "← Pago Único" : "Dividir Pago"}
                            </Button>
                          </div>

                          {!isSplitPayment ? (
                            <>
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  size="sm"
                                  variant={paymentMethod === "efectivo" ? "solid" : "bordered"}
                                  color={paymentMethod === "efectivo" ? "success" : "default"}
                                  startContent={<FaMoneyBillWave />}
                                  onPress={() => setPaymentMethod("efectivo")}
                                  className="font-bold text-xs h-10"
                                >
                                  Efectivo
                                </Button>
                                <Button
                                  size="sm"
                                  variant={paymentMethod === "tarjeta" ? "solid" : "bordered"}
                                  color={paymentMethod === "tarjeta" ? "primary" : "default"}
                                  startContent={<FaCreditCard />}
                                  onPress={() => setPaymentMethod("tarjeta")}
                                  className="font-bold text-xs h-10"
                                >
                                  Tarjeta
                                </Button>
                                <Button
                                  size="sm"
                                  variant={paymentMethod === "qr" ? "solid" : "bordered"}
                                  color={paymentMethod === "qr" ? "secondary" : "default"}
                                  startContent={<FaQrcode />}
                                  onPress={() => setPaymentMethod("qr")}
                                  className="font-bold text-xs h-10"
                                >
                                  QR / Transf.
                                </Button>
                              </div>

                              {/* Monto recibido & cálculo de vuelto si es efectivo */}
                              {paymentMethod === "efectivo" && (
                                <div className="flex flex-col gap-2 pt-1">
                                  <Input
                                    size="sm"
                                    variant="bordered"
                                    label="Efectivo Recibido"
                                    placeholder="0.00"
                                    type="number"
                                    step="any"
                                    startContent={<span className="text-default-400 text-xs">{currencySymbol || ""}</span>}
                                    value={cashReceived}
                                    onValueChange={setCashReceived}
                                    classNames={{ inputWrapper: "bg-background shadow-none h-10" }}
                                  />
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      className="h-7 text-[11px] font-semibold"
                                      onPress={() => setCashReceived(total.toString())}
                                    >
                                      Monto Exacto (<PriceDisplay amount={total} />)
                                    </Button>
                                    {total > 0 && (
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        className="h-7 text-[11px] font-semibold"
                                        onPress={() => setCashReceived((Math.ceil(total / 10) * 10).toString())}
                                      >
                                        Redondeo (<PriceDisplay amount={Math.ceil(total / 10) * 10} decimals={0} />)
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-2.5 pt-1">
                              <div className="flex items-center justify-between px-2.5 py-1.5 bg-default-200/50 dark:bg-default-100/30 rounded-xl text-xs">
                                <span className="font-semibold text-default-600">Total: <strong className="text-foreground"><PriceDisplay amount={total} /></strong></span>
                                <span className="font-semibold text-default-600">Asignado: <strong className={Math.abs(splitTotal - total) < 0.01 ? "text-success-600" : "text-warning-600"}><PriceDisplay amount={splitTotal} /></strong></span>
                                <span className="font-semibold text-default-600">
                                  Restante: <strong className={Math.abs(splitTotal - total) < 0.01 ? "text-success-600" : "text-danger-500"}><PriceDisplay amount={Math.max(0, total - splitTotal)} /></strong>
                                </span>
                              </div>

                              <div className="flex flex-col gap-2">
                                {splitPayments.map((p, idx) => {
                                  const pAmt = parseFloat(p.amount) || 0;
                                  const pRec = parseFloat(p.received) || 0;
                                  const pChg = p.method === "efectivo" && pRec > pAmt ? pRec - pAmt : 0;

                                  return (
                                    <div key={p.id} className="p-2.5 rounded-xl border border-default-200 bg-background flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <Select
                                          aria-label="Método de pago"
                                          size="sm"
                                          variant="bordered"
                                          selectedKeys={[p.method]}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) return;
                                            setSplitPayments((prev) =>
                                              prev.map((item, i) => (i === idx ? { ...item, method: val } : item))
                                            );
                                          }}
                                          className="w-36 shrink-0"
                                          classNames={{ trigger: "h-8 min-h-8 text-xs" }}
                                        >
                                          <SelectItem key="efectivo" value="efectivo">Efectivo</SelectItem>
                                          <SelectItem key="qr" value="qr">QR</SelectItem>
                                          <SelectItem key="tarjeta" value="tarjeta">Tarjeta</SelectItem>
                                          <SelectItem key="transferencia" value="transferencia">Transferencia</SelectItem>
                                        </Select>

                                        <Input
                                          size="sm"
                                          variant="bordered"
                                          placeholder="Monto"
                                          type="number"
                                          step="any"
                                          min={0}
                                          value={p.amount}
                                          onValueChange={(val) => {
                                            setSplitPayments((prev) =>
                                              prev.map((item, i) => (i === idx ? { ...item, amount: val } : item))
                                            );
                                          }}
                                          startContent={<span className="text-default-400 text-xs">{currencySymbol || ""}</span>}
                                          classNames={{ inputWrapper: "h-8 min-h-8 text-xs bg-background" }}
                                        />

                                        {splitPayments.length > 1 && (
                                          <Button
                                            size="sm"
                                            isIconOnly
                                            variant="light"
                                            color="danger"
                                            className="h-8 w-8 min-w-8"
                                            onPress={() => {
                                              setSplitPayments((prev) => prev.filter((_, i) => i !== idx));
                                            }}
                                            title="Eliminar fila"
                                          >
                                            <FaTimes className="text-xs" />
                                          </Button>
                                        )}
                                      </div>

                                      {p.method === "efectivo" && (
                                        <div className="flex items-center gap-2 pl-1">
                                          <Input
                                            size="sm"
                                            variant="bordered"
                                            placeholder="Efectivo Recibido"
                                            type="number"
                                            step="any"
                                            value={p.received}
                                            onValueChange={(val) => {
                                              setSplitPayments((prev) =>
                                                prev.map((item, i) => (i === idx ? { ...item, received: val } : item))
                                              );
                                            }}
                                            classNames={{ inputWrapper: "h-7 min-h-7 text-xs bg-background" }}
                                          />
                                          {pChg > 0 && (
                                            <span className="text-[11px] font-bold text-success-600 shrink-0">
                                              Cambio: <PriceDisplay amount={pChg} />
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {p.method !== "efectivo" && (
                                        <Input
                                          size="sm"
                                          variant="bordered"
                                          placeholder="Nro. referencia / comprobante (opcional)"
                                          value={p.reference}
                                          onValueChange={(val) => {
                                            setSplitPayments((prev) =>
                                              prev.map((item, i) => (i === idx ? { ...item, reference: val } : item))
                                            );
                                          }}
                                          classNames={{ inputWrapper: "h-7 min-h-7 text-xs bg-background" }}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  className="h-7 text-[11px] font-semibold"
                                  startContent={<FaPlus className="text-[9px]" />}
                                  onPress={() => {
                                    const remaining = Math.max(0, +(total - splitTotal).toFixed(2));
                                    setSplitPayments((prev) => [
                                      ...prev,
                                      {
                                        id: String(Date.now()),
                                        method: prev.some((x) => x.method === "qr") ? "tarjeta" : "qr",
                                        amount: remaining > 0 ? String(remaining) : "",
                                        received: "",
                                        reference: "",
                                      },
                                    ]);
                                  }}
                                >
                                  Agregar método
                                </Button>

                                {total > 0 && Math.abs(splitTotal - total) > 0.01 && (
                                  <Button
                                    size="sm"
                                    variant="light"
                                    color="warning"
                                    className="h-7 text-[11px] font-semibold"
                                    onPress={() => {
                                      const diff = +(total - splitTotal).toFixed(2);
                                      if (diff > 0 && splitPayments.length > 0) {
                                        const lastIdx = splitPayments.length - 1;
                                        const currentAmt = parseFloat(splitPayments[lastIdx].amount) || 0;
                                        setSplitPayments((prev) =>
                                          prev.map((p, i) =>
                                            i === lastIdx ? { ...p, amount: String(+(currentAmt + diff).toFixed(2)) } : p
                                          )
                                        );
                                      }
                                    }}
                                  >
                                    Completar restante
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. MÁS OPCIONES (ACCORDION DINÁMICO) */}
                      {(enableDiscount || enableObservations) && (
                        <Accordion variant="bordered" className="px-0 border-default-200 rounded-2xl">
                          <AccordionItem
                            key="more_options"
                            aria-label="Más opciones"
                            title={
                              <span className="text-xs font-semibold text-default-600 flex items-center gap-2">
                                <FaSliders className="text-primary text-xs" />
                                <span>Más opciones ({[enableDiscount && "Descuento", enableObservations && "Observaciones"].filter(Boolean).join(" y ")})</span>
                                {enableDiscount && discountVal > 0 && (
                                  <Chip size="sm" color="warning" variant="flat" className="text-[10px] h-5">
                                    Descuento aplicado
                                  </Chip>
                                )}
                                {enableObservations && observation.trim() && (
                                  <Chip size="sm" color="secondary" variant="flat" className="text-[10px] h-5">
                                    Nota agregada
                                  </Chip>
                                )}
                              </span>
                            }
                            subtitle="Haz clic aquí para desplegar las opciones avanzadas"
                            classNames={{
                              title: "text-xs font-semibold",
                              subtitle: "text-[10px] text-default-400",
                              content: "pt-1 pb-3 flex flex-col gap-3",
                            }}
                          >
                            {/* Campo Descuento */}
                            {enableDiscount && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-default-500 uppercase">
                                  Descuento Monetario ({currencySymbol || "$"})
                                </span>
                                <div className="flex items-center gap-2">
                                  <Input
                                    size="sm"
                                    variant="bordered"
                                    type="number"
                                    step="any"
                                    min={0}
                                    placeholder="0.00"
                                    value={inputDiscount}
                                    onValueChange={setInputDiscount}
                                    startContent={<FaTag className="text-default-400 text-xs" />}
                                    classNames={{ inputWrapper: "bg-background shadow-none h-9" }}
                                  />
                                  {subtotal > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        className="h-8 text-[10px] font-bold px-2"
                                        onPress={() => setInputDiscount((subtotal * 0.05).toFixed(2))}
                                      >
                                        5%
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        className="h-8 text-[10px] font-bold px-2"
                                        onPress={() => setInputDiscount((subtotal * 0.1).toFixed(2))}
                                      >
                                        10%
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Campo Observación */}
                            {enableObservations && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold text-default-500 uppercase">
                                  Observación / Nota Interna
                                </span>
                                <Textarea
                                  size="sm"
                                  variant="bordered"
                                  placeholder="Ej. Factura requerida, entrega diferida, pedido pagado por partes..."
                                  minRows={2}
                                  maxRows={4}
                                  value={observation}
                                  onValueChange={setObservation}
                                  classNames={{ inputWrapper: "bg-background shadow-none" }}
                                />
                              </div>
                            )}
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>
                  </Tab>
                </Tabs>
              </ModalBody>

              {/* PIE DE PÁGINA FIJO CON SUBTOTAL Y ACCIONES */}
              <ModalFooter
                style={footerStyle}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-default-100/60 dark:bg-default-50/30 px-4 py-2.5 border-t border-default-200"
              >
                {/* DATO SUBTOTAL FIJO EN SU LUGAR DESTACADO */}
                <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-default-400 tracking-wider">
                      Subtotal ({totalUnits} {totalUnits === 1 ? "ud." : "uds."})
                    </span>
                    <span className="text-lg sm:text-xl font-black text-foreground font-mono">
                      <PriceDisplay amount={subtotal} />
                    </span>
                  </div>
                  {paymentMethod === "efectivo" && cashReceivedVal > 0 && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-default-400 font-bold uppercase tracking-wider">
                        Cambio / Vuelto
                      </span>
                      <span
                        className={`text-lg sm:text-xl font-black ${changeVal >= 0 && cashReceivedVal >= total
                          ? "text-success-600 dark:text-success-400"
                          : "text-danger-500"
                          }`}
                      >
                        <PriceDisplay amount={changeVal} />
                      </span>
                    </div>
                  )}
                  {enableDiscount && discountVal > 0 && (
                    <div className="flex justify-between items-center text-xs text-danger font-semibold">
                      <span>Descuento aplicado:</span>
                      <span>- <PriceDisplay amount={discountVal} /></span>
                    </div>
                  )}

                  {discountVal > 0 && (
                    <div className="flex flex-col border-l border-default-200 pl-3">
                      <span className="text-[10px] uppercase font-bold text-warning-600 dark:text-warning-400 tracking-wider">
                        Total c/ Descuento
                      </span>
                      <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        <PriceDisplay amount={total} />
                      </span>
                    </div>
                  )}
                </div>

                {/* ACCIONES DE NAVEGACIÓN Y COBRO */}
                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                  {activeTab === "checkout" ? (
                    <Button
                      variant="flat"
                      size="sm"
                      startContent={<FaArrowLeft className="text-xs" />}
                      onPress={() => setActiveTab("cart")}
                      className="text-xs font-semibold"
                    >
                      Volver a Productos
                    </Button>
                  ) : (
                    <Button
                      variant="light"
                      size="sm"
                      onPress={closeCart}
                      isDisabled={isLoading}
                      className="text-xs font-semibold"
                    >
                      Seguir Agregando
                    </Button>
                  )}

                  {activeTab === "cart" ? (
                    <Button
                      color="primary"
                      size="md"
                      className="font-bold text-white px-5 sm:px-6 shadow-xs text-xs sm:text-sm"
                      endContent={<FaArrowRight className="text-xs" />}
                      onPress={() => setActiveTab("checkout")}
                      isDisabled={cart.length === 0}
                    >
                      Ir al Pago
                    </Button>
                  ) : (
                    <Button
                      color="success"
                      size="md"
                      className="font-bold text-white px-6 sm:px-7 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm"
                      isLoading={isLoading}
                      spinner={<Spinner color="white" size="sm" />}
                      startContent={!isLoading && <FaCircleCheck />}
                      onPress={handleRequestConfirmation}
                      isDisabled={cart.length === 0}
                    >
                      Confirmar Venta
                    </Button>
                  )}
                </div>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* MODAL DE CONFIRMACIÓN DE VENTA (SÍ / NO) */}
      <Modal
        isOpen={isConfirmSaleOpen}
        onClose={() => setIsConfirmSaleOpen(false)}
        size="md"
        placement="center"
        backdrop="blur"
        classNames={{
          base: "bg-background border border-default-200 dark:border-default-100 shadow-2xl z-[9999]",
          header: "border-b border-default-100 pb-2.5",
          footer: "border-t border-default-100 pt-2.5 bg-default-50/50 dark:bg-default-100/20",
        }}
      >
        <ModalContent>
          {(onCloseConfirm) => (
            <>
              <ModalHeader className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <FaCircleCheck className="text-xl" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    ¿Confirmar y Registrar Venta?
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    Revisa los datos antes de emitir la orden
                  </p>
                </div>
              </ModalHeader>

              <ModalBody className="py-4 flex flex-col gap-3">
                <div className="p-3.5 rounded-2xl bg-default-100/70 dark:bg-default-50/40 border border-default-200 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-default-500 font-medium">Cliente:</span>
                    <span className="font-bold text-foreground truncate max-w-[200px]">
                      {customerTab === "quick"
                        ? inputName.trim() || "Cliente"
                        : customers.find((c) => String(c.id) === String(selectedCustomer))?.name || "Cliente Registrado"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-default-500 font-medium">Forma de Pago:</span>
                    <span className="font-bold text-foreground">
                      {paymentMethod === "efectivo"
                        ? "Efectivo"
                        : paymentMethod === "tarjeta"
                          ? "Tarjeta"
                          : "QR / Transferencia"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-default-500 font-medium">Productos:</span>
                    <span className="font-bold text-foreground">
                      {cart.length} ({totalUnits} unidades)
                    </span>
                  </div>

                  <Divider className="my-0.5" />

                  <div className="flex justify-between items-end pt-1">
                    <span className="text-xs font-bold text-default-600 uppercase">
                      Total a Cobrar:
                    </span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      <PriceDisplay amount={total} />
                    </span>
                  </div>

                  {paymentMethod === "efectivo" && cashReceivedVal > 0 && (
                    <div className="flex justify-between items-center text-xs text-success-600 dark:text-success-400 font-bold border-t border-default-200 pt-1.5 mt-0.5">
                      <span>Cambio a Entregar:</span>
                      <span className="text-sm font-mono font-black">
                        <PriceDisplay amount={changeVal} />
                      </span>
                    </div>
                  )}
                </div>
              </ModalBody>

              <ModalFooter className="flex justify-end items-center gap-2">
                <Button
                  color="default"
                  variant="light"
                  size="sm"
                  onPress={onCloseConfirm}
                  isDisabled={isLoading}
                  className="font-semibold text-xs"
                >
                  No, revisar
                </Button>
                <Button
                  color="success"
                  size="md"
                  className="font-bold text-white px-5 bg-emerald-600 hover:bg-emerald-700 shadow-sm text-xs sm:text-sm"
                  isLoading={isLoading}
                  spinner={<Spinner color="white" size="sm" />}
                  startContent={!isLoading && <FaCircleCheck />}
                  onPress={handleCheckout}
                >
                  Sí, Confirmar Venta
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default CartModal;
