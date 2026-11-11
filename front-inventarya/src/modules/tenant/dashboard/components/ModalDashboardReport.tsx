import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Spinner
} from "@nextui-org/react";
import {
  LuFileText,
  LuDownload,
  LuExternalLink,
  LuPrinter,
  LuCalendar,
  LuStore
} from "react-icons/lu";
import { DashboardSummary } from "../store/home/home.store";
import { generateDashboardPdf } from "../utils/generateDashboardPdf";
import { useSettingStore } from "@/stores";
import { useCurrency } from "@/stores/currency/currency.store";
import { jsPDF } from "jspdf";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summary: DashboardSummary | null;
  periodLabel: string;
  storeName: string;
}

export const ModalDashboardReport: React.FC<Props> = ({
  isOpen,
  onClose,
  summary,
  periodLabel,
  storeName,
}) => {
  const [pdfData, setPdfData] = useState<{
    doc: jsPDF;
    filename: string;
    blobUrl: string;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const systemData = useSettingStore((state) => state.systemData) as any;
  const { symbol: currencySymbol } = useCurrency();

  useEffect(() => {
    if (isOpen && summary) {
      setIsGenerating(true);
      try {
        const result = generateDashboardPdf({
          summary,
          periodLabel,
          storeName,
          currencySymbol: currencySymbol || "$",
          companyName: systemData?.name || "INVENTARYA POS",
          nit: systemData?.nit || "-",
        });
        setPdfData(result);
      } catch (err) {
        console.error("Error generating dashboard PDF:", err);
      } finally {
        setIsGenerating(false);
      }
    } else {
      setPdfData(null);
    }
  }, [isOpen, summary, periodLabel, storeName, currencySymbol, systemData]);

  const handleDownload = () => {
    if (pdfData) {
      pdfData.doc.save(pdfData.filename);
    }
  };

  const handleOpenNewTab = () => {
    if (pdfData) {
      window.open(pdfData.blobUrl, "_blank");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: "max-h-[92vh] rounded-2xl",
        body: "p-0",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-default-200 px-4 py-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                  <LuFileText size={20} />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Reporte Ejecutivo de Panel de Control
                  </h2>
                  <p className="text-xs text-default-400">
                    Documento consolidado con indicadores clave y analítica en tiempo real
                  </p>
                </div>
              </div>

              {/* Badges de filtros aplicados */}
              <div className="flex items-center gap-2 flex-wrap">
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={<LuCalendar size={12} className="ml-1" />}
                  className="text-xs font-bold"
                >
                  {periodLabel}
                </Chip>
                <Chip
                  size="sm"
                  variant="flat"
                  color="secondary"
                  startContent={<LuStore size={12} className="ml-1" />}
                  className="text-xs font-bold"
                >
                  {storeName}
                </Chip>
              </div>
            </ModalHeader>

            <ModalBody className="p-0 bg-default-100/50 flex flex-col items-center justify-center min-h-[580px]">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 py-20 text-default-500">
                  <Spinner size="lg" color="primary" />
                  <p className="text-sm font-semibold">Generando documento ejecutivo...</p>
                </div>
              ) : pdfData ? (
                <iframe
                  src={pdfData.blobUrl}
                  title="Visor de Reporte PDF"
                  className="w-full h-[620px] border-none"
                />
              ) : (
                <div className="py-20 text-center text-default-400">
                  <p className="text-sm">No hay datos disponibles para generar el reporte.</p>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="border-t border-default-200 px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs text-default-400 text-center sm:text-left">
                {pdfData ? (
                  <span>Archivo: <strong className="text-foreground">{pdfData.filename}</strong></span>
                ) : (
                  <span>Listo para exportar</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="flat"
                  color="default"
                  size="sm"
                  onPress={onClose}
                  className="font-semibold"
                >
                  Cerrar
                </Button>

                <Button
                  variant="flat"
                  color="primary"
                  size="sm"
                  startContent={<LuExternalLink size={15} />}
                  onPress={handleOpenNewTab}
                  isDisabled={!pdfData}
                  className="font-semibold"
                >
                  Ver en pestaña
                </Button>

                <Button
                  color="primary"
                  variant="solid"
                  size="sm"
                  startContent={<LuDownload size={15} />}
                  onPress={handleDownload}
                  isDisabled={!pdfData}
                  className="font-bold shadow-md shadow-primary/20"
                >
                  Descargar PDF
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
