import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Tooltip,
} from "@nextui-org/react";
import {
  FaCircleCheck,
  FaFilePdf,
  FaDownload,
  FaArrowUpRightFromSquare,
  FaStore,
  FaBoxesStacked,
} from "react-icons/fa6";
import { StockMovementRecord } from "../../store/movements/stock-movements.store";
import { generateRemisionPdf } from "../../utils/generateRemisionPdf";
import { useCurrencyStore } from "@/stores";
import { toast } from "sonner";

interface ModalDispatchSuccessProps {
  isOpen: boolean;
  onClose: () => void;
  movement: StockMovementRecord | null;
}

export const ModalDispatchSuccess: React.FC<ModalDispatchSuccessProps> = ({
  isOpen,
  onClose,
  movement,
}) => {
  const currencySymbol = useCurrencyStore((s) => s.symbol);

  if (!movement) return null;

  const storeName = movement.destinationStore?.name || "Tienda Destino";
  const itemsCount = movement.items?.length || 0;
  const totalUnits = (movement.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleDownloadPdf = () => {
    try {
      const { doc, filename } = generateRemisionPdf(movement as any, currencySymbol || "$");
      doc.save(filename);
      toast.success(`Descargando ${filename}...`);
    } catch (e) {
      console.error("Error al generar PDF", e);
      toast.error("Error al generar el archivo PDF de la Guía de Remisión.");
    }
  };

  const handleViewPdf = () => {
    try {
      const { doc } = generateRemisionPdf(movement as any, currencySymbol || "$");
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      console.error("Error al previsualizar PDF", e);
      toast.error("Error al abrir la vista previa del PDF.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      placement="center"
      classNames={{
        base: "bg-background border border-default-200",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col items-center justify-center pt-6 pb-2 text-center">
              <div className="p-3 rounded-full bg-success/15 text-success mb-2">
                <FaCircleCheck className="text-4xl" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {movement.status === "completed"
                  ? "¡Distribución Directa a Tienda Exitosa!"
                  : "¡Envío Confirmado con Éxito!"}
              </h2>
              <p className="text-xs text-default-500 font-normal">
                {movement.status === "completed"
                  ? "Los productos fueron registrados e ingresados directamente en el inventario de la tienda en estado Recibido."
                  : "La mercadería se encuentra En Tránsito y el stock fue descontado del almacén."}
              </p>
            </ModalHeader>

            <ModalBody className="py-3 flex flex-col gap-3">
              <div className="p-3.5 bg-default-100 dark:bg-default-50/50 rounded-xl border border-default-200 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-default-500 font-medium">N° de Guía:</span>
                  <div className="flex items-center gap-1.5">
                    <Chip size="sm" color="primary" variant="solid" className="font-mono font-bold text-xs">
                      {movement.document_number}
                    </Chip>
                    <Chip
                      size="sm"
                      color={movement.status === "completed" ? "success" : "warning"}
                      variant="flat"
                      className="font-bold text-[10px]"
                    >
                      {movement.status === "completed" ? "RECIBIDO" : "EN TRÁNSITO"}
                    </Chip>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-default-500 font-medium flex items-center gap-1">
                    <FaStore className="text-xs text-default-400" />
                    <span>Destino:</span>
                  </span>
                  <span className="font-bold text-foreground">{storeName}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-default-500 font-medium flex items-center gap-1">
                    <FaBoxesStacked className="text-xs text-default-400" />
                    <span>Contenido:</span>
                  </span>
                  <span className="font-bold text-foreground">
                    {itemsCount} productos • {totalUnits} unidades
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-default-500 text-center px-2">
                {movement.status === "completed"
                  ? "Puedes descargar o previsualizar el comprobante oficial de la Guía de Remisión generada."
                  : "Descarga la Guía de Remisión en PDF para imprimirla y adjuntarla al transporte."}
              </p>
            </ModalBody>

            <ModalFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2">
              <Button variant="light" color="default" onPress={onClose} className="w-full sm:w-auto">
                Cerrar
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Tooltip content="Abrir en pestaña nueva">
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={handleViewPdf}
                    startContent={<FaArrowUpRightFromSquare className="text-xs" />}
                  >
                    Ver PDF
                  </Button>
                </Tooltip>

                <Button
                  color="primary"
                  variant="shadow"
                  size="sm"
                  startContent={<FaDownload className="text-xs" />}
                  onPress={handleDownloadPdf}
                  className="font-bold shadow-primary/25"
                >
                  Descargar Guía de Remisión
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ModalDispatchSuccess;
