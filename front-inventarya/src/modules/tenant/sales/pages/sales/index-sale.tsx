import { pdfDownloadMessage, pdfErrorMessage } from '@/services/pdfService';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableCell,
  TableBody,
  TableRow,
  TableColumn,
  Tooltip,
  Chip,
  Button,
  Spinner,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  Pagination,
  Accordion,
  AccordionItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
} from "@nextui-org/react";
import {
  FaArrowLeft,
  FaEye,
  FaMagnifyingGlass,
  FaReceipt,
  FaMoneyBillWave,
  FaQrcode,
  FaCashRegister,
  FaFilePdf,
  FaCalendarDays,
  FaStore,
  FaFilter,
  FaRotateRight,
  FaBoxesStacked,
  FaCoins,
  FaPrint,
  FaDownload,
  FaCircleCheck as FaCheckCircle,
} from "react-icons/fa6";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getTenantDateRange, toTenantDateString, formatTenantDate, getTenantTimezone } from "@/utils/tenant-date";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useOrdersStore } from "../../store/orders/orders.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useDetailSalesStore } from "../../store/detail-sales/detail-sales.store";
import { useSettingStore } from "@/stores";
import { useCurrency } from "@/stores/currency/currency.store";
import { PriceDisplay, CompactNumber } from "@/components";
import { ModalCashClosing } from "../../components/modal-cash-closing";
import { ModalSalesReportPreview } from "../../components/modal-sales-report-preview";
import { downloadSaleTicketPdf } from "../../utils/generateSaleTicketPdf";
import { getImageUrl } from "@/utils/image";

type PeriodFilterType = "today" | "this_week" | "this_month" | "last_month" | "custom" | "all";

interface Props {
  onClose?: () => void;
}

