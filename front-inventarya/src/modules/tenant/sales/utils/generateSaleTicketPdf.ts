import { downloadPdf } from '@/services/pdfService';
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatTenantDate, getTenantTimezone } from "@/utils/tenant-date";

export interface SaleTicketProductItem {
  id?: number | string;
  product_id?: number | string;
  product_name?: string;
  product?: {
    id?: number | string;
    name?: string;
    sku?: string;
    barcode?: string;
  } | string;
  quantity: number;
  price: number;
  subtotal?: number;
}

export interface SaleTicketPdfParams {
  sale: {
    id?: number | string;
    created_at?: string;
    order_date?: string;
    phone?: string;
    payment_method?: string;
    discount?: number | string;
    name?: string;
    payments?: Array<{
      payment_method?: string;
      amount?: number;
      amount_received?: number | null;
      change_amount?: number | null;
      reference?: string | null;
    }>;
    customer?: {
      id?: number | string;
      name?: string;
    };
    user?: {
      id?: number | string;
      name?: string;
      username?: string;
    };
  };
  detailSales: SaleTicketProductItem[];
  shop?: {
    name?: string;
    address?: string;
    phone?: string;
  } | null;
  systemData?: {
    name?: string;
    nit?: string;
    address?: string;
    phone?: string;
    timezone?: string;
  } | null;
  currencySymbol?: string | null;
}

/**
 * Obtiene el nombre del producto de forma robusta
 */
const resolveProductName = (item: SaleTicketProductItem): string => {
  if (item.product_name) return item.product_name;
  if (typeof item.product === "object" && item.product !== null) {
    return item.product.name || "Producto";
  }
  if (typeof item.product === "string") {
    return item.product;
  }
  return "Producto";
};

/**
 * Genera el documento PDF del ticket térmico de 80mm con estética profesional y código QR
 */
