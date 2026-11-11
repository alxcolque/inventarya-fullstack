import React, { useEffect, useState } from "react";
import { Tooltip } from "@nextui-org/react";
import { useCurrencyStore } from "@/stores/currency/currency.store";
import { formatCompactNumber, formatFullNumber, toSafeNumber } from "@/utils/number-format";

export interface PriceDisplayProps {
  amount: number | string | null | undefined;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  showSymbol?: boolean;
  symbolClassName?: string;
  amountClassName?: string;
  loadingClassName?: string;
  /**
   * Si es true, números de 4 dígitos o más (>= 1,000) se muestran abreviados (1k, 1M)
   * con tooltip y opción de tocar/click para ver el valor exacto original.
   */
  compact?: boolean;
  /** Si es true, muestra formato compacto (1k, 1m) en móviles (< sm) y estándar en pantallas grandes */
  mobileCompactOnly?: boolean;
  /** Permite alternar entre formato compacto y completo al hacer click/tap */
  enableToggle?: boolean;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  decimals = 2,
  className = "",
  prefix = "",
  suffix = "",
  showSymbol = true,
  symbolClassName = "",
  amountClassName = "",
  loadingClassName = "",
  compact = false,
  mobileCompactOnly = false,
  enableToggle = true,
}) => {
  const symbol = useCurrencyStore((s) => s.symbol);
  const isLoading = useCurrencyStore((s) => s.isLoading);
  const isLoaded = useCurrencyStore((s) => s.isLoaded);
  const fetchCurrency = useCurrencyStore((s) => s.fetchCurrency);

  const [showFull, setShowFull] = useState(false);

  // Auto-cargar si no se encuentra en sesión ni memoria
  useEffect(() => {
    if (!isLoaded && !isLoading) {
      fetchCurrency();
    }
  }, [isLoaded, isLoading, fetchCurrency]);

  // Si la moneda aún no está cargada, esperar con indicador "cargando" sin mostrar valores alternativos
  if (isLoading || !isLoaded || !symbol) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-default-400 font-normal select-none ${loadingClassName || className}`}
        title="Cargando moneda..."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
        <span className="text-[11px] italic font-sans tracking-tight">cargando...</span>
      </span>
    );
  }

  const numeric = toSafeNumber(amount);
  const isLarge = Math.abs(numeric) >= 1000;
  const isCompactMode = compact && isLarge;

  // Formato completo estándar (con separador de miles)
  const fullFormatted = formatFullNumber(numeric, decimals);

  // Si se solicita compacto únicamente en dispositivos móviles:
  if (mobileCompactOnly && isLarge) {
    const compactFormatted = formatCompactNumber(numeric, { maxDecimals: decimals });
    return (
      <span className={`inline-flex items-baseline gap-1 font-sans ${className}`}>
        {prefix && <span>{prefix}</span>}
        {showSymbol && <span className={symbolClassName}>{symbol}</span>}
        <span className={`${amountClassName} sm:hidden`}>{compactFormatted}</span>
        <span className={`${amountClassName} hidden sm:inline`}>{fullFormatted}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  // Si no está en modo compacto o no supera 4 dígitos, mostrar normal
  if (!isCompactMode) {
    return (
      <span className={`inline-flex items-baseline gap-1 font-sans ${className}`}>
        {prefix && <span>{prefix}</span>}
        {showSymbol && <span className={symbolClassName}>{symbol}</span>}
        <span className={amountClassName}>{fullFormatted}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  // Modo compacto activo: e.g. 1k, 1.25k, 1M, 1B
  const compactFormatted = formatCompactNumber(numeric, { maxDecimals: decimals });
  const activeAmount = showFull ? fullFormatted : compactFormatted;
  const exactFullText = `${prefix}${showSymbol ? symbol + " " : ""}${fullFormatted}${suffix}`;

  const handleClick = (e: React.MouseEvent) => {
    if (enableToggle) {
      e.stopPropagation();
      setShowFull(!showFull);
    }
  };

  return (
    <Tooltip
      content={
        <div className="px-1 py-0.5 text-xs">
          <span className="text-default-400">Valor exacto: </span>
          <span className="font-bold font-mono text-foreground">
            {exactFullText}
          </span>
          <span className="block text-[10px] text-default-400 mt-0.5">
            (Toca para alternar vista)
          </span>
        </div>
      }
      delay={150}
      closeDelay={0}
      placement="top"
    >
      <span
        onClick={handleClick}
        className={`inline-flex items-baseline gap-1 font-sans cursor-pointer transition-colors border-b border-dashed border-default-300 dark:border-default-600 hover:border-primary ${className}`}
        title={`Valor original: ${exactFullText}`}
      >
        {prefix && <span>{prefix}</span>}
        {showSymbol && <span className={symbolClassName}>{symbol}</span>}
        <span className={amountClassName}>{activeAmount}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    </Tooltip>
  );
};

export default PriceDisplay;
