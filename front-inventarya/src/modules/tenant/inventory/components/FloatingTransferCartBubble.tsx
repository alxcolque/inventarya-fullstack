import React, { useState, useEffect, useRef } from "react";
import { FaTruckFast } from "react-icons/fa6";
import { useStockMovementsStore } from "../store/movements/stock-movements.store";

interface FloatingTransferCartBubbleProps {
  onClick: () => void;
  isModalOpen?: boolean;
}

const BUBBLE_SIZE = 60; // 60px diameter
const EDGE_MARGIN = 14; // margin from screen edge
const MIN_TOP_OFFSET = 65; // keep below top navigation bar

export const FloatingTransferCartBubble: React.FC<FloatingTransferCartBubbleProps> = ({
  onClick,
  isModalOpen = false,
}) => {
  const cartItems = useStockMovementsStore((state) => state.cartItems);
  const totalCartUnits = useStockMovementsStore((state) => state.totalCartUnits);
  const totalCartItems = useStockMovementsStore((state) => state.totalCartItems);

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

  // Posición inicial acoplada a la derecha inferior
  const [dockedSide, setDockedSide] = useState<"left" | "right">("right");
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("transfer_bubble_dock");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            x: parsed.side === "left" ? EDGE_MARGIN : window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN,
            y: Math.max(MIN_TOP_OFFSET, Math.min(window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN, parsed.y || 400)),
          };
        } catch {}
      }
      return {
        x: Math.max(EDGE_MARGIN, window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN),
        y: Math.max(MIN_TOP_OFFSET, window.innerHeight - BUBBLE_SIZE - 90),
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

  // Re-acoplar magnéticamente si la ventana cambia de tamaño
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
    // Solo botón primario del ratón o pantalla táctil
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

      // Umbral mínimo de movimiento para considerar arrastre vs tap/clic
      if (!dragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragRef.current.hasMoved = true;
      }

      if (dragRef.current.hasMoved) {
        // En Messenger se mueve libremente por el dedo
        const newX = dragRef.current.origX + dx;
        const newY = dragRef.current.origY + dy;

        // Limitar dentro de la pantalla mientras se arrastra
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
        // Clic simple: abrir modal
        onClick();
      } else {
        // Efecto Messenger: soltar y saltar elásticamente al lateral más cercano
        setIsSnapping(true);
        setPosition((curr) => {
          const docked = calculateMagneticDock(curr.x, curr.y);
          setDockedSide(docked.side);
          sessionStorage.setItem(
            "transfer_bubble_dock",
            JSON.stringify({ side: docked.side, y: docked.y })
          );
          return { x: docked.x, y: docked.y };
        });

        // Terminar la animación de snap después de 400ms
        setTimeout(() => {
          setIsSnapping(false);
        }, 400);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // 1. REGLA: Ocultar la burbuja si el modal está abierto o si no hay productos en el carrito
  if (isModalOpen || cartItems.length === 0) {
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
          : "transform 0.42s cubic-bezier(0.175, 0.885, 0.32, 1.275)", // Curva elástica Messenger
      }}
      className={`fixed top-0 left-0 z-[9990] select-none group ${
        isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105 active:scale-95"
      } ${isSnapping ? "pointer-events-none" : ""}`}
      role="button"
      tabIndex={0}
      title="Carrito de Distribución a Tiendas - Arrastra para mover o haz clic para abrir"
    >
      <div className="relative flex items-center justify-center">
        {/* Halo parpadeante / ping suave que llama la atención sin saturar */}
        {!isDragging && (
          <>
            <span className="absolute -inset-2.5 rounded-full bg-primary-500/35 animate-ping pointer-events-none" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary to-secondary opacity-80 blur-sm animate-pulse pointer-events-none" />
          </>
        )}

        {/* Burbuja principal circular estilo Messenger */}
        <div
          className={`w-[60px] h-[60px] rounded-full bg-gradient-to-tr from-primary-600 via-indigo-600 to-violet-500 text-white flex flex-col items-center justify-center border-2 border-white/40 shadow-2xl backdrop-blur-md transition-all duration-150 ${
            isDragging
              ? "shadow-2xl shadow-indigo-600/60 ring-4 ring-primary/40 rotate-6"
              : "shadow-primary/40 group-hover:shadow-primary/60"
          }`}
        >
          <FaTruckFast className="text-2xl animate-pulse drop-shadow-md" />
          <span className="text-[9px] font-black uppercase tracking-tighter leading-none mt-0.5 opacity-95">
            Envíos
          </span>
        </div>

        {/* Badge flotante contador con animación de rebote sutil */}
        <div className="absolute -top-1.5 -right-1.5 bg-danger-500 text-white font-black text-[11px] leading-tight px-1.5 py-0.5 rounded-full border-2 border-white dark:border-default-900 shadow-lg flex items-center justify-center min-w-[22px] animate-bounce">
          {totalCartUnits}
        </div>

        {/* Tooltip contextual adaptativo según el lateral donde esté anclado */}
        {!isDragging && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 hidden sm:group-hover:flex items-center gap-1.5 bg-foreground/90 text-background px-3 py-1.5 rounded-xl shadow-xl text-xs font-semibold whitespace-nowrap pointer-events-none transition-all duration-200 border border-default-200/20 backdrop-blur-md ${
              dockedSide === "right"
                ? "right-full mr-3 animate-in slide-in-from-right-2"
                : "left-full ml-3 animate-in slide-in-from-left-2"
            }`}
          >
            <span>Carrito de Distribución:</span>
            <span className="text-primary-300 font-bold">{totalCartItems} prod.</span>
            <span className="text-default-300">({totalCartUnits} un.)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingTransferCartBubble;
