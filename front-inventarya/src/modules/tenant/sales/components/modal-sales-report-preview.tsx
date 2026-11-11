import { usePdfPreview } from '@/hooks/usePdfPreview';
import { downloadPdf, isNativePdf, pdfDownloadMessage, pdfErrorMessage } from '@/services/pdfService';
import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from "@nextui-org/react";
import {
  FaDownload,
  FaPrint,
  FaXmark,
  FaCalendarDays,
  FaStore,
} from "react-icons/fa6";
import { generateSalesReportPdf, SalesReportPdfData } from "../utils/generateSalesReportPdf";
import { toast } from "sonner";

interface ModalSalesReportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: SalesReportPdfData;
}

export const ModalSalesReportPreview: React.FC<ModalSalesReportPreviewProps> = ({
  isOpen,
  onClose,
  reportData,
}) => {
  const { url: blobUrl, open: openPreview, clear: clearPreview } = usePdfPreview();
  React.useEffect(() => {
    if (!isOpen || !reportData.sales) { clearPreview(); return; }
    void openPreview(() => {
      const { doc, filename } = generateSalesReportPdf(reportData);
      return { pdf: doc, filename };
    }).catch((error: unknown) => toast.error(pdfErrorMessage(error)));
    return clearPreview;
  }, [isOpen, reportData, openPreview, clearPreview]);

  const handleDownload = async () => {
    try {
      const { doc, filename } = generateSalesReportPdf(reportData);
      await downloadPdf(doc, filename);
      toast.success(pdfDownloadMessage());
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    }
  };

  const handlePrint = () => {
    if (blobUrl) {
      const win = window.open(blobUrl, "_blank");
      win?.focus();
    }
  };

  // Gesto táctil estilo Google Maps: arrastrar hacia abajo para cerrar
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  const handleDragTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("iframe")) {
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };

  const handleDragTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingSheet) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    } else {
      setDragOffsetY(0);
    }
  };

  const handleDragTouchEnd = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (dragOffsetY > 75) {
      onClose();
    }
    setDragOffsetY(0);
  };

  // Bloqueo de scroll de fondo mientras esté abierto
  useEffect(() => {
    if (isOpen) {
      const mainEl = (document.getElementById("pos-main") || document.querySelector("main")) as HTMLElement | null;
      const prevBodyOverflow = document.body.style.overflow;
      const prevMainOverflow = mainEl?.style.overflow;

      document.body.style.overflow = "hidden";
      if (mainEl) mainEl.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prevBodyOverflow || "";
        if (mainEl) mainEl.style.overflow = prevMainOverflow || "";
      };
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      placement="bottom-center"
      scrollBehavior="inside"
      hideCloseButton
      backdrop="opaque"
      motionProps={{
        variants: {
          enter: {
            y: 0,
            opacity: 1,
            transition: {
              duration: 0.22,
              ease: [0.16, 1, 0.3, 1],
            },
          },
          exit: {
            y: "100%",
            opacity: 0,
            transition: {
              duration: 0.18,
              ease: [0.7, 0, 0.84, 0],
            },
          },
        },
      }}
      classNames={{
        backdrop: "bg-black/60 backdrop-blur-sm",
        base: "bg-background border border-default-200 shadow-2xl m-0 sm:my-auto rounded-t-[28px] rounded-b-none sm:rounded-3xl max-h-[92dvh] sm:max-h-[92vh] overflow-hidden w-full max-w-full sm:max-w-5xl",
        header: "border-b border-default-100 py-3 px-4 sm:px-6 shrink-0",
        body: "p-0 overflow-y-auto overscroll-contain flex-1",
        footer: "border-t border-default-100 py-3 px-4 sm:px-6 shrink-0",
      }}
    >
      <ModalContent
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: isDraggingSheet ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {() => (
          <>
            {/* Indicador visual de bottom sheet (affordance estilo Google Maps) */}
            <div
              className="sm:hidden w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
              onTouchStart={handleDragTouchStart}
              onTouchMove={handleDragTouchMove}
              onTouchEnd={handleDragTouchEnd}
              onClick={onClose}
              title="Deslizar hacia abajo o tocar para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
            </div>

            <ModalHeader
              className="flex flex-col gap-1 select-none pt-1 sm:pt-4"
              onTouchStart={handleDragTouchStart}
              onTouchMove={handleDragTouchMove}
              onTouchEnd={handleDragTouchEnd}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div>
                    <h3 className="text-base sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2 truncate">
                      Reporte de Ventas
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-default-400 mt-0.5">
                      <span className="flex items-center gap-1 font-medium">
                        <FaCalendarDays className="text-primary text-[11px]" />
                        Período: <b>{reportData.periodLabel}</b>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium">
                        <FaStore className="text-primary text-[11px]" />
                        Alcance: <b>{reportData.storeName}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Chip color="primary" variant="flat" size="sm" className="font-bold h-6 text-xs">
                    {reportData.sales.length} comprobantes
                  </Chip>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    aria-label="Cerrar modal"
                    onPress={onClose}
                    className="h-8 w-8 min-w-8 bg-default-100 dark:bg-default-100/50 text-default-500 hover:text-foreground active:scale-95 transition-all"
                  >
                    <FaXmark size={15} />
                  </Button>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="p-0">
              <div className="w-full h-[60vh] sm:h-[600px] bg-default-100 flex items-center justify-center">
                {isNativePdf() ? <p className="text-sm">El reporte se abre en el visor del dispositivo. Usa Descargar para compartirlo o guardarlo.</p> : blobUrl ? (
                  <iframe src={blobUrl} title="Vista previa Reporte Ventas" className="w-full h-full border-none" />
                ) : (
                  <span className="text-sm text-default-400">Generando documento...</span>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <span className="text-[11px] text-default-400 hidden sm:inline">
                Documento oficial con desglose de métodos de pago (Efectivo/QR) y top de productos.
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  className="font-bold text-xs"
                  startContent={<FaXmark />}
                  onPress={onClose}
                >
                  Cerrar
                </Button>

                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  className="font-bold text-xs"
                  startContent={<FaPrint />}
                  onPress={handlePrint}
                >
                  Imprimir
                </Button>

                <Button
                  size="sm"
                  color="primary"
                  className="font-bold text-xs shadow-md"
                  startContent={<FaDownload />}
                  onPress={handleDownload}
                >
                  Descargar
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
