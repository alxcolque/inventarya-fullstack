import React, { useState } from "react";
import { Tooltip } from "@nextui-org/react";
import { formatCompactNumber, formatFullNumber, toSafeNumber } from "@/utils/number-format";

export interface CompactNumberProps {
  value: number | string | null | undefined;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  fullDecimals?: number;
  className?: string;
  compact?: boolean;
  /** Si es true, muestra compacto (k, m) solo en móviles (< sm) y completo en pantallas grandes */
  mobileCompactOnly?: boolean;
  enableToggle?: boolean;
}

/**
 * Componente para renderizar números con simplificación compacta (1k, 1m, etc.)
 * si alcanzan 4 dígitos (>= 1000), permitiendo ver el valor exacto original vía
 * Tooltip (hover) o al presionar/tocar (click/tap) para dispositivos móviles.
 */
export const CompactNumber: React.FC<CompactNumberProps> = ({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  fullDecimals = 0,
  className = "",
  compact = true,
  mobileCompactOnly = false,
  enableToggle = true,
}) => {
  const numeric = toSafeNumber(value);
  const isLarge = Math.abs(numeric) >= 1000;
  const [showFull, setShowFull] = useState(false);

  // Si se solicita compacto únicamente en celular:
  if (mobileCompactOnly) {
    const compactVal = formatCompactNumber(numeric, { maxDecimals: decimals });
    const fullVal = formatFullNumber(numeric, fullDecimals);

    return (
      <span className={`inline-flex items-baseline gap-0.5 font-sans ${className}`}>
        {prefix && <span>{prefix}</span>}
        <span className="sm:hidden">{compactVal}</span>
        <span className="hidden sm:inline">{fullVal}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  // Si no es grande o no está en modo compacto, mostrar formato regular
  if (!isLarge || !compact) {
    const formatted = formatFullNumber(numeric, fullDecimals);
    return (
      <span className={`inline-flex items-baseline gap-0.5 font-sans ${className}`}>
        {prefix && <span>{prefix}</span>}
        <span>{formatted}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  const compactVal = formatCompactNumber(numeric, { maxDecimals: decimals });
  const fullVal = formatFullNumber(numeric, fullDecimals);

  const displayVal = showFull ? fullVal : compactVal;
  const tooltipText = `Valor exacto: ${prefix}${fullVal}${suffix}`;

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
          <span className="text-default-400">Valor original: </span>
          <span className="font-bold font-mono text-foreground">
            {prefix}{fullVal}{suffix}
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
        className={`inline-flex items-baseline gap-0.5 font-sans cursor-pointer transition-colors border-b border-dashed border-default-300 dark:border-default-600 hover:border-primary ${className}`}
        title={`Valor original: ${prefix}${fullVal}${suffix}`}
      >
        {prefix && <span>{prefix}</span>}
        <span>{displayVal}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    </Tooltip>
  );
};

export default CompactNumber;