export const generateSaleTicketPdf = async ({
  sale,
  detailSales,
  shop,
  systemData,
  currencySymbol = "",
}: SaleTicketPdfParams): Promise<jsPDF> => {
  const saleId = String(sale?.id || "");
  const companyName = shop?.name || systemData?.name || "INVENTARYA";
  const nit = systemData?.nit || "-";
  const storeName = shop?.name || "Tienda Principal";
  const storeAddress = shop?.address || systemData?.address || "";
  const customerName = sale?.customer?.name || sale?.name || "Cliente";
  const cashierName = sale?.user?.username || sale?.user?.name || "Cajero";

  const tz = systemData?.timezone || getTenantTimezone();
  const rawDate = sale?.created_at || sale?.order_date;
  const saleDate = rawDate
    ? formatTenantDate(rawDate, "dd/MM/yyyy HH:mm", tz)
    : formatTenantDate(new Date(), "dd/MM/yyyy HH:mm", tz);

  // 1. Calcular altura dinámica del ticket para que no sobre ni falte espacio
  const baseHeaderHeight = 58;
  const itemsHeight = detailSales.length * 4.8;
  const totalsHeight = (Number(sale?.discount) > 0 ? 24 : 18);
  const qrSectionHeight = 44;
  const calculatedHeight = Math.max(140, Math.ceil(baseHeaderHeight + itemsHeight + totalsHeight + qrSectionHeight + 10));

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, calculatedHeight], // Formato Ticket Térmico 80mm
  });

  const pageWidth = 80;
  const marginX = 5;
  const rightMarginX = 75;
  const centerX = pageWidth / 2;

  let y = 8;

  // ENCABEZADO
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(companyName, centerX, y, { align: "center" });

  y += 4.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`NIT: ${nit}`, centerX, y, { align: "center" });

  y += 3.5;
  pdf.text(`Sucursal: ${storeName}`, centerX, y, { align: "center" });

  if (storeAddress) {
    y += 3.5;
    pdf.setFontSize(6.8);
    pdf.text(storeAddress.substring(0, 48), centerX, y, { align: "center" });
  }

  // LÍNEA SEPARADORA
  y += 4;
  pdf.setFontSize(8);
  pdf.text("--------------------------------------------------", centerX, y, { align: "center" });

  // TÍTULO COMPROBANTE INTERNO COMERCIAL
  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text("COMPROBANTE DE VENTA", centerX, y, { align: "center" });

  y += 3.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.2);
  pdf.text("DOCUMENTO INTERNO - NO VÁLIDO PARA CRÉDITO FISCAL", centerX, y, { align: "center" });

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(`N° ${saleId}`, centerX, y, { align: "center" });

  // METADATOS DE LA VENTA
  y += 4.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`Fecha:   ${saleDate}`, marginX, y);

  y += 3.8;
  pdf.text(`Cajero:  ${cashierName}`, marginX, y);

  y += 3.8;
  pdf.text(`Cliente: ${customerName}`, marginX, y);

  if (sale?.phone) {
    y += 3.8;
    pdf.text(`Teléf.:  ${sale.phone}`, marginX, y);
  }

  // CABECERA DE TABLA
  y += 4;
  pdf.text("--------------------------------------------------", centerX, y, { align: "center" });

  y += 3.8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  // Columnas: CANT (x=5), DESCRIPCIÓN (x=16), P.U. (x=58 derecha), TOTAL (x=75 derecha)
  pdf.text("CANT", marginX, y);
  pdf.text("DESCRIPCIÓN", 15, y);
  pdf.text("P.U.", 58, y, { align: "right" });
  pdf.text("TOTAL", rightMarginX, y, { align: "right" });

  y += 3.2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("--------------------------------------------------", centerX, y, { align: "center" });

  // DETALLE DE PRODUCTOS
  y += 3.8;
  pdf.setFont("courier", "normal"); // Fuente Courier monoespaciada para alineación nítida estilo impresora térmica
  pdf.setFontSize(7.2);

  detailSales.forEach((item) => {
    // 1. Recorte a 15 caracteres y relleno con puntos si mide menos de 15
    const rawName = resolveProductName(item).trim();
    const truncatedName = rawName.substring(0, 15);
    const pName = truncatedName.padEnd(15, ".");

    // 2. Cantidad formateada
    const qtyStr = Number(item.quantity) % 1 === 0
      ? String(item.quantity).padStart(3, " ")
      : Number(item.quantity).toFixed(2).padStart(4, " ");

    // 3. P.U. y TOTAL sin currencySymbol (solo números con 2 decimales)
    const puNum = Number(item.price || 0);
    const totNum = puNum * Number(item.quantity || 0);
    const puStr = puNum.toFixed(2);
    const totStr = totNum.toFixed(2);

    // Renderizar línea alineada
    pdf.text(qtyStr, marginX, y);
    pdf.text(pName, 15, y);
    pdf.text(puStr, 58, y, { align: "right" });
    pdf.text(totStr, rightMarginX, y, { align: "right" });

    y += 4.5;
  });

  // SEPARADOR TOTALES
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("--------------------------------------------------", centerX, y, { align: "center" });

  // CÁLCULO DE TOTALES
  const totalCalc = detailSales.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  const discountCalc = Number(sale?.discount || 0);
  const totalFinal = Math.max(0, totalCalc - discountCalc);

  y += 4;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.8);
  pdf.text("SUBTOTAL:", 48, y, { align: "right" });
  pdf.text(totalCalc.toFixed(2), rightMarginX, y, { align: "right" });

  if (discountCalc > 0) {
    y += 3.8;
    pdf.text("DESCUENTO:", 48, y, { align: "right" });
    pdf.text(`-${discountCalc.toFixed(2)}`, rightMarginX, y, { align: "right" });
  }

  y += 4.5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  const currPrefix = currencySymbol ? `${currencySymbol} ` : "";
  pdf.text("TOTAL A PAGAR:", 48, y, { align: "right" });
  pdf.text(`${currPrefix}${totalFinal.toFixed(2)}`, rightMarginX, y, { align: "right" });

  // FORMA(S) DE PAGO
  const payments = sale?.payments || [];
  if (payments.length > 0) {
    y += 4.5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text("Forma(s) de Pago:", marginX, y);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.2);
    payments.forEach((p) => {
      y += 3.6;
      const pMethod = (p.payment_method || "Efectivo").toUpperCase();
      const pAmount = Number(p.amount || 0).toFixed(2);
      pdf.text(`• ${pMethod}:`, marginX + 2, y);
      pdf.text(`${currPrefix}${pAmount}`, rightMarginX, y, { align: "right" });

      if (p.amount_received && Number(p.amount_received) > 0) {
        y += 3.2;
        pdf.setFontSize(6.5);
        pdf.text(`   Recibido: ${currPrefix}${Number(p.amount_received).toFixed(2)}`, marginX + 2, y);
        if (p.change_amount && Number(p.change_amount) > 0) {
          pdf.text(`Cambio: ${currPrefix}${Number(p.change_amount).toFixed(2)}`, rightMarginX, y, { align: "right" });
        }
        pdf.setFontSize(7.2);
      }
    });
  } else {
    y += 4.5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(`Forma de Pago: ${(sale?.payment_method || "Efectivo").toUpperCase()}`, marginX, y);
  }

  // CÓDIGO QR GENERADO AL FINAL
  y += 4;
  pdf.text("--------------------------------------------------", centerX, y, { align: "center" });

  y += 2.5;
  try {
    // Generar código QR que almacena el id de venta
    const qrDataUrl = await QRCode.toDataURL(saleId, {
      margin: 1,
      width: 140,
      errorCorrectionLevel: "M",
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    });

    const qrSize = 22; // 22mm x 22mm
    const qrX = (pageWidth - qrSize) / 2;
    pdf.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize);
    y += qrSize + 3;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.text(`ID DE VENTA: ${saleId}`, centerX, y, { align: "center" });
    y += 3.5;
  } catch (err) {
    console.error("Error generando código QR en ticket:", err);
    y += 4;
  }

  // MENSAJE FINAL DE AGRADECIMIENTO
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("¡Gracias por su preferencia!", centerX, y, { align: "center" });

  y += 3.2;
  pdf.setFontSize(6.2);
  pdf.text("Conserve este comprobante para cualquier reclamo o garantía.", centerX, y, { align: "center" });

  return pdf;
};

/**
 * Descarga directamente el archivo PDF del ticket de venta
 */
export const downloadSaleTicketPdf = async (params: SaleTicketPdfParams): Promise<void> => {
  const pdf = await generateSaleTicketPdf(params);
  const saleId = params.sale?.id || "ticket";
  await downloadPdf(pdf, `ticket-venta-${saleId}.pdf`);
};

