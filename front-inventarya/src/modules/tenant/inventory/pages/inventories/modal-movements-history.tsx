import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Spinner,
  Tooltip,
} from "@nextui-org/react";
import {
  FaClockRotateLeft,
  FaFilePdf,
  FaArrowRotateLeft,
  FaCircleCheck,
  FaTruckFast,
  FaBan,
} from "react-icons/fa6";
import { useStockMovementsStore, StockMovementRecord } from "../../store/movements/stock-movements.store";
import { generateRemisionPdf } from "../../utils/generateRemisionPdf";
import { useCurrencyStore } from "@/stores";
import { toast } from "sonner";

interface ModalMovementsHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onStockChanged?: () => void;
}

export const ModalMovementsHistory: React.FC<ModalMovementsHistoryProps> = ({
  isOpen,
  onClose,
  onStockChanged,
}) => {
  const { movements, getMovements, returnMovement, receiveMovement, isLoading } = useStockMovementsStore();
  const currencySymbol = useCurrencyStore((s) => s.symbol);
  const [processingId, setProcessingId] = useState<number | string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getMovements();
    }
  }, [isOpen]);

  const handleDownloadPdf = (movement: StockMovementRecord) => {
    try {
      const { doc, filename } = generateRemisionPdf(movement as any, currencySymbol || "$");
      doc.save(filename);
      toast.success(`Descargando ${filename}...`);
    } catch (e) {
      console.error("Error al generar PDF", e);
      toast.error("Error al generar el PDF de la Guía de Remisión.");
    }
  };

  const handleReturn = async (movement: StockMovementRecord) => {
    const confirm = window.confirm(
      `¿Confirmas la DEVOLUCIÓN al almacén de la Guía ${movement.document_number}?\n\nTodas las unidades regresarán al inventario de almacén.`
    );
    if (!confirm) return;

    setProcessingId(movement.id);
    const ok = await returnMovement(movement.id, "Cancelado / Devuelto por almacén");
    setProcessingId(null);
    if (ok) {
      onStockChanged?.();
    }
  };

  const handleReceive = async (movement: StockMovementRecord) => {
    const confirm = window.confirm(
      `¿Confirmas la RECEPCIÓN en tienda de la Guía ${movement.document_number}?\n\nEl stock ingresará al inventario de la tienda ${movement.destinationStore?.name || "destino"}.`
    );
    if (!confirm) return;

    setProcessingId(movement.id);
    const ok = await receiveMovement(movement.id);
    setProcessingId(null);
    if (ok) {
      onStockChanged?.();
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case "in_transit":
        return (
          <Chip size="sm" color="primary" variant="flat" className="font-semibold text-xs">
            🚚 En Tránsito
          </Chip>
        );
      case "completed":
        return (
          <Chip size="sm" color="success" variant="flat" className="font-semibold text-xs">
            ✓ Recibido / Completado
          </Chip>
        );
      case "returned":
        return (
          <Chip size="sm" color="warning" variant="flat" className="font-semibold text-xs">
            ↩ Devuelto al Almacén
          </Chip>
        );
      case "cancelled":
        return (
          <Chip size="sm" color="danger" variant="flat" className="font-semibold text-xs">
            ✕ Cancelado
          </Chip>
        );
      default:
        return (
          <Chip size="sm" variant="flat" className="text-xs">
            {status}
          </Chip>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-background border border-default-200",
        header: "border-b border-default-200 pb-3",
        footer: "border-t border-default-200 pt-3",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <FaClockRotateLeft className="text-primary text-xl" />
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Historial de Envíos y Traslados
                </h2>
                <p className="text-xs text-default-500 font-normal">
                  Control de Guías de Remisión, estado del transporte y devoluciones al almacén
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 flex flex-col gap-3">
              {isLoading && movements.length === 0 ? (
                <div className="flex justify-center items-center py-12 gap-2 text-default-500 text-sm">
                  <Spinner size="sm" />
                  <span>Cargando historial de traslados...</span>
                </div>
              ) : movements.length === 0 ? (
                <div className="p-8 text-center text-default-400 text-xs border border-dashed border-default-200 rounded-xl">
                  No se han registrado traslados de stock hasta el momento.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {movements.map((mov) => {
                    const isInTransit = mov.status === "in_transit";
                    const totalUnits = (mov.items || []).reduce(
                      (acc, i) => acc + (Number(i.quantity) || 0),
                      0
                    );

                    return (
                      <div
                        key={mov.id}
                        className="p-3.5 rounded-xl border border-default-200 bg-background hover:border-default-300 transition-all flex flex-col gap-2.5"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-foreground">
                              {mov.document_number}
                            </span>
                            {getStatusChip(mov.status)}
                          </div>
                          <span className="text-[11px] text-default-400">
                            {new Date(mov.shipped_at || mov.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
                          <div className="flex items-center gap-4 flex-wrap text-default-600">
                            <span>
                              <b>Destino:</b> {mov.destinationStore?.name || "Tienda #" + mov.destination_store_id}
                            </span>
                            <span>
                              <b>Contenido:</b> {mov.items?.length || 0} productos ({totalUnits} unidades)
                            </span>
                            {mov.user?.name && (
                              <span>
                                <b>Por:</b> {mov.user.name}
                              </span>
                            )}
                          </div>

                          {/* Acciones para el movimiento */}
                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            {/* Descargar Guía */}
                            <Tooltip content="Descargar Guía de Remisión en PDF">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                className="h-7 text-xs font-semibold px-2"
                                startContent={<FaFilePdf className="text-xs" />}
                                onPress={() => handleDownloadPdf(mov)}
                              >
                                Guía PDF
                              </Button>
                            </Tooltip>

                            {/* Opciones activas solo cuando está En Tránsito */}
                            {isInTransit && (
                              <>
                                <Tooltip content="Devolver todos los productos a Almacén Central">
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    color="warning"
                                    className="h-7 text-xs font-semibold px-2"
                                    isLoading={processingId === mov.id}
                                    startContent={<FaArrowRotateLeft className="text-xs" />}
                                    onPress={() => handleReturn(mov)}
                                  >
                                    Devolver
                                  </Button>
                                </Tooltip>

                                <Tooltip content="Confirmar recepción en Tienda (Acredita stock en tienda)">
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    color="success"
                                    className="h-7 text-xs font-semibold px-2"
                                    isLoading={processingId === mov.id}
                                    startContent={<FaCircleCheck className="text-xs" />}
                                    onPress={() => handleReceive(mov)}
                                  >
                                    Recibir
                                  </Button>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </div>

                        {mov.notes && (
                          <div className="text-[11px] text-default-500 bg-default-50 p-2 rounded border border-default-100">
                            <b>Notas:</b> {mov.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="light" color="default" onPress={onClose}>
                Cerrar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ModalMovementsHistory;
