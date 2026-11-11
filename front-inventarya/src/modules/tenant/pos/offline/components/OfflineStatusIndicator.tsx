import React from 'react';
import { Button, Chip, Tooltip, Spinner } from '@nextui-org/react';
import { LuWifi, LuWifiOff, LuServerOff, LuRefreshCw, LuAlertTriangle, LuClock } from 'react-icons/lu';
import { ConnectivityState } from '../hooks/useOfflineSalesStatus';

interface OfflineStatusIndicatorProps {
  connectivityState: ConnectivityState;
  pendingCount: number;
  totalAttention: number;
  isSyncing?: boolean;
  onOpenPanel: () => void;
  className?: string;
  isCompact?: boolean;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  connectivityState,
  pendingCount,
  totalAttention,
  isSyncing = false,
  onOpenPanel,
  className = '',
  isCompact = false,
}) => {
  // Configuración visual por estado de conectividad (Sección 5 y 6)
  const getStatusConfig = () => {
    switch (connectivityState) {
      case 'offline':
        return {
          label: 'Modo sin conexión',
          shortLabel: 'Sin conexión',
          dotColor: 'bg-amber-500',
          textColor: 'text-amber-600 dark:text-amber-400',
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
          icon: <LuWifiOff className="text-amber-500 text-xs shrink-0" />,
          tooltip: 'Sin internet. Las ventas se guardarán localmente en este dispositivo y se sincronizarán al reconectar.',
        };
      case 'server_unavailable':
        return {
          label: 'Servidor no disponible',
          shortLabel: 'Servidor caído',
          dotColor: 'bg-rose-500',
          textColor: 'text-rose-600 dark:text-rose-400',
          borderColor: 'border-rose-500/30',
          bgColor: 'bg-rose-500/10 hover:bg-rose-500/20',
          icon: <LuServerOff className="text-rose-500 text-xs shrink-0" />,
          tooltip: 'Internet disponible, pero el servidor de Inventarya no responde. Las ventas se encolarán de forma segura.',
        };
      case 'reconnecting':
        return {
          label: 'Reconectando…',
          shortLabel: 'Reconectando',
          dotColor: 'bg-primary-500',
          textColor: 'text-primary-600 dark:text-primary-400',
          borderColor: 'border-primary-500/30',
          bgColor: 'bg-primary-500/10 hover:bg-primary-500/20',
          icon: <Spinner size="sm" color="primary" className="h-3 w-3" />,
          tooltip: 'Comprobando conexión y sincronizando ventas pendientes con el servidor.',
        };
      case 'online':
      default:
        return {
          label: 'Conectado',
          shortLabel: 'Online',
          dotColor: 'bg-emerald-500',
          textColor: 'text-emerald-600 dark:text-emerald-400',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-500/5 hover:bg-emerald-500/15',
          icon: <LuWifi className="text-emerald-500 text-xs shrink-0" />,
          tooltip: 'Conectado al servidor en tiempo real. Todas las operaciones están sincronizadas.',
        };
    }
  };

  const config = getStatusConfig();
  const hasQueue = pendingCount > 0 || totalAttention > 0 || isSyncing;

  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      <Tooltip content={config.tooltip} delay={250}>
        <Button
          size="sm"
          variant="flat"
          onPress={onOpenPanel}
          className={`h-8 sm:h-7 px-2.5 sm:px-3 rounded-full border transition-all text-xs font-semibold ${config.borderColor} ${config.bgColor}`}
          aria-label={`Estado: ${config.label}. Abrir panel de sincronización.`}
        >
          <div className="flex items-center gap-1.5">
            {/* Indicador de estado */}
            <span className="relative flex h-2 w-2 shrink-0">
              {connectivityState === 'reconnecting' && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
            </span>

            {/* Label de Conectividad */}
            <span className={`hidden sm:inline ${config.textColor}`}>
              {isCompact ? config.shortLabel : config.label}
            </span>
            <span className={`sm:hidden ${config.textColor}`}>
              {config.shortLabel}
            </span>
          </div>

          {/* Chips de Cola Offline (si existen pendientes o atención requerida) */}
          {hasQueue && (
            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-divider/60">
              {pendingCount > 0 && (
                <Chip
                  size="sm"
                  variant="solid"
                  color={connectivityState === 'online' ? 'default' : 'warning'}
                  className="h-4.5 min-w-4 text-[10px] font-bold px-1.5 py-0"
                >
                  <span className="flex items-center gap-0.5">
                    <LuClock className="text-[9px]" />
                    {pendingCount}
                  </span>
                </Chip>
              )}

              {totalAttention > 0 && (
                <Chip
                  size="sm"
                  variant="solid"
                  color="danger"
                  className="h-4.5 min-w-4 text-[10px] font-bold px-1.5 py-0 animate-bounce"
                >
                  <span className="flex items-center gap-0.5">
                    <LuAlertTriangle className="text-[9px]" />
                    {totalAttention}
                  </span>
                </Chip>
              )}

              {isSyncing && (
                <span className="text-[10px] text-primary flex items-center gap-1 font-bold">
                  <LuRefreshCw className="animate-spin text-[10px]" />
                </span>
              )}
            </div>
          )}
        </Button>
      </Tooltip>
    </div>
  );
};
