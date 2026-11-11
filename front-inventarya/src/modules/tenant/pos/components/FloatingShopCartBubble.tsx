import React, { useState, useEffect, useRef } from "react";
import { FaShoppingCart } from "react-icons/fa";
import { useShopCartStore } from "../store/cart/shop-cart.store";
import { PriceDisplay } from "@/components/ui/PriceDisplay";

const BUBBLE_SIZE = 60; // 60px diameter
const EDGE_MARGIN = 14; // margin from screen edge
const MIN_TOP_OFFSET = 65; // keep below top navigation bar

export const FloatingShopCartBubble: React.FC = () => {
  const totalUnits = useShopCartStore((state) => state.totalUnits);
  const totalAmount = useShopCartStore((state) => state.totalAmount);
  const totalItemsCount = useShopCartStore((state) => state.totalItemsCount);
  const isCartModalOpen = useShopCartStore((state) => state.isCartModalOpen);
  const openCart = useShopCartStore((state) => state.openCart);

  const bubbleRef = useRef<HTMLDivElement>(null);

  // Calcula la posición magnética al borde más cercano (estilo Messenger Chat Head)
  const calculateMagneticDock = (
    rawX: number,
    rawY: number
  ): { x: number; y: number; side: "left" | "right" } => {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 800;

    const clampedY = Math.max(MIN_TOP_OFFSET, Math.min(screenH - BUBBLE_SIZE - EDGE_MARGIN, rawY));
    const isLeft = rawX + BUBBLE_SIZE / 2 < screenW / 2;
    const snappedX = isLeft ? EDGE_MARGIN : screenW - BUBBLE_SIZE - EDGE_MARGIN;

    return {
      x: snappedX,
      y: clampedY,
      side: isLeft ? "left" : "right",
    };
  };

  // Posición inicial acoplada a la derecha
  const [dockedSide, setDockedSide] = useState<"left" | "right">("right");
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("pos_cart_bubble_dock");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            x: parsed.side === "left" ? EDGE_MARGIN : window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN,
            y: Math.max(MIN_TOP_OFFSET, Math.min(window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN, parsed.y || 420)),
          };
        } catch {}
      }
      return {
        x: Math.max(EDGE_MARGIN, window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN),
        y: Math.max(MIN_TOP_OFFSET, window.innerHeight - BUBBLE_SIZE - 95),
      };
    }
    return { x: 300, y: 500 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    hasMoved: false,
  });

  // Re-acoplar si la ventana cambia de tamaño
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const docked = calculateMagneticDock(prev.x, prev.y);
        setDockedSide(docked.side);
        return { x: docked.x, y: docked.y };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
      hasMoved: false,
    };

    setIsDragging(true);
    setIsSnapping(false);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;

      if (!dragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragRef.current.hasMoved = true;
      }

      if (dragRef.current.hasMoved) {
        const newX = dragRef.current.origX + dx;
        const newY = dragRef.current.origY + dy;

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const clampedX = Math.max(0, Math.min(screenW - BUBBLE_SIZE, newX));
        const clampedY = Math.max(20, Math.min(screenH - BUBBLE_SIZE, newY));

        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      setIsDragging(false);

      if (!dragRef.current.hasMoved) {
        openCart();
      } else {
        setIsSnapping(true);
        setPosition((curr) => {
          const docked = calculateMagneticDock(curr.x, curr.y);
          setDockedSide(docked.side);
          sessionStorage.setItem(
            "pos_cart_bubble_dock",
            JSON.stringify({ side: docked.side, y: docked.y })
          );
          return { x: docked.x, y: docked.y };
        });

        setTimeout(() => {
          setIsSnapping(false);
        }, 400);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // 1. Ocultar cuando no hay items o cuando el modal de cobro/carrito está abierto
  if (totalUnits === 0 || isCartModalOpen) {
    return null;
  }

  return (
    <div
      ref={bubbleRef}
      onPointerDown={handlePointerDown}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
        transition: isDragging
          ? "none"
          : "transform 0.42s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}
      className={`fixed top-0 left-0 z-[9990] select-none group ${
        isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105 active:scale-95"
      } ${isSnapping ? "pointer-events-none" : ""}`}
      role="button"
      tabIndex={0}
      title="Carrito de Venta - Arrastra a cualquier borde o haz clic para cobrar"
    >
      <div className="relative flex items-center justify-center">
        {/* Halo parpadeante / radar pulse */}
        {!isDragging && (
          <span className="absolute -inset-2 rounded-full bg-emerald-500/25 animate-ping pointer-events-none" />
        )}

        {/* Burbuja principal circular estilo Messenger con color sólido esmeralda */}
        <div
          className={`w-[60px] h-[60px] rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col items-center justify-center border-2 border-white/40 shadow-xl backdrop-blur-md transition-all duration-150 ${
            isDragging
              ? "shadow-2xl shadow-emerald-600/60 ring-4 ring-emerald/40 rotate-6"
              : "shadow-emerald-500/40 group-hover:shadow-emerald-500/60"
          }`}
        >
          <FaShoppingCart className="text-2xl animate-pulse drop-shadow-md" />
          <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-0.5 opacity-95">
            Caja
          </span>
        </div>

        {/* Badge flotante con unidades totales */}
        <div className="absolute -top-1.5 -right-1.5 bg-danger-500 text-white font-black text-[11px] leading-tight px-1.5 py-0.5 rounded-full border-2 border-white dark:border-default-900 shadow-lg flex items-center justify-center min-w-[22px] animate-bounce">
          {totalUnits}
        </div>

        {/* Tooltip contextual adaptativo según el lateral */}
        {!isDragging && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 hidden sm:group-hover:flex items-center gap-1.5 bg-foreground/90 text-background px-3 py-1.5 rounded-xl shadow-xl text-xs font-semibold whitespace-nowrap pointer-events-none transition-all duration-200 border border-default-200/20 backdrop-blur-md ${
              dockedSide === "right"
                ? "right-full mr-3 animate-in slide-in-from-right-2"
                : "left-full ml-3 animate-in slide-in-from-left-2"
            }`}
          >
            <span className="text-default-300">Carrito ({totalItemsCount} prod.):</span>
            <span className="text-emerald-300 font-bold">
              <PriceDisplay amount={totalAmount} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingShopCartBubble;
