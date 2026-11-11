import React from 'react';
import { Chip, Tooltip, Spinner } from '@nextui-org/react';
import { LuCheckCircle2, LuClock, LuAlertTriangle, LuRefreshCw, LuDatabase } from 'react-icons/lu';
import { CatalogFreshnessInfo } from '../hooks/useOfflineSalesStatus';

interface CatalogFreshnessIndicatorProps {
  freshness: CatalogFreshnessInfo;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  isOnline?: boolean;
}

export const CatalogFreshnessIndicator: React.FC<CatalogFreshnessIndicatorProps> = ({
  freshness,
  isRefreshing = false,
  onRefresh,
  isOnline = true,
}) => {
  const getIcon = () => {
    if (isRefreshing || freshness.status === 'refreshing') {
      return <Spinner size="sm" color="primary" />;
    }
    if (freshness.status === 'complete') {
      return <LuCheckCircle2 className="text-emerald-500 text-xs shrink-0" />;
    }
    if (freshness.status === 'stale') {
      return <LuClock className="text-amber-500 text-xs shrink-0" />;
    }
    return <LuAlertTriangle className="text-danger-500 text-xs shrink-0" />;
  };

  const getChipColor = (): 'default' | 'success' | 'warning' | 'danger' | 'primary' => {
    if (isRefreshing || freshness.status === 'refreshing') return 'primary';
    if (freshness.status === 'complete') return 'success';
    if (freshness.status === 'stale') return 'warning';
    return 'danger';
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Tooltip
        content={
          <div className="p-1 max-w-xs text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <LuDatabase className="text-primary text-sm" />
              Catálogo Offline en este Dispositivo
            </p>
            <p className="text-default-500">{freshness.label}</p>
            {freshness.hasDeficit && (
              <p className="text-warning-600 font-semibold">
                Hay {freshness.deficitCount} producto(s) con ventas pendientes que superan el stock conocido.
              </p>
            )}
            {isOnline && onRefresh && (
              <p className="text-[11px] text-primary underline cursor-pointer pt-1">
                Haz clic para actualizar el catálogo completo ahora.
              </p>
            )}
          </div>
        }
        delay={300}
      >
        <Chip
          size="sm"
          variant="flat"
          color={getChipColor()}
          startContent={getIcon()}
          onClick={isOnline && onRefresh ? onRefresh : undefined}
          className={`h-6 text-[11px] font-medium border border-divider/60 select-none ${
            isOnline && onRefresh ? 'cursor-pointer hover:opacity-85' : 'cursor-default'
          }`}
        >
          <span className="truncate max-w-[190px] sm:max-w-[260px]">{freshness.label}</span>
          {isOnline && onRefresh && !isRefreshing && (
            <LuRefreshCw className="ml-1 text-[10px] text-default-400 hover:text-primary transition-colors shrink-0" />
          )}
        </Chip>
      </Tooltip>

      {/* Alerta de Déficit de Reserva si existe */}
      {freshness.hasDeficit && (
        <Tooltip
          content={`Existe un déficit de reserva de ${freshness.deficitCount} unidades en ventas pendientes. El servidor determinará la disponibilidad autoritativa al sincronizar.`}
        >
          <Chip
            size="sm"
            color="warning"
            variant="solid"
            startContent={<LuAlertTriangle className="text-xs" />}
            className="h-6 text-[10px] font-bold px-1.5 animate-pulse"
          >
            Déficit: {freshness.deficitCount}
          </Chip>
        </Tooltip>
      )}
    </div>
  );
};
