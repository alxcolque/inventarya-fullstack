import React, { useState } from "react";
import { FaBoxesStacked } from "react-icons/fa6";

interface OptimizedProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackName?: string;
  fallbackBrand?: string;
  onClick?: () => void;
  showFallbackText?: boolean;
}

export const OptimizedProductImage: React.FC<OptimizedProductImageProps> = ({
  src,
  alt,
  className = "w-full h-full object-cover",
  fallbackName,
  fallbackBrand,
  onClick,
  showFallbackText = true,
}) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const hasValidSrc = Boolean(src && typeof src === "string" && src.trim().length > 0 && !src.includes("null") && !src.includes("undefined"));

  if (!hasValidSrc || status === "error") {
    return (
      <div
        onClick={onClick}
        className={`w-full h-full flex flex-col items-center justify-center bg-default-100 dark:bg-default-50/50 text-default-400 gap-1 p-2 text-center select-none ${
          onClick ? "cursor-pointer" : ""
        }`}
      >
        <FaBoxesStacked size={18} className="text-primary-500/70 shrink-0" />
        {showFallbackText && (
          <span className="text-[10px] font-semibold text-default-600 line-clamp-1">
            {fallbackBrand || fallbackName || alt || "Producto"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative w-full h-full overflow-hidden bg-default-100 dark:bg-default-50/40 flex items-center justify-center ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Skeleton mientras carga */}
      {status === "loading" && (
        <div className="absolute inset-0 bg-default-200/50 dark:bg-default-100/30 animate-pulse flex items-center justify-center z-0">
          <FaBoxesStacked size={16} className="text-default-300 dark:text-default-600" />
        </div>
      )}

      {/* Imagen optimizada con carga perezosa y decodificación asíncrona */}
      <img
        src={src!}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={`${className} transition-opacity duration-300 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};
