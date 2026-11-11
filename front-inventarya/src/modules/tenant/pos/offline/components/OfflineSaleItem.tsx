import React, { useState } from 'react';
import {
  Button,
  Chip,
  Card,
  CardBody,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
} from '@nextui-org/react';
import {
  LuClock,
  LuRefreshCw,
  LuAlertTriangle,
  LuCheckCircle2,
  LuCopy,
  LuCheck,
  LuEye,
  LuShoppingBag,
  LuStore,
  LuFileText,
} from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { PosPendingSale } from '../pos-db';
import { getOfflineConflictPresentation } from '../offlineErrorClassifier';
import { toast } from 'sonner';

interface OfflineSaleItemProps {
  sale: PosPendingSale;
  index: number;
  isSyncingCurrent?: boolean;
  onRetry: (saleId: string) => Promise<void>;
  onRetryLocal: (saleId: string) => Promise<any>;
  onRefreshCatalog: () => Promise<void>;
}

export const OfflineSaleItem: React.FC<OfflineSaleItemProps> = ({
  sale,
  index,
  isSyncingCurrent = false,
  onRetry,
  onRetryLocal,
  onRefreshCatalog,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isActing, setIsActing] = useState(false);

  // Presentación del conflicto o estado
  const presentation = getOfflineConflictPresentation(
    sale.last_error_code || (sale.status === 'conflict' ? 'CONFLICT' : undefined),
    sale.last_error_message || sale.error_message,
    sale.server_accepted
  );

  const copyUuid = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sale.id);
      setCopied(true);
      toast.success('UUID copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAction = async () => {
    try {
      setIsActing(true);
      if (presentation.action === 'retry_local') {
        await onRetryLocal(sale.id);
      } else if (presentation.action === 'refresh_catalog') {
        await onRefreshCatalog();
      } else if (presentation.action === 'retry') {
        await onRetry(sale.id);
      } else if (
        presentation.action === 'view_details' ||
        presentation.action === 'contact_admin' ||
        presentation.action === 'switch_store'
      ) {
        setIsDetailsOpen(true);
      }
    } finally {
      setIsActing(false);
    }
  };

  // Formato de fecha relativa
  const timeAgo = sale.created_at
    ? formatDistanceToNow(new Date(sale.created_at), { addSuffix: true, locale: es })
    : 'recientemente';

  // Resumen del payload
  const total = Number(sale.payload?.total || 0).toFixed(2);
  const clientName = sale.payload?.name || 'Cliente general';
  const productsCount = Array.isArray(sale.payload?.products) ? sale.payload.products.length : 0;
  const isAcceptedLocalFailed = sale.server_accepted === true && sale.last_error_code === 'LOCAL_RECONCILIATION_FAILED';

  // Badges por estado de la venta
  const renderStatusBadge = () => {
    if (isAcceptedLocalFailed) {
      return (
        <Chip size="sm" color="secondary" variant="flat" className="font-bold text-[10px]">
          Registrada en nube · Actualizando local
        </Chip>
      );
    }
    if (sale.status === 'syncing' || isSyncingCurrent) {
      return (
        <Chip
          size="sm"
          color="primary"
          variant="flat"
          startContent={<Spinner size="sm" color="primary" className="h-3 w-3" />}
          className="font-bold text-[10px]"
        >
          Sincronizando…
        </Chip>
      );
    }
    if (sale.status === 'conflict') {
      return (
        <Chip
          size="sm"
          color="danger"
          variant="flat"
          startContent={<LuAlertTriangle className="text-xs" />}
          className="font-bold text-[10px]"
        >
          Requiere atención
        </Chip>
      );
    }
    return (
      <Chip
        size="sm"
        color="warning"
        variant="flat"
        startContent={<LuClock className="text-xs" />}
        className="font-bold text-[10px]"
      >
        Pendiente de sincronización
      </Chip>
    );
  };

  return (
    <>
      <Card className="border border-divider/70 shadow-sm hover:border-default-300 transition-all bg-card/60">
        <CardBody className="p-3 sm:p-4 flex flex-col gap-2.5">
          {/* Fila Superior: Identificador, Estado y Fecha */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-extrabold text-xs sm:text-sm text-foreground tracking-tight">
                Venta #{index + 1}
              </span>
              <span className="text-default-400 text-xs font-mono">
                ({sale.id.slice(0, 8)}...)
              </span>
              <Tooltip content={copied ? '¡Copiado!' : 'Copiar UUID de venta'}>
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  className="h-5 w-5 min-w-5 text-default-400 hover:text-foreground"
                  onPress={copyUuid}
                >
                  {copied ? <LuCheck className="text-success text-xs" /> : <LuCopy className="text-xs" />}
                </Button>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {renderStatusBadge()}
            </div>
          </div>

          {/* Información Comercial */}
          <div className="flex items-center justify-between gap-2 text-xs text-default-600 border-t border-divider/40 pt-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <LuShoppingBag className="text-default-400 text-xs" />
                {productsCount} producto(s)
              </span>
              <span className="text-default-400 font-mono text-[11px] truncate max-w-[130px]">
                {clientName}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-default-400">Total:</span>
              <span className="font-extrabold text-sm text-foreground">Bs {total}</span>
            </div>
          </div>

          {/* Metadatos secundarios: Hora e Intentos */}
          <div className="flex items-center justify-between text-[11px] text-default-400">
            <span className="flex items-center gap-1">
              <LuClock className="text-[10px]" />
              {timeAgo}
            </span>
            {(sale.attempt_count ?? 0) > 0 && (
              <span>
                {sale.attempt_count} intento{(sale.attempt_count ?? 0) > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Tarjeta de Conflicto / Explicación del Error (si existe) */}
          {(sale.status === 'conflict' || sale.last_error_code || isAcceptedLocalFailed) && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
                presentation.severity === 'danger'
                  ? 'bg-danger-500/10 border-danger-500/25 text-danger-900 dark:text-danger-200'
                  : presentation.severity === 'primary'
                  ? 'bg-primary-500/10 border-primary-500/25 text-primary-900 dark:text-primary-200'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                  {presentation.severity === 'danger' ? (
                    <LuAlertTriangle className="text-danger-500 text-sm shrink-0" />
                  ) : presentation.severity === 'primary' ? (
                    <LuCheckCircle2 className="text-primary-500 text-sm shrink-0" />
                  ) : (
                    <LuClock className="text-amber-500 text-sm shrink-0" />
                  )}
                  <span>{presentation.title}</span>
                </div>

                <Button
                  size="sm"
                  variant="light"
                  className="h-6 text-[10px] font-semibold text-default-500 hover:text-foreground shrink-0 px-2"
                  onPress={() => setIsDetailsOpen(true)}
                  startContent={<LuEye className="text-xs" />}
                >
                  Detalles
                </Button>
              </div>

              <p className="text-[11px] opacity-90 leading-relaxed">
                {presentation.description}
              </p>

              {/* Botones de acción contextuales y seguros */}
              {presentation.action !== 'none' && presentation.actionLabel && (
                <div className="pt-1 flex items-center gap-2 justify-end">
                  <Button
                    size="sm"
                    color={presentation.severity === 'danger' ? 'danger' : 'primary'}
                    variant="solid"
                    isLoading={isActing}
                    onPress={handleAction}
                    className="h-7 text-xs font-bold px-3 rounded-lg shadow-sm"
                  >
                    {presentation.actionLabel}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal de Detalle Técnico / Auditoría de la Venta Offline */}
      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <LuFileText className="text-primary text-lg" />
              <span>Detalle de Venta #{index + 1}</span>
            </div>
            <p className="text-xs text-default-400 font-mono select-all">UUID: {sale.id}</p>
          </ModalHeader>

          <ModalBody className="text-xs space-y-3">
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-default-100">
              <div>
                <span className="text-default-400">Sucursal:</span>
                <p className="font-bold flex items-center gap-1">
                  <LuStore className="text-xs text-primary" /> {sale.store_slug}
                </p>
              </div>
              <div>
                <span className="text-default-400">Estado Offline:</span>
                <p className="font-bold capitalize">{sale.status}</p>
              </div>
              <div>
                <span className="text-default-400">Cliente:</span>
                <p className="font-bold">{clientName}</p>
              </div>
              <div>
                <span className="text-default-400">Total:</span>
                <p className="font-bold text-sm text-primary">Bs {total}</p>
              </div>
              {sale.last_error_code && (
                <div className="col-span-2 pt-1 border-t border-divider/50">
                  <span className="text-default-400">Código de Error:</span>
                  <p className="font-mono text-danger font-bold">{sale.last_error_code}</p>
                  {sale.last_error_message && (
                    <p className="text-default-500 mt-0.5">{sale.last_error_message}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="font-bold mb-1.5">Productos en la Venta ({productsCount}):</p>
              <div className="border border-divider rounded-xl divide-y divide-divider/50 max-h-48 overflow-y-auto">
                {(sale.payload?.products || []).map((p: any, i: number) => (
                  <div key={i} className="p-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold">{p.name || `Producto #${p.product_id}`}</p>
                      <p className="text-[10px] text-default-400">ID: {p.product_id} · Cant: {p.quantity}</p>
                    </div>
                    <p className="font-bold">Bs {Number(p.subtotal || p.price * p.quantity || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-bold mb-1 text-default-500">Payload JSON Canónico:</p>
              <pre className="p-2.5 rounded-xl bg-default-100 text-[10px] font-mono overflow-x-auto max-h-40">
                {JSON.stringify(sale.payload, null, 2)}
              </pre>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button size="sm" variant="light" onPress={() => setIsDetailsOpen(false)}>
              Cerrar
            </Button>
            {presentation.action !== 'none' && presentation.actionLabel && (
              <Button
                size="sm"
                color="primary"
                isLoading={isActing}
                onPress={async () => {
                  await handleAction();
                  setIsDetailsOpen(false);
                }}
              >
                {presentation.actionLabel}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
