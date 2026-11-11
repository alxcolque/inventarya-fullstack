import React, { useState, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tabs,
  Tab,
  Chip,
} from '@nextui-org/react';
import {
  LuCloud,
  LuRefreshCw,
  LuCheckCircle2,
  LuAlertTriangle,
  LuClock,
  LuStore,
  LuX,
  LuInbox,
} from 'react-icons/lu';
import { PosPendingSale } from '../pos-db';
import { OfflineSaleItem } from './OfflineSaleItem';

interface OfflineSalesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sales: PosPendingSale[];
  pendingCount: number;
  totalAttention: number;
  isSyncing: boolean;
  storeSlug?: string;
  storeName?: string;
  hasDeficit?: boolean;
  deficitCount?: number;
  onSyncPendingSales: () => Promise<void>;
  onRetrySale: (saleId: string) => Promise<void>;
  onRetryLocal: (saleId: string) => Promise<any>;
  onRefreshCatalog: () => Promise<void>;
}

export const OfflineSalesPanel: React.FC<OfflineSalesPanelProps> = ({
  isOpen,
  onClose,
  sales,
  pendingCount,
  totalAttention,
  isSyncing,
  storeSlug,
  storeName,
  hasDeficit = false,
  deficitCount = 0,
  onSyncPendingSales,
  onRetrySale,
  onRetryLocal,
  onRefreshCatalog,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'attention'>('all');

  // Filtrado de ventas por pestaña seleccionada
  const filteredSales = useMemo(() => {
    if (activeTab === 'pending') {
      return sales.filter(
        (s) => s.status === 'pending' && s.last_error_code !== 'LOCAL_RECONCILIATION_FAILED'
      );
    }
    if (activeTab === 'attention') {
      return sales.filter(
        (s) =>
          s.status === 'conflict' ||
          (s.server_accepted === true && s.last_error_code === 'LOCAL_RECONCILIATION_FAILED')
      );
    }
    return sales;
  }, [sales, activeTab]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      placement="auto"
      classNames={{
        wrapper: 'z-[9999]',
        base: 'max-h-[92dvh] sm:max-h-[85dvh]',
        header: 'border-b border-divider/60 pb-3',
        footer: 'border-t border-divider/60 pt-3 bg-default-50/50',
      }}
    >
      <ModalContent>
        {/* Cabecera del Panel */}
        <ModalHeader className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <LuCloud className="text-lg" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Sincronización de Ventas
                </h2>
                <p className="text-xs text-default-400 font-medium flex items-center gap-1">
                  <LuStore className="text-xs" />
                  {storeName || storeSlug || 'Sucursal POS actual'}
                </p>
              </div>
            </div>

            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="text-default-400 hover:text-foreground h-8 w-8 min-w-8 rounded-full"
              onPress={onClose}
            >
              <LuX className="text-base" />
            </Button>
          </div>

          {/* Pestañas de Filtro */}
          <div className="pt-1">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as any)}
              size="sm"
              variant="underlined"
              color="primary"
              classNames={{
                tabList: 'gap-3 border-b-0 p-0',
                cursor: 'w-full bg-primary',
                tab: 'max-w-fit px-1 h-8 font-semibold text-xs',
              }}
            >
              <Tab
                key="all"
                title={
                  <div className="flex items-center gap-1.5">
                    <span>Todas</span>
                    <Chip size="sm" variant="flat" className="h-4.5 px-1 text-[10px] font-bold">
                      {sales.length}
                    </Chip>
                  </div>
                }
              />
              <Tab
                key="pending"
                title={
                  <div className="flex items-center gap-1.5">
                    <span>Pendientes</span>
                    {pendingCount > 0 && (
                      <Chip size="sm" color="warning" variant="solid" className="h-4.5 px-1 text-[10px] font-bold">
                        {pendingCount}
                      </Chip>
                    )}
                  </div>
                }
              />
              <Tab
                key="attention"
                title={
                  <div className="flex items-center gap-1.5">
                    <span>Requieren atención</span>
                    {totalAttention > 0 && (
                      <Chip size="sm" color="danger" variant="solid" className="h-4.5 px-1 text-[10px] font-bold">
                        {totalAttention}
                      </Chip>
                    )}
                  </div>
                }
              />
            </Tabs>
          </div>
        </ModalHeader>

        {/* Cuerpo del Panel */}
        <ModalBody className="p-3 sm:p-4 gap-2.5">
          {/* Banner de Déficit de Reserva si existe */}
          {hasDeficit && deficitCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2 shadow-sm">
              <LuAlertTriangle className="text-amber-500 text-sm shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Déficit de reserva detectado ({deficitCount} unidades)</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  Hay ventas pendientes que superan el stock conocido localmente. El servidor resolverá la disponibilidad autoritativa al sincronizar.
                </p>
              </div>
            </div>
          )}

          {/* Lista de Ventas */}
          {filteredSales.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-default-400">
              <span className="p-4 rounded-full bg-default-100 text-default-300">
                <LuInbox size={32} />
              </span>
              <p className="font-bold text-sm text-foreground">
                {activeTab === 'attention'
                  ? 'No hay operaciones en conflicto'
                  : activeTab === 'pending'
                  ? 'No hay ventas pendientes'
                  : 'Cola offline vacía'}
              </p>
              <p className="text-xs max-w-xs text-default-500">
                {activeTab === 'all'
                  ? 'Todas las ventas registradas en esta terminal están sincronizadas y al día con la nube.'
                  : 'No se encontraron registros bajo el filtro seleccionado.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredSales.map((sale, idx) => (
                <OfflineSaleItem
                  key={sale.id}
                  sale={sale}
                  index={idx}
                  isSyncingCurrent={isSyncing}
                  onRetry={onRetrySale}
                  onRetryLocal={onRetryLocal}
                  onRefreshCatalog={onRefreshCatalog}
                />
              ))}
            </div>
          )}
        </ModalBody>

        {/* Pie del Panel con Acciones Globales */}
        <ModalFooter className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-default-500 font-medium">
            <span className="font-bold text-foreground">{pendingCount}</span> pendiente(s)
            {totalAttention > 0 && (
              <span className="ml-2 text-danger font-bold">
                · {totalAttention} requiere(n) atención
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="flat" onPress={onClose}>
              Cerrar
            </Button>

            <Button
              size="sm"
              color="primary"
              variant="solid"
              startContent={
                isSyncing ? (
                  <LuRefreshCw className="animate-spin text-sm" />
                ) : (
                  <LuCheckCircle2 className="text-sm" />
                )
              }
              isLoading={isSyncing}
              isDisabled={isSyncing || pendingCount === 0}
              onPress={onSyncPendingSales}
              className="font-bold text-xs px-4 rounded-xl shadow-sm shadow-primary/25"
            >
              {isSyncing ? 'Sincronizando…' : 'Sincronizar pendientes'}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
