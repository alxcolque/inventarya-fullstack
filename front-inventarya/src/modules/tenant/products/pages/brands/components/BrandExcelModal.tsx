import { useState, useRef } from "react";
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
  Card,
  CardBody,
  Divider,
  ScrollShadow,
} from "@nextui-org/react";
import {
  LuFileSpreadsheet,
  LuDownload,
  LuUploadCloud,
  LuFileText,
  LuCheckCircle,
  LuAlertTriangle,
  LuTrash2,
  LuRefreshCw,
  LuArrowRight,
  LuInfo,
  LuShieldAlert,
} from "react-icons/lu";
import { toast } from "sonner";
import { useBrandsStore, BrandImportResult } from "../../../store/brands/brands.store";

interface BrandExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalBrands: number;
}

export const BrandExcelModal = ({
  isOpen,
  onClose,
  totalBrands,
}: BrandExcelModalProps) => {
  const [activeTab, setActiveTab] = useState<string>("import");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<BrandImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = useBrandsStore((state) => state.downloadTemplate);
  const exportBrands = useBrandsStore((state) => state.exportBrands);
  const importBrands = useBrandsStore((state) => state.importBrands);

  // Reiniciar estado al cerrar o reiniciar proceso
  const handleResetImport = () => {
    setSelectedFile(null);
    setImportReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCloseModal = () => {
    handleResetImport();
    onClose();
  };

  // Validación estricta de archivo: solo Excel o CSV, max 1MB
  const validateAndSetFile = (file: File) => {
    const maxSizeBytes = 1024 * 1024; // 1 MB
    if (file.size > maxSizeBytes) {
      toast.error("El archivo supera el límite permitido de 1MB");
      return;
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv = fileName.endsWith(".csv");

    if (!isExcel && !isCsv) {
      toast.error("Formato no válido. Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)");
      return;
    }

    setSelectedFile(file);
    setImportReport(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Ejecutar importación con reporte detallado
  const handleExecuteImport = async () => {
    if (!selectedFile) {
      toast.error("Selecciona un archivo antes de importar");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await importBrands(selectedFile);
      if (result.success && result.data) {
        setImportReport(result.data);
        if (result.data.resumen.no_importados === 0) {
          toast.success("¡Importación exitosa! Todas las marcas fueron agregadas.");
        } else if (result.data.resumen.importados > 0) {
          toast.warning("Importación parcial: revisa los registros no importados.");
        } else {
          toast.error("No se pudo importar ninguna marca. Revisa el informe.");
        }
      } else {
        toast.error(result.error || "Error al procesar el archivo");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Descargas de plantilla y exportación
  const handleDownloadTemplate = async (format: "xlsx" | "csv") => {
    setIsDownloading(true);
    try {
      await downloadTemplate(format);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    setIsDownloading(true);
    try {
      await exportBrands(format);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      size="2xl"
      backdrop="blur"
      placement="center"
      classNames={{
        base: "border-none shadow-2xl rounded-3xl bg-background overflow-hidden max-h-[90vh]",
        header: "border-b border-divider/40 px-6 py-4",
        body: "px-6 py-4 overflow-y-auto",
        footer: "border-t border-divider/40 px-6 py-3",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/40 text-primary">
                <LuFileSpreadsheet size={20} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-default-900 leading-tight">
                  Importar y Exportar Marcas
                </h3>
                <span className="text-[11px] text-default-400 font-normal">
                  Carga masiva desde Excel/CSV, descarga de plantilla o respaldo de datos
                </span>
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-4">
              {/* Selector de pestañas: 3 opciones */}
              <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as string)}
                color="primary"
                variant="solid"
                radius="lg"
                size="sm"
                fullWidth
                classNames={{
                  tabList: "bg-default-100/60 p-1",
                  tab: "text-xs font-semibold h-8",
                }}
              >
                <Tab
                  key="template"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuDownload size={14} />
                      <span>Descargar plantilla</span>
                    </div>
                  }
                />
                <Tab
                  key="import"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuUploadCloud size={14} />
                      <span>Importar archivo</span>
                    </div>
                  }
                />
                <Tab
                  key="export"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuFileSpreadsheet size={14} />
                      <span>Exportar marcas</span>
                    </div>
                  }
                />
              </Tabs>

              {/* CONTENIDO 1: DESCARGAR PLANTILLA */}
              {activeTab === "template" && (
                <div className="flex flex-col gap-4 py-1">
                  <Card className="border border-divider/50 shadow-none bg-default-50/40 rounded-2xl">
                    <CardBody className="p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-primary-100 text-primary shrink-0 mt-0.5">
                          <LuInfo size={18} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-bold text-default-900">
                            Estructura de la Plantilla Oficial
                          </h4>
                          <p className="text-xs text-default-500 leading-relaxed">
                            Para asegurar una importación sin errores, tus datos deben coincidir
                            con las reglas requeridas:
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-1">
                        <div className="p-3 rounded-xl bg-background border border-divider/40 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-default-900 font-mono">
                                NOMBRE
                              </span>
                              <Chip size="sm" color="danger" variant="flat" className="h-4 text-[9px] px-1">
                                Única Columna Requerida
                              </Chip>
                            </div>
                            <span className="text-[10px] text-default-400 font-mono">Columna A</span>
                          </div>
                          <p className="text-xs text-default-500 leading-relaxed">
                            Nombre de la marca comercial o fabricante. Se convertirá automáticamente a <strong>MAYÚSCULAS</strong>.
                            Si la marca ya existe en el sistema o está duplicada en el archivo, <strong>se omitirá y el proceso continuará</strong> hasta importar todos los registros restantes.
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      startContent={<LuDownload size={14} />}
                      isLoading={isDownloading}
                      onPress={() => handleDownloadTemplate("xlsx")}
                      className="text-xs font-semibold px-4 w-full sm:w-auto"
                    >
                      Descargar Plantilla Excel (.xlsx)
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<LuFileText size={14} />}
                      isLoading={isDownloading}
                      onPress={() => handleDownloadTemplate("csv")}
                      className="text-xs font-semibold px-4 w-full sm:w-auto"
                    >
                      Descargar Plantilla CSV (.csv)
                    </Button>
                  </div>
                </div>
              )}

              {/* CONTENIDO 2: IMPORTAR ARCHIVO */}
              {activeTab === "import" && (
                <div className="flex flex-col gap-3 py-1">
                  {!importReport ? (
                    <>
                      {/* Reglas de Validación Estricta */}
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-default-100/60 text-[11px] text-default-600">
                        <LuShieldAlert size={16} className="text-warning shrink-0" />
                        <span>
                          <strong>Validación Estricta:</strong> Archivos <strong>.xlsx, .xls o .csv</strong> (máx. <strong>1MB</strong>). Se convierten a <strong>MAYÚSCULAS</strong>. Si una marca ya existe, <strong>se omite y continúa</strong> con las demás.
                        </span>
                      </div>

                      {/* Dropzone de Carga de Archivo */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />

                      {selectedFile ? (
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-default-50 border border-divider/60">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 rounded-xl bg-primary-100 text-primary shrink-0">
                              <LuFileSpreadsheet size={22} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-default-900 truncate">
                                {selectedFile.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-default-400">
                                <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                <span>•</span>
                                <span className="uppercase font-mono">
                                  {selectedFile.name.split(".").pop()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={handleResetImport}
                            className="text-default-400 hover:text-danger rounded-lg"
                            aria-label="Quitar archivo"
                          >
                            <LuTrash2 size={16} />
                          </Button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-default-200 hover:border-primary/60 bg-default-50/30 hover:bg-default-100/40 cursor-pointer transition-all text-center"
                        >
                          <div className="p-3 rounded-2xl bg-default-100 text-default-500">
                            <LuUploadCloud size={24} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-default-800">
                              Haz clic o arrastra tu archivo Excel o CSV aquí
                            </span>
                            <span className="text-[11px] text-default-400">
                              Archivos permitidos: .xlsx, .xls, .csv (Máximo 1MB)
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="solid"
                          color="primary"
                          startContent={<LuArrowRight size={14} />}
                          isDisabled={!selectedFile || isProcessing}
                          isLoading={isProcessing}
                          onPress={handleExecuteImport}
                          className="text-xs font-semibold px-5 shadow-sm"
                        >
                          {isProcessing ? "Evaluando e Importando..." : "Evaluar e Importar"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* REPORTE DETALLADO DE IMPORTACIÓN */
                    <div className="flex flex-col gap-3">
                      {/* Métricas de resumen */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 rounded-2xl bg-default-50 border border-divider/40 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold text-default-400 uppercase">
                            Total Procesadas
                          </span>
                          <span className="text-lg font-bold text-default-900 mt-0.5">
                            {importReport.resumen.total_filas}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-success-50 dark:bg-success-950/30 border border-success-200/50 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold text-success-600 dark:text-success-400 uppercase flex items-center gap-1">
                            <LuCheckCircle size={12} /> Importadas
                          </span>
                          <span className="text-lg font-bold text-success-700 dark:text-success-300 mt-0.5">
                            {importReport.resumen.importados}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-danger-50 dark:bg-danger-950/30 border border-danger-200/50 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold text-danger-600 dark:text-danger-400 uppercase flex items-center gap-1">
                            <LuAlertTriangle size={12} /> No Importadas
                          </span>
                          <span className="text-lg font-bold text-danger-700 dark:text-danger-300 mt-0.5">
                            {importReport.resumen.no_importados}
                          </span>
                        </div>
                      </div>

                      {/* Notificación de eliminación automática */}
                      <div className="p-2.5 rounded-xl bg-default-100/70 text-[11px] text-default-600 flex items-center gap-2">
                        <LuCheckCircle size={14} className="text-success shrink-0" />
                        <span>
                          El archivo fue evaluado bajo las reglas y los datos temporales han sido liberados de forma automática.
                        </span>
                      </div>

                      {/* Lista de Errores (si hubo) */}
                      {importReport.errores && importReport.errores.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-danger flex items-center gap-1">
                              <LuAlertTriangle size={13} /> Registros con error ({importReport.errores.length})
                            </span>
                          </div>

                          <ScrollShadow className="max-h-40 overflow-y-auto rounded-xl border border-divider/50 p-2 bg-danger-50/20">
                            <div className="flex flex-col gap-1.5">
                              {importReport.errores.map((err, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background border border-divider/40 text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px] px-1 font-mono">
                                      Fila #{err.fila}
                                    </Chip>
                                    <span className="font-semibold text-default-800">
                                      "{err.nombre}"
                                    </span>
                                  </div>
                                  <span className="text-danger font-medium text-right">
                                    {err.motivo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </ScrollShadow>
                        </div>
                      )}

                      {/* Lista de Marcas Creadas Exitosamente */}
                      {importReport.importados_lista && importReport.importados_lista.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-success flex items-center gap-1">
                            <LuCheckCircle size={13} /> Marcas creadas exitosamente ({importReport.importados_lista.length})
                          </span>

                          <ScrollShadow className="max-h-32 overflow-y-auto rounded-xl border border-divider/50 p-2 bg-success-50/20">
                            <div className="flex flex-wrap gap-1.5">
                              {importReport.importados_lista.map((item, idx) => (
                                <Chip
                                  key={idx}
                                  size="sm"
                                  variant="flat"
                                  color="success"
                                  className="text-[11px] h-6"
                                >
                                  <strong className="font-semibold">{item.nombre}</strong>{" "}
                                  <span className="text-[10px] opacity-75 font-mono">({item.slug})</span>
                                </Chip>
                              ))}
                            </div>
                          </ScrollShadow>
                        </div>
                      )}

                      {/* Botones de acción del informe */}
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<LuRefreshCw size={14} />}
                          onPress={handleResetImport}
                          className="text-xs font-medium"
                        >
                          Importar otro archivo
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          variant="solid"
                          onPress={handleCloseModal}
                          className="text-xs font-semibold px-4"
                        >
                          Entendido y Finalizar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CONTENIDO 3: EXPORTAR MARCAS */}
              {activeTab === "export" && (
                <div className="flex flex-col gap-4 py-1">
                  <Card className="border border-divider/50 shadow-none bg-default-50/40 rounded-2xl">
                    <CardBody className="p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-teal-100 text-teal-700 shrink-0 mt-0.5">
                          <LuFileSpreadsheet size={18} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-bold text-default-900">
                            Exportación de Marcas del Catálogo
                          </h4>
                          <p className="text-xs text-default-500 leading-relaxed">
                            Se generará un archivo con todas las marcas actualmente registradas en el sistema (total: <strong>{totalBrands}</strong> marcas).
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-background border border-divider/40 text-[11px] text-default-600 flex flex-col gap-1">
                        <span className="font-semibold text-default-800">
                          Columnas incluidas en el archivo:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-mono">
                            ID
                          </Chip>
                          <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-mono">
                            NOMBRE
                          </Chip>
                          <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-mono">
                            SLUG
                          </Chip>
                          <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-mono">
                            TIENE_IMAGEN
                          </Chip>
                          <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-mono">
                            FECHA_REGISTRO
                          </Chip>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
                    <Button
                      size="sm"
                      variant="solid"
                      color="primary"
                      startContent={<LuDownload size={14} />}
                      isLoading={isDownloading}
                      isDisabled={totalBrands === 0}
                      onPress={() => handleExport("xlsx")}
                      className="text-xs font-semibold px-4 w-full sm:w-auto shadow-sm"
                    >
                      Exportar a Excel (.xlsx)
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<LuFileText size={14} />}
                      isLoading={isDownloading}
                      isDisabled={totalBrands === 0}
                      onPress={() => handleExport("csv")}
                      className="text-xs font-semibold px-4 w-full sm:w-auto"
                    >
                      Exportar a CSV (.csv)
                    </Button>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button
                size="sm"
                variant="flat"
                onPress={handleCloseModal}
                className="text-xs font-medium"
              >
                Cerrar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
