import { usePdfPreview } from '@/hooks/usePdfPreview';
import { downloadPdf, pdfDownloadMessage, pdfErrorMessage } from '@/services/pdfService';
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Card,
  CardBody,
  Divider,
} from "@nextui-org/react";
import {
  FaCashRegister,
  FaMoneyBillWave,
  FaQrcode,
  FaBoxesStacked,
  FaUsers,
  FaFilePdf,
  FaDownload,
  FaPrint,
  FaXmark,
  FaCheck,
  FaCalendarDay,
} from "react-icons/fa6";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getTenantTodayString, toTenantDateString, formatTenantDate } from "@/utils/tenant-date";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { generateCashClosingPdf } from "../utils/generateCashClosingPdf";
import { toast } from "sonner";

interface ModalCashClosingProps {
  isOpen: boolean;
  onClose: () => void;
  sales: any[];
  storeName: string;
  userName?: string;
  companyName?: string;
  nit?: string;
  currencySymbol?: string | null;
}

export const ModalCashClosing: React.FC<ModalCashClosingProps> = ({
  isOpen,
  onClose,
  sales,
  storeName,
  userName = "Administrador",
  companyName = "SISTEMA DE VENTAS",
  nit = "-",
  currencySymbol = "$",
}) => {
  const { url: pdfPreviewUrl, open: openPreview, clear: clearPreview } = usePdfPreview();
  useEffect(() => { if (!isOpen) clearPreview(); }, [isOpen, clearPreview]);

  // Filtrar solo las ventas de la fecha de hoy según el timezone del tenant
  const todayStr = getTenantTodayString();
  const todaySales = useMemo(() => {
    return sales.filter((s) => {
      const saleDate = toTenantDateString(s.created_at || s.order_date);
      return saleDate === todayStr;
    });
  }, [sales, todayStr]);

  // Cálculos de totales
  const stats = useMemo(() => {
    let cash = 0;
    let qr = 0;
    let other = 0;
    let total = 0;
    const productsMap = new Map<string, { name: string; sku: string; quantity: number; subtotal: number }>();

    todaySales.forEach((sale) => {
      const saleTotal = parseFloat(sale.total) || 0;
      total += saleTotal;

      const method = (sale.payment_method || "efectivo").toLowerCase();
      if (method.includes("efectivo") || method.includes("cash")) {
        cash += saleTotal;
      } else if (method.includes("qr") || method.includes("transferencia")) {
        qr += saleTotal;
      } else {
        other += saleTotal;
      }

      const details = sale.saleDetails || sale.sale_details || [];
      details.forEach((det: any) => {
        const prodName = det.product?.name || det.product_name || det.name || `Producto #${det.product_id || ""}`;
        const prodSku = det.product?.sku || det.sku || "-";
        const key = `${prodName}_${prodSku}`;
        const qty = Number(det.quantity) || 1;
        const sub = parseFloat(det.subtotal) || Number(det.price || 0) * qty;

        if (!productsMap.has(key)) {
          productsMap.set(key, { name: prodName, sku: prodSku, quantity: 0, subtotal: 0 });
        }
        const existing = productsMap.get(key)!;
        existing.quantity += qty;
        existing.subtotal += sub;
      });
    });

    return {
      cash,
      qr,
      other,
      total,
      count: todaySales.length,
      products: Array.from(productsMap.values()).sort((a, b) => b.quantity - a.quantity),
    };
  }, [todaySales]);

  const handleDownloadPdf = async () => {
    try {
      const { doc, filename } = generateCashClosingPdf({
        sales: todaySales,
        date: new Date(),
        storeName,
        userName,
        companyName,
        nit,
        currencySymbol,
      });
      await downloadPdf(doc, filename);
      toast.success(pdfDownloadMessage());
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    }
  };

  const handlePreviewPdf = async () => {
    try {
      await openPreview(() => {
      const { doc, filename } = generateCashClosingPdf({
        sales: todaySales,
        date: new Date(),
        storeName,
        userName,
        companyName,
        nit,
        currencySymbol,
      });
      return { pdf: doc, filename };
      });
    } catch (err) {
      toast.error(pdfErrorMessage(err));
    }
  };

  const handleClose = () => {
    clearPreview();
    onClose();
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
      handleClose();
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
      onClose={handleClose}
      size="4xl"
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
        base: "bg-background border border-default-200 shadow-2xl m-0 sm:my-auto rounded-t-[28px] rounded-b-none sm:rounded-3xl max-h-[90dvh] sm:max-h-[90vh] overflow-hidden w-full max-w-full sm:max-w-4xl",
        header: "border-b border-default-100 py-3 px-4 sm:px-6 shrink-0",
        body: "py-2 px-3 sm:px-4 overflow-y-auto overscroll-contain",
        footer: "border-t border-default-100 py-2.5 px-4 sm:px-6 shrink-0",
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
              onClick={handleClose}
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
                      Cierre de Caja
                    </h3>
                    <p className="text-[11px] sm:text-xs text-default-400 truncate">
                      {formatTenantDate(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")} · Sucursal: <b>{storeName}</b>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Chip color="primary" variant="flat" size="sm" className="font-bold h-6 text-xs">
                    {stats.count} {stats.count === 1 ? "venta" : "ventas"} hoy
                  </Chip>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    aria-label="Cerrar modal"
                    onPress={handleClose}
                    className="h-8 w-8 min-w-8 bg-default-100 dark:bg-default-100/50 text-default-500 hover:text-foreground active:scale-95 transition-all"
                  >
                    <FaXmark size={15} />
                  </Button>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-2">
              {/* VISTA PREVIA DEL PDF SI SE ACTIVÓ */}
              {pdfPreviewUrl ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-default-600">Previsualización del Documento PDF:</span>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      className="font-semibold text-xs h-7"
                      onPress={() => clearPreview()}
                    >
                      Volver a Resumen
                    </Button>
                  </div>
                  <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-default-200 bg-default-100">
                    <iframe src={pdfPreviewUrl} title="Vista previa Cierre" className="w-full h-full" />
                  </div>
                </div>
              ) : (
                <>
                  {/* BENTO CARDS DE INGRESOS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Efectivo */}
                    <Card className="border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
                      <CardBody className="p-4 flex flex-row items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Total en Efectivo
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                            <PriceDisplay amount={stats.cash} compact />
                          </span>
                          <span className="text-[10px] text-default-400">
                            {stats.total > 0 ? ((stats.cash / stats.total) * 100).toFixed(1) : 0}% del ingreso total
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                          <FaMoneyBillWave className="text-2xl" />
                        </div>
                      </CardBody>
                    </Card>

                    {/* QR / Transferencia */}
                    <Card className="border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-none">
                      <CardBody className="p-4 flex flex-row items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            Total QR / Transferencia
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                            <PriceDisplay amount={stats.qr} compact />
                          </span>
                          <span className="text-[10px] text-default-400">
                            {stats.total > 0 ? ((stats.qr / stats.total) * 100).toFixed(1) : 0}% del ingreso total
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                          <FaQrcode className="text-2xl" />
                        </div>
                      </CardBody>
                    </Card>

                    {/* Total General Recaudado */}
                    <Card className="border border-default-200 bg-background shadow-none">
                      <CardBody className="p-4 flex flex-row items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
                            Total General del Día
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                            <PriceDisplay amount={stats.total} compact />
                          </span>
                          <span className="text-[10px] text-default-400">
                            {stats.count} transacción(es) registrada(s)
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                          <FaCashRegister className="text-2xl" />
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* TABLA DE PRODUCTOS VENDIDOS HOY */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                        <FaBoxesStacked className="text-primary text-xs" /> Productos Vendidos en el Día (
                        {stats.products.length})
                      </h4>
                      <span className="text-[11px] font-semibold text-default-400">
                        Total unidades: {stats.products.reduce((acc, p) => acc + p.quantity, 0)} u.
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-default-200 rounded-2xl bg-background max-h-48 scrollbar-thin">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-default-100/70 border-b border-default-200 text-default-500 font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3">Producto</th>
                            <th className="py-2.5 px-2 w-28">SKU</th>
                            <th className="py-2.5 px-2 w-24 text-center">Cantidad</th>
                            <th className="py-2.5 px-3 w-28 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                          {stats.products.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-default-400 text-xs">
                                No se registraron productos vendidos en la fecha de hoy.
                              </td>
                            </tr>
                          ) : (
                            stats.products.map((p, idx) => (
                              <tr key={idx} className="hover:bg-default-50/50">
                                <td className="py-2 px-3 font-semibold text-foreground truncate max-w-[280px]">
                                  {p.name}
                                </td>
                                <td className="py-2 px-2 text-default-400 font-mono text-[11px]">{p.sku}</td>
                                <td className="py-2 px-2 text-center font-bold text-foreground">{p.quantity} u.</td>
                                <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                  <PriceDisplay amount={p.subtotal} />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* TABLA DE CLIENTES / COMPROBANTES DE HOY */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                      <FaUsers className="text-primary text-xs" /> Detalle de Ventas a Clientes ({todaySales.length})
                    </h4>

                    <div className="overflow-x-auto border border-default-200 rounded-2xl bg-background max-h-48 scrollbar-thin">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-default-100/70 border-b border-default-200 text-default-500 font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3 w-24">N° Ticket</th>
                            <th className="py-2.5 px-2">Cliente</th>
                            <th className="py-2.5 px-2 w-24 text-center">Método</th>
                            <th className="py-2.5 px-3 w-28 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                          {todaySales.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-default-400 text-xs">
                                No se emitieron comprobantes el día de hoy.
                              </td>
                            </tr>
                          ) : (
                            todaySales.map((s) => {
                              const methodLower = (s.payment_method || "efectivo").toLowerCase();
                              const isQr = methodLower.includes("qr") || methodLower.includes("transferencia");

                              return (
                                <tr key={s.id} className="hover:bg-default-50/50">
                                  <td className="py-2 px-3 font-mono font-bold text-default-600">
                                    #{String(s.id).slice(-6)}
                                  </td>
                                  <td className="py-2 px-2 font-medium text-foreground truncate max-w-[280px]">
                                    {s.customer_name || s.name}
                                    {s.phone && (
                                      <span className="text-default-400 font-normal text-[10px] ml-1.5">
                                        ({s.phone})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      color={isQr ? "secondary" : "success"}
                                      className="font-bold text-[10px] h-4 px-1"
                                    >
                                      {isQr ? "QR" : "Efectivo"}
                                    </Chip>
                                  </td>
                                  <td className="py-2 px-3 text-right font-black text-foreground">
                                    <PriceDisplay amount={s.total} />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <span className="text-[11px] text-default-400 hidden sm:inline">
                El PDF incluye arqueo de fondos, desglose de métodos de pago y campos de firma.
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

                {!pdfPreviewUrl && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    className="font-bold text-xs"
                    startContent={<FaPrint />}
                    onPress={handlePreviewPdf}
                    isDisabled={todaySales.length === 0}
                  >
                    Previo
                  </Button>
                )}

                <Button
                  size="sm"
                  color="primary"
                  className="font-bold text-xs shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                  startContent={<FaDownload />}
                  onPress={handleDownloadPdf}
                  isDisabled={todaySales.length === 0}
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
