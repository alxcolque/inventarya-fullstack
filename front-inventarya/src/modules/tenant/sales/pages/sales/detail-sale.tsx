import { usePdfPreview } from '@/hooks/usePdfPreview';
import { pdfDownloadMessage, pdfErrorMessage } from '@/services/pdfService';
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@nextui-org/react";
import {
  FaArrowLeft,
  FaPrint,
  FaDownload,
  FaStore,
  FaReceipt,
  FaCheckCircle,
  FaBan,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useDetailSalesStore } from "../../store/detail-sales/detail-sales.store";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useSettingStore } from "@/stores";
import { getImageUrl } from "@/utils/image";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { useCurrency } from "@/stores/currency/currency.store";
import {
  downloadSaleTicketPdf,
  generateSaleTicketPdf,
} from "../../utils/generateSaleTicketPdf";
import { formatTenantDate, getTenantTimezone } from "@/utils/tenant-date";
import { saleRefundApi } from "../../api/saleRefundApi";

export const DetailSale = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const { url: pdfBlobUrl, open: openPreview, clear: clearPreview } = usePdfPreview();
  useEffect(() => { if (!isPdfModalOpen) clearPreview(); }, [isPdfModalOpen, clearPreview]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Estados para cancelación comercial (Fase 6B.3D)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const shop = useShopsStore((state) => state.shop);
  const getShopBySlug = useShopsStore((state) => state.getShopBySlug);
  const systemData = useSettingStore((state) => state.systemData) as any;
  const getSystemData = useSettingStore((state) => state.getSystemData);

  const sale = useDetailSalesStore((state) => state.sale) as any;
  const detailSales = useDetailSalesStore((state) => state.detailSales) as any[];
  const getDetailSale = useDetailSalesStore((state) => state.getDetailSale);
  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);
  const { symbol: currencySymbol } = useCurrency();

  const canCancelPermission = can('sales:cancel');
  const isCancelled = sale?.status === 'cancelled';
  const hasRefunds = (Array.isArray(sale?.refunds) && sale.refunds.length > 0) || sale?.status === 'refunded' || sale?.status === 'partially_refunded';
  const isCompleted = sale?.status === 'completed' || sale?.status === 'completado';
  const canCancel = canCancelPermission && isCompleted && !hasRefunds && !isCancelled;
  const hasElectronicInvoice = !!sale?.has_electronic_invoice || !!sale?.electronic_invoice || !!sale?.electronicInvoice;

  // Timezone configurada estrictamente desde la tabla de settings
  const tenantTimezone = useMemo(() => {
    return systemData?.timezone || getTenantTimezone();
  }, [systemData?.timezone]);

  useEffect(() => {
    if (id && token) {
      getDetailSale(id, token);
    }
    getSystemData();
  }, [id, token]);

  useEffect(() => {
    if (slug && token) {
      getShopBySlug(slug, token);
    }
  }, [slug, token]);

  const getProductName = (item: any): string => {
    if (item.product_name) return item.product_name;
    if (typeof item.product === "object" && item.product !== null) {
      return item.product.name || "Producto";
    }
    if (typeof item.product === "string") {
      return item.product;
    }
    return "Producto";
  };

  // Descarga directa del PDF
  const handleDownload = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadSaleTicketPdf({
        sale,
        detailSales,
        shop,
        systemData,
        currencySymbol,
      });
      toast.success(pdfDownloadMessage());
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Genera y abre el modal de previsualización del ticket PDF
  const handleOpenTicketPdfPreview = async () => {
    setIsGeneratingPdf(true);
    try {
      const webPreview = await openPreview(async () => ({ pdf: await generateSaleTicketPdf({
        sale,
        detailSales,
        shop,
        systemData,
        currencySymbol,
      }), filename: "ticket-venta-" + (sale?.id || "ticket") + ".pdf" }));
      setIsPdfModalOpen(webPreview);
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Manejador de cancelación comercial (Fase 6B.3D y 6B.4A)
  const handleCancelSale = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error("La cancelación comercial requiere conexión activa con el servidor. Operación no disponible en modo offline.");
      return;
    }
    if (!sale?.id) return;
    setIsCancelling(true);
    try {
      await saleRefundApi.cancelSale(sale.id, {
        reason: cancelReason.trim() || undefined,
      });
      toast.success("Venta cancelada comercialmente con éxito");
      setIsCancelModalOpen(false);
      setCancelReason("");
      if (token) {
        getDetailSale(sale.id, token);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Error al cancelar la venta";
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const totalAmount = detailSales.reduce(
    (acc: number, item: any) => acc + item.price * item.quantity,
    0
  );
  const discountAmount = Number(sale?.discount || 0);
  const finalAmount = Math.max(0, totalAmount - discountAmount);

  // Fecha formateada en el timezone de la tabla settings
  const rawDate = sale?.created_at || sale?.order_date;
  const formattedSaleDate = rawDate
    ? formatTenantDate(rawDate, "dd/MM/yyyy HH:mm", tenantTimezone)
    : "-";

  return (
    <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-col gap-3 pb-28 sm:pb-8 touch-pan-y">
      {/* Barra de Acciones Superior (Oculta en Impresión) */}
      <div className="flex items-center justify-between no-print border-b border-default-200 pb-2.5 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="flat"
            color="default"
            size="sm"
            startContent={<FaArrowLeft />}
            onPress={() => (slug ? navigate(`/tienda/${slug}/ventas`) : navigate(-1))}
            className="font-semibold text-xs"
          >
            <span className="hidden sm:inline">Volver a </span>Ventas
          </Button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* BOTÓN PREVISUALIZAR TICKET PDF */}
          <Button
            color="primary"
            variant="solid"
            size="sm"
            isLoading={isGeneratingPdf}
            startContent={!isGeneratingPdf && <FaReceipt />}
            onPress={handleOpenTicketPdfPreview}
            className="font-bold text-xs shadow-sm"
          >
            <span>Ver Ticket</span>
          </Button>
          {/* BOTÓN DESCARGAR PDF */}
          <Button
            color="success"
            variant="flat"
            size="sm"
            isLoading={isDownloadingPdf}
            startContent={!isDownloadingPdf && <FaDownload />}
            onPress={handleDownload}
            className="font-semibold text-xs"
          >
            <span className="hidden sm:inline">Descargar </span>PDF
          </Button>

          {/* BOTÓN CANCELAR VENTA (FASE 6B.3D) */}
          {canCancel && (
            <Button
              color="danger"
              variant="flat"
              size="sm"
              startContent={<FaBan />}
              onPress={() => setIsCancelModalOpen(true)}
              className="font-semibold text-xs"
            >
              Cancelar venta
            </Button>
          )}
        </div>
      </div>

      {/* Estilos específicos para impresión directa de ticket térmico */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .my-sale-detail, .my-sale-detail * {
            visibility: visible !important;
          }
          .my-sale-detail {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            padding: 4mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
            color: black !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Recibo / Ticket de Venta */}
      <div className="flex justify-center w-full">
        <Card className="my-sale-detail w-full max-w-lg border border-default-200 shadow-sm bg-background rounded-2xl overflow-hidden">
          <CardBody className="p-4 sm:p-8 flex flex-col gap-4 sm:gap-5">
            {/* Encabezado del Recibo */}
            <div className="flex flex-col items-center text-center gap-1.5 border-b border-default-200 pb-4">
              {shop?.front_image ? (
                <img
                  src={getImageUrl(shop.front_image)}
                  alt="Logo Tienda"
                  className="h-12 sm:h-14 w-auto object-contain rounded-lg mb-1"
                  onError={(e: any) => {
                    e.currentTarget.src = "/favicon.ico";
                  }}
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg mb-1">
                  <FaStore />
                </div>
              )}

              <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                {systemData?.name || shop?.name || "INVENTARYA POS"}
              </h1>
              <p className="text-xs text-default-500">
                NIT: <span className="font-semibold text-foreground">{systemData?.nit || "-"}</span>
              </p>
              <p className="text-xs text-default-500 font-medium">
                Sucursal: <span className="text-foreground font-semibold">{shop?.name || "Tienda"}</span>
              </p>
              {shop?.address && (
                <p className="text-xs text-default-400 max-w-xs">{shop.address}</p>
              )}

              {isCancelled ? (
                <div className="mt-1.5 flex flex-col items-center gap-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-400 rounded-full text-xs font-bold border border-danger-200 dark:border-danger-800">
                    <FaBan size={12} />
                    <span>VENTA CANCELADA</span>
                  </div>
                  <div className="text-[11px] text-danger-600 dark:text-danger-400 text-center max-w-sm mt-0.5 space-y-0.5">
                    {sale?.cancellation_reason && (
                      <p><span className="font-semibold">Motivo:</span> {sale.cancellation_reason}</p>
                    )}
                    {sale?.cancelled_at && (
                      <p><span className="font-semibold">Fecha:</span> {formatTenantDate(sale.cancelled_at, "dd/MM/yyyy HH:mm", tenantTimezone)}</p>
                    )}
                    {(sale?.cancelled_by || sale?.cancelledBy) && (
                      <p><span className="font-semibold">Por:</span> {(sale?.cancelled_by || sale?.cancelledBy)?.name || (sale?.cancelled_by || sale?.cancelledBy)?.username || "Usuario"}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 inline-flex items-center gap-1 px-3 py-1 bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400 rounded-full text-xs font-bold">
                  <FaCheckCircle size={12} />
                  <span>VENTA: {sale?.id || id}</span>
                </div>
              )}
            </div>

            {/* Metadatos de la Venta */}
            <div className="grid grid-cols-2 gap-3 text-xs border-b border-default-200 pb-4">
              <div>
                <span className="text-default-400 block text-[11px]">Fecha y Hora:</span>
                <span className="font-semibold text-foreground">
                  {formattedSaleDate}
                </span>
              </div>

              <div>
                <span className="text-default-400 block text-[11px]">Atendido por:</span>
                <span className="font-semibold text-foreground">
                  {sale?.user?.username || sale?.user?.name || "Personal de Ventas"}
                </span>
              </div>

              <div>
                <span className="text-default-400 block text-[11px]">Cliente:</span>
                <span className="font-semibold text-foreground truncate block">
                  {sale?.customer?.name || sale?.name || "Cliente General"}
                </span>
              </div>

              <div>
                <span className="text-default-400 block text-[11px]">Método de Pago:</span>
                <Chip size="sm" variant="flat" color="primary" className="capitalize text-tiny font-bold h-5">
                  {sale?.payment_method || "Efectivo"}
                </Chip>
              </div>
            </div>

            {/* Tabla de Productos */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-default-500 uppercase tracking-wider">
                Detalle de Productos
              </span>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-default-200 text-default-400 font-bold text-[11px]">
                    <th className="text-left py-2 pr-1">DESCRIPCIÓN</th>
                    <th className="text-center py-2 w-12">CANT</th>
                    <th className="text-right py-2 w-16">P.U.</th>
                    <th className="text-right py-2 w-20">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {detailSales.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-default-100 last:border-none">
                      <td className="py-2.5 font-medium text-foreground break-words pr-1">
                        {getProductName(item)}
                      </td>
                      <td className="text-center py-2.5 font-bold">{item.quantity}</td>
                      <td className="text-right py-2.5 text-default-600">
                        <PriceDisplay amount={item.price} />
                      </td>
                      <td className="text-right py-2.5 font-bold text-foreground">
                        <PriceDisplay amount={item.price * item.quantity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Divider />

            {/* Resumen de Totales */}
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between items-center text-default-500 text-xs sm:text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold text-foreground">
                  <PriceDisplay amount={totalAmount} />
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-danger-500 font-medium text-xs sm:text-sm">
                  <span>Descuento aplicado:</span>
                  <span>
                    -<PriceDisplay amount={discountAmount} />
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-base sm:text-lg font-extrabold text-foreground pt-2 border-t border-default-200">
                <span>TOTAL PAGADO:</span>
                <span className="text-xl sm:text-2xl text-primary font-black">
                  <PriceDisplay amount={finalAmount} />
                </span>
              </div>
            </div>

            {/* Cláusulas de Garantía y Mensaje */}
            <div className="bg-default-50 rounded-xl p-3 border border-default-200 text-center text-[11px] text-default-500 flex flex-col gap-0.5">
              <p className="font-bold text-default-700">¡Gracias por su preferencia!</p>
              <p>GARANTÍA: 30 días presentando este comprobante.</p>
              <p className="text-[10px] text-default-400">
                No cubre daños ocasionados por golpes, humedad o manipulación indebida.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN DE TICKET PDF */}
      <Modal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-content1 shadow-2xl rounded-2xl max-w-xl mx-2",
          header: "border-b border-default-200 py-3 px-4",
          body: "p-2 sm:p-4",
          footer: "border-t border-default-200 py-2.5 px-4",
        }}
      >
        <ModalContent>
          {(onCloseModal) => (
            <>
              <ModalHeader className="flex items-center gap-2 text-foreground">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <FaReceipt className="text-sm" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">
                    Vista Previa Ticket PDF #{sale?.id || id}
                  </span>
                  <span className="text-[10px] text-default-400 font-normal">
                    Formato térmico de 80mm listo para imprimir o descargar
                  </span>
                </div>
              </ModalHeader>

              <ModalBody className="flex flex-col items-center">
                {pdfBlobUrl ? (
                  <div className="w-full h-[65vh] rounded-xl overflow-hidden border border-default-200 bg-default-100 flex flex-col">
                    <iframe
                      src={pdfBlobUrl}
                      title="Vista previa del ticket"
                      className="w-full h-full border-none"
                    />
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <Spinner size="lg" color="primary" />
                    <p className="text-xs text-default-400">Generando documento...</p>
                  </div>
                )}
              </ModalBody>

              <ModalFooter className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="light"
                  color="default"
                  onPress={onCloseModal}
                  className="text-xs font-semibold"
                >
                  Cerrar
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    color="success"
                    variant="flat"
                    startContent={<FaDownload size={13} />}
                    onPress={handleDownload}
                    className="font-bold text-xs h-8"
                  >
                    Descargar PDF
                  </Button>

                  <Button
                    size="sm"
                    color="primary"
                    variant="solid"
                    startContent={<FaPrint size={13} />}
                    onPress={() => {
                      if (pdfBlobUrl) {
                        const win = window.open(pdfBlobUrl, "_blank");
                        win?.focus();
                      } else {
                        window.print();
                      }
                    }}
                    className="font-bold text-xs h-8 shadow-sm"
                  >
                    Imprimir
                  </Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* MODAL DE CANCELACIÓN COMERCIAL (FASE 6B.3D) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isCancelling && setIsCancelModalOpen(false)}
        size="md"
        classNames={{
          base: "bg-content1 shadow-2xl rounded-2xl max-w-md mx-2",
          header: "border-b border-default-200 py-3 px-4",
          body: "p-4 sm:p-5 flex flex-col gap-3",
          footer: "border-t border-default-200 py-2.5 px-4",
        }}
      >
        <ModalContent>
          {(onCloseModal) => (
            <>
              <ModalHeader className="flex items-center gap-2 text-danger-600">
                <div className="p-1.5 rounded-lg bg-danger/10 text-danger">
                  <FaBan className="text-base" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">
                    Cancelar Venta Comercial #{sale?.id || id}
                  </span>
                  <span className="text-[10px] text-default-400 font-normal">
                    Compensación total con integridad histórica
                  </span>
                </div>
              </ModalHeader>

              <ModalBody>
                <div className="p-3 bg-danger-50 dark:bg-danger-950/30 border border-danger-200 dark:border-danger-800 rounded-xl text-xs text-danger-700 dark:text-danger-300">
                  <p className="font-semibold mb-1">Confirmación requerida:</p>
                  <p>
                    Esta acción cancelará comercialmente la venta, restaurará el inventario y compensará los pagos. No elimina el historial.
                  </p>
                </div>

                {hasElectronicInvoice && (
                  <div className="p-3 bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 rounded-xl text-xs text-warning-800 dark:text-warning-300 flex items-start gap-2">
                    <FaExclamationTriangle className="text-sm shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Factura Electrónica Existente</p>
                      <p>
                        La cancelación comercial no anula automáticamente la factura electrónica. El documento fiscal debe gestionarse por separado.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-xs font-bold text-default-600">
                    Motivo de la cancelación (opcional)
                  </label>
                  <Textarea
                    placeholder="Ej. Error en registro de venta, solicitud de anulación del cliente..."
                    value={cancelReason}
                    onValueChange={setCancelReason}
                    minRows={2}
                    maxRows={4}
                    variant="bordered"
                    size="sm"
                    className="w-full text-xs"
                    isDisabled={isCancelling}
                  />
                </div>
              </ModalBody>

              <ModalFooter className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="light"
                  color="default"
                  onPress={onCloseModal}
                  isDisabled={isCancelling}
                  className="text-xs font-semibold"
                >
                  Regresar
                </Button>

                <Button
                  size="sm"
                  color="danger"
                  variant="solid"
                  isLoading={isCancelling}
                  startContent={!isCancelling && <FaBan size={12} />}
                  onPress={handleCancelSale}
                  className="font-bold text-xs"
                >
                  Confirmar Cancelación
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default DetailSale;