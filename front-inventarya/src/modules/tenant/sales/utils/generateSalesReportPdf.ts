import { jsPDF } from "jspdf";
import { formatTenantDate } from "@/utils/tenant-date";

export interface SalesReportPdfData {
  sales: any[];
  periodLabel: string;
  storeName: string;
  userName?: string;
  companyName?: string;
  nit?: string;
  currencySymbol?: string | null;
}

export const generateSalesReportPdf = ({
  sales,
  periodLabel,
  storeName,
  userName = "Administrador",
  companyName = "SISTEMA DE VENTAS",
  nit = "-",
  currencySymbol = "$",
}: SalesReportPdfData): { doc: jsPDF; filename: string } => {
  const doc = new jsPDF({
    format: "letter",
    unit: "mm",
    orientation: "portrait",
  });

  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // ~187.9 mm
  let currentY = 14;

  const curr = currencySymbol ? `${currencySymbol} ` : "";

  // Cálculos estadísticos
  let totalRevenue = 0;
  let totalCash = 0;
  let totalQr = 0;
  let totalOther = 0;

  const productsMap = new Map<string, { name: string; sku: string; quantity: number; subtotal: number }>();

  sales.forEach((sale) => {
    const totalNum = parseFloat(sale.total) || 0;
    totalRevenue += totalNum;

    const method = (sale.payment_method || "efectivo").toLowerCase();
    if (method.includes("efectivo") || method.includes("cash")) {
      totalCash += totalNum;
    } else if (method.includes("qr") || method.includes("transferencia")) {
      totalQr += totalNum;
    } else {
      totalOther += totalNum;
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

  const topProducts = Array.from(productsMap.values())
    .sort((a, b) => b.subtotal - a.subtotal)
    .slice(0, 10);

  const averageTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  const drawCard = (x: number, y: number, w: number, h: number, fillColor: [number, number, number] = [248, 250, 252]) => {
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
  };

  const checkNewPage = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = 14;
      drawHeaderSmall();
    }
  };

  const drawHeaderSmall = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${companyName} | Reporte de Ventas`, marginX, currentY);
    doc.text(`Período: ${periodLabel} · Alcance: ${storeName}`, pageWidth - marginX, currentY, { align: "right" });
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 6;
  };

  // -------------------------------------------------------------
  // 1. HEADER PRINCIPAL
  // -------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(marginX, currentY, contentWidth, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("INFORME FINANCIERO Y CONTROL DE VENTAS", marginX + 6, currentY + 9);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`${companyName}  |  NIT: ${nit}  |  Emitido por: ${userName}`, marginX + 6, currentY + 16);
  doc.text(`Fecha de emisión: ${formatTenantDate(new Date(), "dd/MM/yyyy HH:mm")}`, marginX + 6, currentY + 20.5);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(56, 189, 248);
  doc.text(`PERÍODO: ${periodLabel.toUpperCase()}`, pageWidth - marginX - 6, currentY + 9, { align: "right" });
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`ALCANCE: ${storeName.toUpperCase()}`, pageWidth - marginX - 6, currentY + 16, { align: "right" });

  currentY += 28;

  // -------------------------------------------------------------
  // 2. RESUMEN EJECUTIVO (KPIs)
  // -------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("1. INDICADORES CLAVE DEL PERÍODO", marginX, currentY);
  currentY += 4;

  const cardW = (contentWidth - 9) / 4; // 4 tarjetas
  const cardH = 22;

  // Total Facturado
  drawCard(marginX, currentY, cardW, cardH, [240, 249, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(3, 105, 161);
  doc.text("VENTAS TOTALES", marginX + 3, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${curr}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + 3, currentY + 13.5);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${sales.length} comprobantes`, marginX + 3, currentY + 18.5);

  // Total Efectivo
  drawCard(marginX + cardW + 3, currentY, cardW, cardH, [236, 253, 245]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text("RECAUDO EN EFECTIVO", marginX + cardW + 6, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.text(`${curr}${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + cardW + 6, currentY + 13.5);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const pctCash = totalRevenue > 0 ? ((totalCash / totalRevenue) * 100).toFixed(1) : "0.0";
  doc.text(`${pctCash}% del total`, marginX + cardW + 6, currentY + 18.5);

  // Total QR
  drawCard(marginX + (cardW + 3) * 2, currentY, cardW, cardH, [238, 242, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229);
  doc.text("RECAUDO POR QR", marginX + (cardW + 3) * 2 + 3, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(49, 46, 129);
  doc.text(`${curr}${totalQr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + (cardW + 3) * 2 + 3, currentY + 13.5);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const pctQr = totalRevenue > 0 ? ((totalQr / totalRevenue) * 100).toFixed(1) : "0.0";
  doc.text(`${pctQr}% del total`, marginX + (cardW + 3) * 2 + 3, currentY + 18.5);

  // Ticket Promedio
  drawCard(marginX + (cardW + 3) * 3, currentY, cardW, cardH, [248, 250, 252]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("TICKET PROMEDIO", marginX + (cardW + 3) * 3 + 3, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${curr}${averageTicket.toFixed(2)}`, marginX + (cardW + 3) * 3 + 3, currentY + 13.5);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Promedio / comprobante", marginX + (cardW + 3) * 3 + 3, currentY + 18.5);

  currentY += cardH + 7;

  // -------------------------------------------------------------
  // 3. TOP PRODUCTOS MÁS VENDIDOS
  // -------------------------------------------------------------
  if (topProducts.length > 0) {
    checkNewPage(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("2. PRODUCTOS CON MAYOR FACTURACIÓN EN EL PERÍODO", marginX, currentY);
    currentY += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, currentY, contentWidth, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("PRODUCTO", marginX + 3, currentY + 4.5);
    doc.text("CÓDIGO / SKU", marginX + 90, currentY + 4.5);
    doc.text("UNIDADES VENDIDAS", marginX + 130, currentY + 4.5, { align: "right" });
    doc.text("TOTAL FACTURADO", pageWidth - marginX - 3, currentY + 4.5, { align: "right" });
    currentY += 7.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    topProducts.forEach((prod, index) => {
      checkNewPage(6.5);
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginX, currentY - 1.5, contentWidth, 6, "F");
      }
      doc.setTextColor(15, 23, 42);
      const truncatedName = prod.name.length > 55 ? prod.name.substring(0, 52) + "..." : prod.name;
      doc.text(truncatedName, marginX + 3, currentY + 2.5);
      doc.setTextColor(100, 116, 139);
      doc.text(prod.sku || "-", marginX + 90, currentY + 2.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${prod.quantity} u.`, marginX + 130, currentY + 2.5, { align: "right" });
      doc.setTextColor(5, 150, 105);
      doc.text(`${curr}${prod.subtotal.toFixed(2)}`, pageWidth - marginX - 3, currentY + 2.5, { align: "right" });
      doc.setFont("helvetica", "normal");
      currentY += 6;
    });

    currentY += 4;
  }

  // -------------------------------------------------------------
  // 4. LISTADO COMPLETO DE VENTAS
  // -------------------------------------------------------------
  checkNewPage(25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("3. RELACIÓN DETALLADA DE COMPROBANTES", marginX, currentY);
  currentY += 4;

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("N° COMPROBANTE", marginX + 3, currentY + 4.5);
  doc.text("FECHA / HORA", marginX + 35, currentY + 4.5);
  doc.text("CLIENTE", marginX + 68, currentY + 4.5);
  doc.text("SUCURSAL", marginX + 115, currentY + 4.5);
  doc.text("MÉTODO", marginX + 148, currentY + 4.5);
  doc.text("TOTAL", pageWidth - marginX - 3, currentY + 4.5, { align: "right" });
  currentY += 7.5;

  if (sales.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registraron ventas en el período especificado.", marginX + 3, currentY + 3);
    currentY += 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    sales.forEach((sale, index) => {
      checkNewPage(6.5);
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginX, currentY - 1.5, contentWidth, 6, "F");
      }

      const clientName = sale.customer_name || sale.customer?.name || sale.name;
      const shortTicket = `#${String(sale.id).slice(-8)}`;
      let dateStr = "-";
      if (sale.created_at) {
        try {
          dateStr = formatTenantDate(sale.created_at, "dd/MM/yy HH:mm");
        } catch {
          dateStr = String(sale.created_at).slice(0, 16);
        }
      }

      const storeShort = sale.store?.name || storeName || "-";

      doc.setTextColor(71, 85, 105);
      doc.text(shortTicket, marginX + 3, currentY + 2.5);
      doc.text(dateStr, marginX + 35, currentY + 2.5);

      doc.setTextColor(15, 23, 42);
      const truncatedClient = clientName.length > 28 ? clientName.substring(0, 26) + "..." : clientName;
      doc.text(truncatedClient, marginX + 68, currentY + 2.5);

      const truncatedStore = storeShort.length > 18 ? storeShort.substring(0, 16) + "..." : storeShort;
      doc.setTextColor(100, 116, 139);
      doc.text(truncatedStore, marginX + 115, currentY + 2.5);

      const payMethod = (sale.payment_method || "Efectivo").toUpperCase();
      if (payMethod.includes("QR")) {
        doc.setTextColor(79, 70, 229);
      } else if (payMethod.includes("EFECTIVO")) {
        doc.setTextColor(5, 150, 105);
      } else {
        doc.setTextColor(100, 116, 139);
      }
      doc.text(payMethod, marginX + 148, currentY + 2.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const totalNum = parseFloat(sale.total) || 0;
      doc.text(`${curr}${totalNum.toFixed(2)}`, pageWidth - marginX - 3, currentY + 2.5, { align: "right" });
      doc.setFont("helvetica", "normal");

      currentY += 6;
    });

    // Total final
    checkNewPage(10);
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL FACTURADO (${sales.length} comprobantes):`, marginX + 3, currentY);
    doc.text(`${curr}${totalRevenue.toFixed(2)}`, pageWidth - marginX - 3, currentY, { align: "right" });
    currentY += 8;
  }

  const filename = `Reporte_Ventas_${periodLabel.replace(/\s+/g, "_")}_${storeName.replace(/\s+/g, "_")}.pdf`;

  return { doc, filename };
};