export const IndexSale: React.FC<Props> = ({ onClose }) => {
  const { slug: urlSlug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const user = useTenantAuthStore((state) => state.user);
  const { symbol: currencySymbol } = useCurrency();

  // Stores
  const sales = useOrdersStore((state) => state.sales);
  const isLoading = useOrdersStore((state) => state.isLoading);
  const getSales = useOrdersStore((state) => state.getSales);
  const getSalesInStore = useOrdersStore((state) => state.getSalesInStore);

  const shops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);
  const systemData = useSettingStore((state) => state.systemData) as any;
  const getSystemData = useSettingStore((state) => state.getSystemData);

  const getDetailSale = useDetailSalesStore((state) => state.getDetailSale);
  const storeDetailSales = useDetailSalesStore((state) => state.detailSales) as any[];

  // Estados de Filtros
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Paginación
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Modales
  const [isCashClosingOpen, setIsCashClosingOpen] = useState(false);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);

  // Modal Previo de Detalle de Venta
  const [selectedSaleForPreview, setSelectedSaleForPreview] = useState<any | null>(null);
  const [isSalePreviewOpen, setIsSalePreviewOpen] = useState(false);
  const [isDownloadingTicketPdf, setIsDownloadingTicketPdf] = useState(false);

  // 1. Cargar tiendas y datos del sistema
  useEffect(() => {
    getShops();
    getSystemData();
  }, [getShops, getSystemData]);

  // 2. Establecer tienda inicial según URL o según cantidad de tiendas
  useEffect(() => {
    if (urlSlug) {
      setSelectedStore(urlSlug);
    } else if (shops.length === 1) {
      setSelectedStore(String(shops[0].slug || shops[0].id));
    } else if (shops.length > 1 && selectedStore === "") {
      setSelectedStore("all");
    }
  }, [urlSlug, shops]);

  // 3. Cargar ventas según la tienda seleccionada
  const fetchSalesData = useCallback(() => {
    if (selectedStore && selectedStore !== "all") {
      getSalesInStore(selectedStore);
    } else {
      getSales();
    }
  }, [selectedStore, getSales, getSalesInStore]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const tenantTimezone = useMemo(() => {
    return systemData?.timezone || getTenantTimezone();
  }, [systemData?.timezone]);

  // 4. Fechas computadas según el período seleccionado y el timezone global de settings
  const dateRange = useMemo(() => {
    return getTenantDateRange(periodFilter, customStartDate, customEndDate, tenantTimezone);
  }, [periodFilter, customStartDate, customEndDate, tenantTimezone]);

  // 5. Filtrar ventas por fecha y búsqueda en memoria
  const filteredSales = useMemo(() => {
    return sales.filter((sale: any) => {
      // Filtro por fecha usando estrictamente la timezone del tenant configurada en settings
      if (dateRange.start || dateRange.end) {
        const rawDate = sale.created_at || sale.order_date;
        const saleDateStr = rawDate
          ? toTenantDateString(rawDate, tenantTimezone)
          : (sale.sale_date || "");

        if (dateRange.start && saleDateStr < dateRange.start) return false;
        if (dateRange.end && saleDateStr > dateRange.end) return false;
      }

      // Filtro por tienda si el endpoint trajo todo
      if (selectedStore !== "all" && sale.store_id) {
        const activeShop = shops.find(
          (s) => String(s.slug) === selectedStore || String(s.id) === selectedStore
        );
        if (activeShop && String(sale.store_id) !== String(activeShop.id)) {
          return false;
        }
      }

      // Filtro por texto de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const client = (sale.customer_name || sale.customer?.name || sale.name || "").toLowerCase();
        const ticket = String(sale.id).toLowerCase();
        const method = (sale.payment_method || "").toLowerCase();
        const phone = (sale.phone || "").toLowerCase();

        // Buscar también en los nombres de productos de los detalles
        const details = sale.saleDetails || sale.sale_details || [];
        const hasMatchingProduct = details.some((d: any) => {
          const prodName = (d.product?.name || d.product_name || "").toLowerCase();
          return prodName.includes(q);
        });

        if (!client.includes(q) && !ticket.includes(q) && !method.includes(q) && !phone.includes(q) && !hasMatchingProduct) {
          return false;
        }
      }

      return true;
    });
  }, [sales, dateRange, selectedStore, shops, searchQuery]);

  // 6. Resumen de KPIs sobre las ventas filtradas
  const kpis = useMemo(() => {
    let cash = 0;
    let qr = 0;
    let other = 0;
    let total = 0;

    filteredSales.forEach((s) => {
      const val = parseFloat(s.total) || 0;
      total += val;
      const m = (s.payment_method || "efectivo").toLowerCase();
      if (m.includes("efectivo") || m.includes("cash")) {
        cash += val;
      } else if (m.includes("qr") || m.includes("transferencia")) {
        qr += val;
      } else {
        other += val;
      }
    });

    const count = filteredSales.length;
    const avgTicket = count > 0 ? total / count : 0;

    return { total, cash, qr, other, count, avgTicket };
  }, [filteredSales]);

  // 7. Nombre descriptivo de la tienda actual
  const currentStoreName = useMemo(() => {
    if (selectedStore === "all") return "Todas las Tiendas (General)";
    const found = shops.find((s) => String(s.slug) === selectedStore || String(s.id) === selectedStore);
    return found ? found.name : "Tienda Seleccionada";
  }, [selectedStore, shops]);

  // 8. Paginación
  const pages = Math.ceil(filteredSales.length / rowsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredSales.slice(start, start + rowsPerPage);
  }, [filteredSales, page, rowsPerPage]);

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else if (urlSlug) {
      navigate(`/tienda/${urlSlug}`);
    } else {
      navigate("/tienda");
    }
  };

  // Abrir previo de detalle de venta listo para imprimir
  const handleOpenSalePreview = (sale: any) => {
    setSelectedSaleForPreview(sale);
    if (sale?.id) {
      getDetailSale(String(sale.id), token || undefined);
    }
    setIsSalePreviewOpen(true);
  };

  // Obtener items del detalle del comprobante activo en modal
  const activePreviewDetails = useMemo(() => {
    if (!selectedSaleForPreview) return [];
    if (Array.isArray(storeDetailSales) && storeDetailSales.length > 0) {
      const match = storeDetailSales.some(
        (d: any) => String(d.sale_id || d.order_id) === String(selectedSaleForPreview.id)
      );
      if (match) return storeDetailSales;
    }
    return selectedSaleForPreview.saleDetails || selectedSaleForPreview.sale_details || [];
  }, [selectedSaleForPreview, storeDetailSales]);

  // Tienda del comprobante para previsualización
  const previewShop = useMemo(() => {
    if (!selectedSaleForPreview) return null;
    return (
      shops.find(
        (s) =>
          String(s.id) === String(selectedSaleForPreview.store_id) ||
          String(s.slug) === String(selectedSaleForPreview.store?.slug)
      ) ||
      selectedSaleForPreview.store ||
      shops[0] ||
      null
    );
  }, [selectedSaleForPreview, shops]);

  // Descarga directa en PDF del ticket seleccionado
  const handleDownloadPreviewPdf = async () => {
    if (!selectedSaleForPreview) return;
    setIsDownloadingTicketPdf(true);
    try {
      await downloadSaleTicketPdf({
        sale: selectedSaleForPreview,
        detailSales: activePreviewDetails,
        shop: previewShop,
        systemData,
        currencySymbol,
      });
      toast.success(pdfDownloadMessage());
    } catch (err) {
      console.error("Error al descargar ticket:", err);
      toast.error("Error al generar el comprobante PDF");
    } finally {
      setIsDownloadingTicketPdf(false);
    }
  };

  // Imprimir comprobante
  const handlePrintPreview = () => {
    window.print();
  };

  return (
    <div className="w-full flex flex-col gap-2.5 sm:gap-3 max-w-full pb-28 sm:pb-8 touch-pan-y">
      {/* MODAL CIERRE DE CAJA DEL DÍA */}
      <ModalCashClosing
        isOpen={isCashClosingOpen}
        onClose={() => setIsCashClosingOpen(false)}
        sales={sales}
        storeName={currentStoreName}
        userName={user?.name || "Administrador"}
        companyName={systemData?.name || "INVENTARYA"}
        nit={systemData?.nit || "-"}
        currencySymbol={currencySymbol}
      />

      {/* MODAL DE PREVIEW Y DESCARGA DE REPORTE DE VENTAS */}
      <ModalSalesReportPreview
        isOpen={isReportPreviewOpen}
        onClose={() => setIsReportPreviewOpen(false)}
        reportData={{
          sales: filteredSales,
          periodLabel: dateRange.label,
          storeName: currentStoreName,
          userName: user?.name || "Administrador",
          companyName: systemData?.name || "INVENTARYA",
          nit: systemData?.nit || "-",
          currencySymbol,
        }}
      />

      {/* HEADER DE LA SECCIÓN (100% RESPONSIVO) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
          {(onClose || urlSlug) && (
            <Button
              color="default"
              size="sm"
              variant="flat"
              isIconOnly
              startContent={<FaArrowLeft size={16} />}
              onPress={handleBack}
              title="Volver"
              className="h-9 w-9 min-w-9 shrink-0"
            />
          )}
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2 truncate">
              Gestión y Reportes de Ventas
            </h1>
            <p className="text-[11px] sm:text-xs text-default-400 line-clamp-1 sm:line-clamp-none">
              Control de ingresos, arqueo diario de caja y reportes consolidados por período y sucursales.
            </p>
          </div>
        </div>

        {/* ACCIONES PRINCIPALES: CIERRE DE CAJA Y REPORTES */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            variant="flat"
            color="default"
            isIconOnly
            className="h-9 w-9 min-w-9 shrink-0"
            onPress={fetchSalesData}
            title="Recargar datos"
          >
            <FaRotateRight className={`text-xs ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          {/* BOTÓN CIERRE DE CAJA DEL DÍA */}
          <Button
            size="sm"
            color="success"
            className="font-bold text-xs h-9 px-3 shadow-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex-1 sm:flex-initial"
            startContent={<FaCashRegister className="text-sm shrink-0" />}
            onPress={() => setIsCashClosingOpen(true)}
          >
            <span className="hidden sm:inline">Cierre de </span>Caja
          </Button>

          {/* BOTÓN REPORTE PDF DEL PERÍODO */}
          <Button
            size="sm"
            color="primary"
            variant="solid"
            className="font-bold text-xs h-9 px-3 shadow-sm flex-1 sm:flex-initial"
            startContent={<FaFilePdf className="text-sm shrink-0" />}
            onPress={() => setIsReportPreviewOpen(true)}
            isDisabled={filteredSales.length === 0}
          >
            <span className="hidden sm:inline">Imprimir </span>Reporte
          </Button>
        </div>
      </div>

      {/* KPI BENTO CARDS EN MODO CELULAR (ACORDEÓN COLAPSABLE) */}
      <div className="md:hidden">
        <Accordion
          variant="bordered"
          className="border border-default-200/80 rounded-2xl bg-background/80 backdrop-blur-md shadow-xs px-1"
        >
          <AccordionItem
            key="kpi-sales-accordion"
            aria-label="Resumen de Ventas (KPIs)"
            startContent={
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FaCoins className="text-base" />
              </div>
            }
            title={
              <div className="flex items-center justify-between gap-2 pr-1">
                <span className="text-xs font-bold text-foreground">
                  Resumen de Ventas
                </span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  <PriceDisplay amount={kpis.total} compact />
                </span>
              </div>
            }
            subtitle={
              <div className="flex items-center gap-1.5 text-[11px] text-default-400">
                <span>{kpis.count} comprobante(s)</span>
                <span>•</span>
                <span>Toca para ver desglose</span>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-2 pt-1 pb-2">
              {/* Total Facturado */}
              <Card className="border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
                <CardBody className="p-3 flex flex-col justify-between gap-1">
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
                    Total Facturado
                  </span>
                  <span className="text-lg font-black text-foreground">
                    <PriceDisplay amount={kpis.total} compact />
                  </span>
                  <span className="text-[10px] text-default-400">
                    <CompactNumber value={kpis.count} /> emitido(s)
                  </span>
                </CardBody>
              </Card>

              {/* Efectivo */}
              <Card className="border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
                <CardBody className="p-3 flex flex-col justify-between gap-1">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <FaMoneyBillWave className="text-xs" /> Efectivo
                  </span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    <PriceDisplay amount={kpis.cash} compact />
                  </span>
                  <span className="text-[10px] text-default-400">
                    {kpis.total > 0 ? ((kpis.cash / kpis.total) * 100).toFixed(1) : 0}% del total
                  </span>
                </CardBody>
              </Card>

              {/* QR / Transferencia */}
              <Card className="border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-none">
                <CardBody className="p-3 flex flex-col justify-between gap-1">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <FaQrcode className="text-xs" /> QR / Transf.
                  </span>
                  <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                    <PriceDisplay amount={kpis.qr} compact />
                  </span>
                  <span className="text-[10px] text-default-400">
                    {kpis.total > 0 ? ((kpis.qr / kpis.total) * 100).toFixed(1) : 0}% del total
                  </span>
                </CardBody>
              </Card>

              {/* Transacciones */}
              <Card className="border border-default-200 bg-background/80 shadow-none">
                <CardBody className="p-3 flex flex-col justify-between gap-1">
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
                    N° Ventas
                  </span>
                  <span className="text-lg font-black text-primary">
                    <CompactNumber value={kpis.count} />
                  </span>
                  <span className="text-[10px] text-default-400">En el período</span>
                </CardBody>
              </Card>
            </div>
          </AccordionItem>
        </Accordion>
      </div>

      {/* KPI BENTO CARDS EN MODO DESKTOP / TABLET (GRID) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Ventas Totales */}
        <Card className="border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
          <CardBody className="p-4 flex flex-col justify-between gap-2">
            <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
              Total Facturado
            </span>
            <span className="text-xl sm:text-2xl font-black text-foreground">
              <PriceDisplay amount={kpis.total} compact />
            </span>
            <span className="text-[10px] text-default-400">
              <CompactNumber value={kpis.count} /> comprobante(s) emitido(s)
            </span>
          </CardBody>
        </Card>

        {/* Efectivo */}
        <Card className="border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
          <CardBody className="p-4 flex flex-col justify-between gap-2">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <FaMoneyBillWave className="text-xs" /> Recaudado en Efectivo
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300">
              <PriceDisplay amount={kpis.cash} compact />
            </span>
            <span className="text-[10px] text-default-400">
              {kpis.total > 0 ? ((kpis.cash / kpis.total) * 100).toFixed(1) : 0}% del total
            </span>
          </CardBody>
        </Card>

        {/* QR / Transferencia */}
        <Card className="border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-none">
          <CardBody className="p-4 flex flex-col justify-between gap-2">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <FaQrcode className="text-xs" /> Recaudado por QR
            </span>
            <span className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-300">
              <PriceDisplay amount={kpis.qr} compact />
            </span>
            <span className="text-[10px] text-default-400">
              {kpis.total > 0 ? ((kpis.qr / kpis.total) * 100).toFixed(1) : 0}% del total
            </span>
          </CardBody>
        </Card>

        {/* Transacciones */}
        <Card className="border border-default-200 bg-background/80 shadow-none">
          <CardBody className="p-4 flex flex-col justify-between gap-2">
            <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
              N° Transacciones
            </span>
            <span className="text-xl sm:text-2xl font-black text-primary">
              <CompactNumber value={kpis.count} />
            </span>
            <span className="text-[10px] text-default-400">Ventas en el período</span>
          </CardBody>
        </Card>
      </div>

      {/* BARRA DE FILTROS: TIENDA, PERÍODO, FECHAS Y BÚSQUEDA (RESPONSIVA) */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 bg-background/60 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl border border-default-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* SELECTOR DE PERÍODO */}
          <div className="w-full sm:w-60">
            <Select
              size="sm"
              variant="bordered"
              label="Período"
              selectedKeys={[periodFilter]}
              onChange={(e) => {
                setPeriodFilter((e.target.value as PeriodFilterType) || "this_month");
                setPage(1);
              }}
              startContent={<FaCalendarDays className="text-default-400 text-xs" />}
              classNames={{
                trigger: "h-9 bg-background border-default-300",
              }}
            >
              <SelectItem key="today" value="today">
                Hoy
              </SelectItem>
              <SelectItem key="this_week" value="this_week">
                Esta Semana
              </SelectItem>
              <SelectItem key="this_month" value="this_month">
                Este Mes
              </SelectItem>
              <SelectItem key="last_month" value="last_month">
                Mes Anterior
              </SelectItem>
              <SelectItem key="custom" value="custom">
                Rango Personalizado
              </SelectItem>
              <SelectItem key="all" value="all">
                Todo el Historial
              </SelectItem>
            </Select>
          </div>

          {/* FECHAS PERSONALIZADAS SI CORRESPONDE */}
          {periodFilter === "custom" && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                size="sm"
                variant="bordered"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-36"
                classNames={{ inputWrapper: "h-9 bg-background border-default-300" }}
                title="Fecha inicio"
              />
              <span className="text-xs text-default-400 font-bold hidden sm:inline text-center">a</span>
              <Input
                type="date"
                size="sm"
                variant="bordered"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-36"
                classNames={{ inputWrapper: "h-9 bg-background border-default-300" }}
                title="Fecha fin"
              />
            </div>
          )}
        </div>

        {/* BUSCADOR EN TIEMPO REAL */}
        <div className="w-full lg:w-80">
          <Input
            size="sm"
            variant="bordered"
            placeholder="Buscar por cliente, comprobante o producto..."
            startContent={<FaMagnifyingGlass className="text-default-400 text-xs" />}
            isClearable
            value={searchQuery}
            onValueChange={(val) => {
              setSearchQuery(val);
              setPage(1);
            }}
            classNames={{
              inputWrapper: "h-9 bg-background border-default-300",
              input: "text-xs",
            }}
          />
        </div>
      </div>

      {/* COMPROBANTES DE VENTA (TABLA EN DESKTOP + TARJETAS EN CELULAR) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">
              Comprobantes: <span className="text-primary">{filteredSales.length}</span>
            </span>
            <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5">
              {dateRange.label}
            </Chip>
            {shops.length > 1 && (
              <Chip size="sm" variant="flat" color="secondary" className="text-[10px] h-5">
                {currentStoreName}
              </Chip>
            )}
          </div>

          <span className="text-xs font-bold text-default-500 shrink-0">
            Pág. {page} / {pages}
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 bg-background rounded-3xl border border-default-200">
            <Spinner color="primary" size="lg" />
            <p className="text-default-500 text-xs font-semibold">Cargando registros de ventas...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <Card className="p-10 sm:p-12 text-center bg-background border border-default-200 rounded-3xl shadow-none">
            <CardBody className="flex flex-col items-center justify-center gap-3">
              <div className="p-4 rounded-full bg-default-100 text-default-400">
                <FaReceipt className="text-3xl" />
              </div>
              <h3 className="text-base font-bold text-foreground">No se encontraron ventas</h3>
              <p className="text-default-400 text-xs max-w-sm">
                No hay transacciones registradas que coincidan con la tienda, el período o el término de búsqueda seleccionado.
              </p>
              {(Boolean(searchQuery) || periodFilter !== "this_month" || selectedStore !== "all") && (
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="font-bold text-xs"
                  onPress={() => {
                    setSearchQuery("");
                    setPeriodFilter("this_month");
                    if (shops.length > 1) setSelectedStore("all");
                  }}
                >
                  Restablecer Filtros
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <>
            {/* VISTA MÓVIL: TARJETAS RESPONSIVAS PARA CELULAR */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {paginatedSales.map((sale: any) => {
                const clientName = sale.customer_name || sale.customer?.name || sale.name || "Cliente General";
                const methodLower = (sale.payment_method || "efectivo").toLowerCase();
                const isQr = methodLower.includes("qr") || methodLower.includes("transferencia");
                const isCash = methodLower.includes("efectivo") || methodLower.includes("cash");
                const details = sale.saleDetails || sale.sale_details || [];
                const storeSlug = sale.store?.slug || urlSlug || "alicia";

                let formattedDateStr = "-";
                const rawDate = sale.created_at || sale.order_date;
                if (rawDate) {
                  try {
                    formattedDateStr = formatTenantDate(rawDate, "dd/MM/yyyy HH:mm", tenantTimezone);
                  } catch {
                    formattedDateStr = String(rawDate).slice(0, 16);
                  }
                } else if (sale.formatted_date) {
                  formattedDateStr = sale.formatted_date;
                }

                return (
                  <Card key={sale.id} className="border border-default-200 bg-background shadow-none rounded-2xl">
                    <CardBody className="p-3.5 flex flex-col gap-2.5">
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            #{String(sale.id).slice(-8)}
                          </span>
                          {shops.length > 1 && (
                            <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-semibold">
                              {sale.store?.name || "Tienda"}
                            </Chip>
                          )}
                        </div>
                        <span className="text-[11px] text-default-400 font-medium">
                          {formattedDateStr}
                        </span>
                      </div>

                      {/* Datos del cliente y método de pago */}
                      <div className="flex items-start justify-between gap-2 pt-0.5 border-t border-default-100">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-foreground truncate">
                            {clientName}
                          </span>
                          {sale.phone && (
                            <span className="text-[10px] text-default-400">Tel: {sale.phone}</span>
                          )}
                        </div>

                        <Chip
                          size="sm"
                          variant="flat"
                          color={isQr ? "secondary" : isCash ? "success" : "default"}
                          className="font-bold text-[10px] h-5 px-1.5 shrink-0"
                          startContent={
                            isQr ? (
                              <FaQrcode className="text-[10px] mr-0.5" />
                            ) : isCash ? (
                              <FaMoneyBillWave className="text-[10px] mr-0.5" />
                            ) : undefined
                          }
                        >
                          {isQr ? "QR" : isCash ? "Efectivo" : sale.payment_method || "Otro"}
                        </Chip>
                      </div>

                      {/* Resumen de items del comprobante */}
                      {details.length > 0 && (
                        <div className="text-[11px] text-default-500 bg-default-50 p-2 rounded-xl flex items-center justify-between gap-2">
                          <span className="truncate">
                            {details[0]?.product?.name || details[0]?.product_name || "Producto"}
                            {details[0]?.quantity > 1 ? ` (${details[0].quantity} u.)` : ""}
                          </span>
                          {details.length > 1 && (
                            <span className="text-primary font-bold shrink-0">
                              +{details.length - 1} más
                            </span>
                          )}
                        </div>
                      )}

                      {/* Total y Acciones */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-default-100">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-default-400 font-bold uppercase tracking-wider">
                            Total Pagado
                          </span>
                          <span className="text-base font-black text-foreground">
                            <PriceDisplay amount={sale.total} compact />
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            startContent={<FaReceipt className="text-xs" />}
                            className="font-bold text-xs h-8 px-2.5 shadow-none"
                            onPress={() => handleOpenSalePreview(sale)}
                          >
                            Previo / Imprimir
                          </Button> */}

                          <Tooltip content="Ver página completa">
                            <Button
                              size="sm"
                              isIconOnly
                              variant="light"
                              color="default"
                              className="h-8 w-8 min-w-8 text-default-500"
                              onPress={() => navigate(`/tienda/${storeSlug}/ventas/detalle/${sale.id}`)}
                            >
                              <FaEye className="text-sm" /> Ver
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>

            {/* VISTA ESCRITORIO: TABLA COMPLETA CON BOTÓN DE PREVIO */}
            <div className="hidden md:block overflow-x-auto border border-default-200 rounded-3xl bg-background shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-default-100/70 dark:bg-default-50/50 border-b border-default-200 text-default-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3.5 w-28">N° Venta</th>
                    <th className="py-3 px-3 w-32">Fecha y Hora</th>
                    {shops.length > 1 && <th className="py-3 px-3 w-36">Sucursal</th>}
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Detalle Ítems</th>
                    <th className="py-3 px-3 w-28 text-center">Método</th>
                    <th className="py-3 px-3 w-28 text-right">Total</th>
                    <th className="py-3 px-3 w-24 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-100">
                  {paginatedSales.map((sale: any) => {
                    const clientName = sale.customer_name || sale.customer?.name || sale.name || "Cliente General";
                    const methodLower = (sale.payment_method || "efectivo").toLowerCase();
                    const isQr = methodLower.includes("qr") || methodLower.includes("transferencia");
                    const isCash = methodLower.includes("efectivo") || methodLower.includes("cash");

                    const details = sale.saleDetails || sale.sale_details || [];
                    const storeSlug = sale.store?.slug || urlSlug || "alicia";

                    let formattedDateStr = "-";
                    const rawDate = sale.created_at || sale.order_date;
                    if (rawDate) {
                      try {
                        formattedDateStr = formatTenantDate(rawDate, "dd/MM/yyyy HH:mm", tenantTimezone);
                      } catch {
                        formattedDateStr = String(rawDate).slice(0, 16);
                      }
                    } else if (sale.formatted_date) {
                      formattedDateStr = sale.formatted_date;
                    }

                    return (
                      <tr key={sale.id} className="hover:bg-default-50/70 transition-colors">
                        {/* N° Comprobante */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-foreground">
                          #{String(sale.id).slice(-8)}
                        </td>

                        {/* Fecha y Hora */}
                        <td className="py-2.5 px-3 text-default-500 whitespace-nowrap">
                          {formattedDateStr}
                        </td>

                        {/* Sucursal (si hay más de 1 tienda) */}
                        {shops.length > 1 && (
                          <td className="py-2.5 px-3">
                            <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5 font-semibold">
                              {sale.store?.name || "Tienda"}
                            </Chip>
                          </td>
                        )}

                        {/* Cliente */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate max-w-[200px]" title={clientName}>
                              {clientName}
                            </span>
                            {sale.phone && (
                              <span className="text-[10px] text-default-400">Tel: {sale.phone}</span>
                            )}
                          </div>
                        </td>

                        {/* Detalle de Productos (Resumen) */}
                        <td className="py-2.5 px-3">
                          {details.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-default-600 font-medium truncate max-w-[220px]">
                                {details[0]?.product?.name || details[0]?.product_name || "Producto"}
                                {details[0]?.quantity > 1 ? ` (${details[0].quantity} u.)` : ""}
                              </span>
                              {details.length > 1 && (
                                <Tooltip
                                  content={
                                    <div className="p-1 flex flex-col gap-1 text-xs">
                                      {details.map((d: any, i: number) => (
                                        <span key={i}>
                                          • {d.product?.name || d.product_name} x {d.quantity}
                                        </span>
                                      ))}
                                    </div>
                                  }
                                >
                                  <Chip size="sm" variant="flat" color="primary" className="h-4 px-1 text-[9px] font-bold">
                                    +{details.length - 1} más
                                  </Chip>
                                </Tooltip>
                              )}
                            </div>
                          ) : (
                            <span className="text-default-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Método de Pago */}
                        <td className="py-2.5 px-3 text-center">
                          <Chip
                            size="sm"
                            variant="flat"
                            color={isQr ? "secondary" : isCash ? "success" : "default"}
                            className="font-bold text-[10px] h-5 px-1.5"
                            startContent={
                              isQr ? (
                                <FaQrcode className="text-[10px] mr-1" />
                              ) : isCash ? (
                                <FaMoneyBillWave className="text-[10px] mr-1" />
                              ) : undefined
                            }
                          >
                            {isQr ? "QR" : isCash ? "Efectivo" : sale.payment_method || "Otro"}
                          </Chip>
                        </td>

                        {/* Importe Total */}
                        <td className="py-2.5 px-3 text-right font-black text-foreground text-sm">
                          <PriceDisplay amount={sale.total} compact />
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip content="Vista previa e impresión de ticket">
                              <Button
                                size="sm"
                                isIconOnly
                                variant="flat"
                                color="primary"
                                className="h-8 w-8 min-w-8"
                                onPress={() => handleOpenSalePreview(sale)}
                              >
                                <FaReceipt className="text-xs" />
                              </Button>
                            </Tooltip>

                            <Tooltip content="Ver página completa">
                              <Button
                                size="sm"
                                isIconOnly
                                variant="light"
                                color="default"
                                className="h-8 w-8 min-w-8 text-default-500"
                                onPress={() => navigate(`/tienda/${storeSlug}/ventas/detalle/${sale.id}`)}
                              >
                                <FaEye className="text-sm" />
                              </Button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PAGINACIÓN */}
        {pages > 1 && (
          <div className="flex justify-center mt-2">
            <Pagination
              isCompact
              showControls
              page={page}
              total={pages}
              onChange={setPage}
              color="primary"
            />
          </div>
        )}
      </div>

      {/* ESTILOS DE IMPRESIÓN PARA TICKET TÉRMICO (80MM) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-sale-ticket, #printable-sale-ticket * {
            visibility: visible !important;
          }
          #printable-sale-ticket {
            position: fixed !important;
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
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* MODAL PREVIO DE DETALLE DE VENTA LISTO PARA IMPRIMIR */}
      <Modal
        isOpen={isSalePreviewOpen}
        onClose={() => {
          setIsSalePreviewOpen(false);
          setSelectedSaleForPreview(null);
        }}
        size="md"
        scrollBehavior="inside"
        classNames={{
          base: "bg-content1 shadow-2xl rounded-2xl max-w-md mx-2",
          header: "border-b border-default-200 py-3 px-4",
          body: "p-3 sm:p-5",
          footer: "border-t border-default-200 py-2.5 px-4",
        }}
      >
        <ModalContent>
          {(onModalClose) => {
            const sale = selectedSaleForPreview;
            if (!sale) return null;

            const clientName = sale.customer_name || sale.customer?.name || sale.name || "Cliente General";
            const items = activePreviewDetails;
            const subtotal = items.reduce(
              (acc: number, item: any) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
              0
            );
            const discount = Number(sale.discount || 0);
            const total = Number(sale.total || subtotal - discount);
            const storeSlug = sale.store?.slug || previewShop?.slug || urlSlug || "alicia";

            let formattedDateStr = "-";
            const rawDate = sale.created_at || sale.order_date;
            if (rawDate) {
              try {
                formattedDateStr = formatTenantDate(rawDate, "dd/MM/yyyy HH:mm", tenantTimezone);
              } catch {
                formattedDateStr = String(rawDate).slice(0, 16);
              }
            } else if (sale.formatted_date) {
              formattedDateStr = sale.formatted_date;
            }

            return (
              <>
                <ModalHeader className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <FaReceipt className="text-sm" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">
                        Comprobante #{String(sale.id).slice(-8)}
                      </span>
                      <span className="text-[10px] text-default-400 font-normal">
                        Vista previa lista para impresión
                      </span>
                    </div>
                  </div>
                </ModalHeader>

                <ModalBody>
                  {/* CONTENEDOR DEL TICKET (ESTRUCTURADO PARA IMPRESIÓN DIRECTA DE 80MM) */}
                  <div
                    id="printable-sale-ticket"
                    className="w-full bg-white dark:bg-default-50 text-neutral-900 border border-default-200 rounded-xl p-4 flex flex-col gap-3 font-sans text-xs shadow-xs"
                  >
                    {/* Encabezado del Ticket */}
                    <div className="flex flex-col items-center text-center gap-1 border-b border-dashed border-default-300 pb-3">
                      {previewShop?.front_image ? (
                        <img
                          src={getImageUrl(previewShop.front_image)}
                          alt="Logo Tienda"
                          className="h-10 w-auto object-contain rounded-md mb-0.5"
                          onError={(e: any) => {
                            e.currentTarget.src = "/favicon.ico";
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base mb-0.5">
                          <FaStore />
                        </div>
                      )}

                      <h2 className="text-sm font-black tracking-tight text-neutral-900">
                        {systemData?.name || previewShop?.name || "INVENTARYA POS"}
                      </h2>
                      <p className="text-[10px] text-neutral-500">
                        NIT: <span className="font-semibold text-neutral-800">{systemData?.nit || "-"}</span>
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        Sucursal: <span className="text-neutral-800 font-semibold">{previewShop?.name || "Tienda"}</span>
                      </p>
                      {previewShop?.address && (
                        <p className="text-[9px] text-neutral-400 max-w-xs">{previewShop.address}</p>
                      )}

                      <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                        <FaCheckCircle size={10} />
                        <span>VENTA #{String(sale.id).slice(-8)}</span>
                      </div>
                    </div>

                    {/* Metadatos de la Venta */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-dashed border-default-300 pb-3">
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Fecha y Hora:</span>
                        <span className="font-semibold text-neutral-800">{formattedDateStr}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Atendido por:</span>
                        <span className="font-semibold text-neutral-800">{sale.user?.username || user?.name || "Cajero"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Cliente:</span>
                        <span className="font-semibold text-neutral-800 truncate block">{clientName}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Método de Pago:</span>
                        <span className="font-bold text-neutral-800 capitalize">{sale.payment_method || "Efectivo"}</span>
                      </div>
                    </div>

                    {/* Tabla de Productos */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        Detalle de Ítems
                      </span>
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-default-200 text-neutral-400 font-bold text-[9px]">
                            <th className="text-left py-1">DESCRIPCIÓN</th>
                            <th className="text-center py-1 w-10">CANT</th>
                            <th className="text-right py-1 w-14">P.U.</th>
                            <th className="text-right py-1 w-16">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                          {items.length > 0 ? (
                            items.map((item: any, idx: number) => {
                              const pName =
                                item.product_name ||
                                (typeof item.product === "object" ? item.product?.name : item.product) ||
                                "Producto";
                              const pQty = Number(item.quantity) || 1;
                              const pPrice = Number(item.price) || 0;
                              return (
                                <tr key={idx} className="border-b border-default-50">
                                  <td className="py-1 text-neutral-800 font-medium break-words pr-1">
                                    {pName}
                                  </td>
                                  <td className="text-center py-1 font-bold text-neutral-700">
                                    {pQty}
                                  </td>
                                  <td className="text-right py-1 text-neutral-600">
                                    <PriceDisplay amount={pPrice} />
                                  </td>
                                  <td className="text-right py-1 font-bold text-neutral-900">
                                    <PriceDisplay amount={pPrice * pQty} />
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-2 text-center text-neutral-400 italic">
                                Sin detalle de ítems disponible
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Totales */}
                    <div className="flex flex-col gap-1 border-t border-dashed border-default-300 pt-2 text-xs">
                      {discount > 0 && (
                        <>
                          <div className="flex justify-between items-center text-neutral-500 text-[11px]">
                            <span>Subtotal:</span>
                            <span className="font-semibold text-neutral-800">
                              <PriceDisplay amount={subtotal} />
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-rose-600 text-[11px]">
                            <span>Descuento:</span>
                            <span className="font-semibold">
                              -<PriceDisplay amount={discount} />
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between items-center pt-1 border-t border-default-200">
                        <span className="font-black text-neutral-900 text-xs">TOTAL PAGADO:</span>
                        <span className="text-lg font-black text-emerald-700">
                          <PriceDisplay amount={total} />
                        </span>
                      </div>
                    </div>

                    {/* Pie del Ticket */}
                    <div className="text-center text-[10px] text-neutral-400 pt-1 border-t border-default-100 flex flex-col gap-0.5">
                      <p className="font-bold text-neutral-600">¡Gracias por su preferencia!</p>
                      <p className="text-[9px]">Garantía con presentación de este comprobante</p>
                    </div>
                  </div>
                </ModalBody>

                <ModalFooter className="flex items-center justify-between gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="light"
                    color="default"
                    onPress={() => {
                      onModalClose();
                      navigate(`/tienda/${storeSlug}/ventas/detalle/${sale.id}`);
                    }}
                    className="text-xs font-semibold"
                  >
                    Ver Completo
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      isLoading={isDownloadingTicketPdf}
                      startContent={!isDownloadingTicketPdf && <FaDownload size={12} />}
                      onPress={handleDownloadPreviewPdf}
                      className="font-bold text-xs h-8"
                    >
                      PDF
                    </Button>

                    <Button
                      size="sm"
                      color="primary"
                      variant="solid"
                      startContent={<FaPrint size={13} />}
                      onPress={handlePrintPreview}
                      className="font-bold text-xs h-8 shadow-sm"
                    >
                      Imprimir Ticket
                    </Button>
                  </div>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default IndexSale;
