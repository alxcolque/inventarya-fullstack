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
import { useProductsStore, ProductImportResult } from "../../../store/products/products.store";

interface ProductExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalProducts: number;
}

export const ProductExcelModal = ({
  isOpen,
  onClose,
  totalProducts,
}: ProductExcelModalProps) => {
  const [activeTab, setActiveTab] = useState<string>("import");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<ProductImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = useProductsStore((state) => state.downloadTemplate);
  const exportProducts = useProductsStore((state) => state.exportProducts);
  const importProducts = useProductsStore((state) => state.importProducts);

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

  // Validación estricta: solo Excel o CSV, máx 5MB
  const validateAndSetFile = (file: File) => {
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error("El archivo supera el límite permitido de 5MB");
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
    if (file) validateAndSetFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
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
      const result = await importProducts(selectedFile);
      if (result.success && result.data) {
        setImportReport(result.data);
        if (result.data.resumen.no_importados === 0) {
          toast.success("¡Importación exitosa! Todos los productos fueron agregados.");
        } else if (result.data.resumen.importados > 0) {
          toast.warning("Importación parcial: revisa los registros no importados.");
        } else {
          toast.error("No se pudo importar ningún producto. Revisa el informe.");
        }
      } else {
        toast.error(result.error || "Error al procesar el archivo");
      }
    } finally {
      setIsProcessing(false);
    }
  };

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
      await exportProducts(format);
    } finally {
      setIsDownloading(false);
    }
  };

  // Columnas de la plantilla para mostrar en la UI
  const templateColumns = [
    { col: "A", label: "No.",                required: false, desc: "Número de fila referencial. No se toma como ID ni se registra." },
    { col: "B", label: "Nombre",             required: true,  desc: "Nombre del producto tal como está. Si el producto tiene el mismo nombre pero diferente marca, se registra concatenando el nombre y la marca." },
    { col: "C", label: "Categoría",          required: false, desc: "Categoría simple ('Lácteos') o jerárquica separada por comas ('Alimentos,Lácteos,Frescos'). Cada nivel se resuelve o crea recursivamente. Si está vacía se asigna 'VARIOS'." },
    { col: "D", label: "Marca",              required: false, desc: "Marca del producto. Si está vacía se asigna 'DESCONOCIDO'. Se compara en mayúsculas para no duplicar." },
    { col: "E", label: "Unidad",             required: false, desc: "Unidad de medida tal como está. Si la celda está vacía se registra como 'Unidad'." },
    { col: "F", label: "Cantidad",           required: false, desc: "Cantidad inicial de stock. Si es 0 o está vacía, no se crea registro de almacén." },
    { col: "G", label: "Precio compra",      required: false, desc: "Precio de compra (costo). Si es 0 o está vacío, no se crea registro de almacén a menos que haya precio de venta." },
    { col: "H", label: "Precio venta",       required: false, desc: "Precio de venta al público. Se guarda en 'sale_price' en el inventario. Redondeado a 2 decimales." },
    { col: "I", label: "Stock mínimo",      required: false, desc: "Cantidad mínima de stock antes de mostrar alerta. Se guarda en 'min_stock'." },
    { col: "J", label: "Fecha expiración",  required: false, desc: "Fecha de vencimiento del producto. Formato: YYYY-MM-DD o DD/MM/YYYY. Los valores de fecha de Excel se convierten automáticamente." },
    { col: "K", label: "Código de barras",  required: false, desc: "Código de barras del producto (EAN, UPC, etc.). Se guarda tal cual como texto (no se convierte a número)." },
  ];

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
                  Importar y Exportar Productos
                </h3>
                <span className="text-[11px] text-default-400 font-normal">
                  Carga masiva desde Excel/CSV, descarga de plantilla o respaldo de datos
                </span>
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-4">
              {/* Selector de pestañas */}
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
                      <span>Exportar productos</span>
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
                            Descarga la plantilla y completa los datos. El archivo debe tener exactamente las columnas definidas a continuación:
                          </p>
                        </div>
                      </div>

                      <Divider className="my-1" />

                      <div className="flex flex-col gap-2">
                        {templateColumns.map((col) => (
                          <div
                            key={col.col}
                            className="p-2.5 rounded-xl bg-background border border-divider/40 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-default-400 bg-default-100 px-1.5 py-0.5 rounded">
                                Col. {col.col}
                              </span>
                              <span className="text-xs font-bold text-default-900 font-mono">
                                {col.label}
                              </span>
                              {col.required && (
                                <Chip size="sm" color="danger" variant="flat" className="h-4 text-[9px] px-1">
                                  Obligatorio
                                </Chip>
                              )}
                            </div>
                            <p className="text-[11px] text-default-500 leading-relaxed pl-1">
                              {col.desc}
                            </p>
                          </div>
                        ))}
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
                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-default-100/60 text-[11px] text-default-600">
                        <LuShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <span>
                            <strong>Reglas de Evaluación Automática (.xlsx, .xls, .csv — máx. 5MB):</strong>
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-default-500">
                            <li>Si <strong>Nombre, Categoría, Marca y Unidad</strong> son iguales, se descarta por duplicado.</li>
                            <li>Si <strong>Nombre, Categoría y Marca</strong> son iguales pero la <strong>Unidad es diferente</strong>, se agrega nueva unidad al producto existente.</li>
                            <li>Si <strong>Nombre y Categoría</strong> coinciden pero la <strong>Marca es diferente</strong>, se registra como nuevo producto concatenando Nombre + Marca.</li>
                            <li><strong>Categoría</strong> soporta jerarquía separada por comas: <em>Alimentos,Lácteos,Frescos</em>.</li>
                            <li><strong>Código de barras</strong> se guarda como texto (no como número).</li>
                          </ul>
                        </div>
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
                              Archivos permitidos: .xlsx, .xls, .csv (Máximo 5MB)
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
                            Total Procesados
                          </span>
                          <span className="text-lg font-bold text-default-900 mt-0.5">
                            {importReport.resumen.total_filas}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-success-50 dark:bg-success-950/30 border border-success-200/50 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold text-success-600 dark:text-success-400 uppercase flex items-center gap-1">
                            <LuCheckCircle size={12} /> Importados
                          </span>
                          <span className="text-lg font-bold text-success-700 dark:text-success-300 mt-0.5">
                            {importReport.resumen.importados}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-danger-50 dark:bg-danger-950/30 border border-danger-200/50 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold text-danger-600 dark:text-danger-400 uppercase flex items-center gap-1">
                            <LuAlertTriangle size={12} /> No Importados
                          </span>
                          <span className="text-lg font-bold text-danger-700 dark:text-danger-300 mt-0.5">
                            {importReport.resumen.no_importados}
                          </span>
                        </div>
                      </div>

                      {/* Notificación de limpieza automática */}
                      <div className="p-2.5 rounded-xl bg-default-100/70 text-[11px] text-default-600 flex items-center gap-2">
                        <LuCheckCircle size={14} className="text-success shrink-0" />
                        <span>
                          El archivo fue evaluado bajo las reglas y los datos temporales han sido liberados de forma automática.
                        </span>
                      </div>

                      {/* Lista de Errores */}
                      {importReport.errores && importReport.errores.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-danger flex items-center gap-1">
                            <LuAlertTriangle size={13} /> Registros con error ({importReport.errores.length})
                          </span>
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
                                  <span className="text-danger font-medium text-right shrink-0">
                                    {err.motivo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </ScrollShadow>
                        </div>
                      )}

                      {/* Lista de Productos Importados */}
                      {importReport.importados_lista && importReport.importados_lista.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-success flex items-center gap-1">
                            <LuCheckCircle size={13} /> Productos procesados exitosamente ({importReport.importados_lista.length})
                          </span>
                          <ScrollShadow className="max-h-44 overflow-y-auto rounded-xl border border-divider/50 p-2 bg-success-50/20">
                            <div className="flex flex-col gap-1.5">
                              {importReport.importados_lista.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background border border-divider/40 text-[11px]"
                                >
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-default-900 truncate">{item.nombre}</span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-default-400 flex-wrap">
                                      {item.sku && <span className="font-mono">SKU: {item.sku} •</span>}
                                      <span>Cat: {item.categoria}</span>
                                      <span>•</span>
                                      <span>Marca: {item.marca}</span>
                                      {item.unidad && (
                                        <>
                                          <span>•</span>
                                          <span className="font-semibold text-primary">Unidad: {item.unidad}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {item.tipo && (
                                      <Chip
                                        size="sm"
                                        variant="flat"
                                        color={item.tipo.includes("Nuevo") ? "success" : "primary"}
                                        className="text-[10px] h-5 font-medium"
                                      >
                                        {item.tipo}
                                      </Chip>
                                    )}
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      color="default"
                                      className="text-[10px] h-5 font-mono shrink-0"
                                    >
                                      Fila #{item.fila}
                                    </Chip>
                                  </div>
                                </div>
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

              {/* CONTENIDO 3: EXPORTAR PRODUCTOS */}
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
                            Exportación del Catálogo de Productos
                          </h4>
                          <p className="text-xs text-default-500 leading-relaxed">
                            Se generará un archivo con todos los productos registrados en el sistema (total:{" "}
                            <strong>{totalProducts}</strong> {totalProducts === 1 ? "producto" : "productos"}).
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-background border border-divider/40 text-[11px] text-default-600 flex flex-col gap-1">
                        <span className="font-semibold text-default-800">
                          Columnas incluidas en el archivo:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {["No.", "Nombre", "Categoría", "Marca", "Unidad", "Cantidad", "Precio compra", "Precio venta", "Stock mínimo", "Fecha expiración", "Código de barras"].map((col) => (
                            <Chip key={col} size="sm" variant="flat" color="default" className="text-[10px] h-5 font-mono">
                              {col}
                            </Chip>
                          ))}
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
                      isDisabled={totalProducts === 0}
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
                      isDisabled={totalProducts === 0}
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
