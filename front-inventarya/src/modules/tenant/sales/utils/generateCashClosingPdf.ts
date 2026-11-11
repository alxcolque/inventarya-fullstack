import { jsPDF } from "jspdf";
import { formatTenantDate } from "@/utils/tenant-date";

export interface CashClosingData {
  sales: any[];
  date: Date | string;
  storeName: string;
  userName?: string;
  companyName?: string;
  nit?: string;
  currencySymbol?: string | null;
}

export const generateCashClosingPdf = ({
  sales,
  date,
  storeName,
  userName = "Administrador",
  companyName = "SISTEMA DE VENTAS",
  nit = "-",
  currencySymbol = "$",
}: CashClosingData): { doc: jsPDF; filename: string } => {
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
  const closingDate = typeof date === "string" ? new Date(date) : date;
  const formattedDate = formatTenantDate(closingDate, "EEEE, dd 'de' MMMM 'de' yyyy");
  const formattedTime = formatTenantDate(new Date(), "HH:mm:ss");

  // Cálculos de totales y métodos de pago
  let totalCash = 0;
  let totalQr = 0;
  let totalOther = 0;
  let totalGeneral = 0;

  // Agrupador de productos vendidos
  const productsMap = new Map<string, { name: string; sku: string; quantity: number; subtotal: number }>();

  sales.forEach((sale) => {
    const saleTotal = parseFloat(sale.total) || 0;
    totalGeneral += saleTotal;

    const method = (sale.payment_method || "efectivo").toLowerCase();
    if (method.includes("efectivo") || method.includes("cash")) {
      totalCash += saleTotal;
    } else if (method.includes("qr") || method.includes("transferencia")) {
      totalQr += saleTotal;
    } else {
      totalOther += saleTotal;
    }

    // Extraer detalles de productos
    const details = sale.saleDetails || sale.sale_details || [];
    details.forEach((det: any) => {
      const prodName = det.product?.name || det.product_name || det.name || `Producto #${det.product_id || ""}`;
      const prodSku = det.product?.sku || det.sku || "-";
      const key = `${prodName}_${prodSku}`;
      const qty = Number(det.quantity) || 1;
      const sub = parseFloat(det.subtotal) || Number(det.price || 0) * qty;

      if (!productsMap.has(key)) {
        productsMap.set(key, {
          name: prodName,
          sku: prodSku,
          quantity: 0,
          subtotal: 0,
        });
      }
      const existing = productsMap.get(key)!;
      existing.quantity += qty;
      existing.subtotal += sub;
    });
  });

  const productsList = Array.from(productsMap.values()).sort((a, b) => b.quantity - a.quantity);

  // Helper para dibujar recuadros con bordes suaves
  const drawCard = (x: number, y: number, w: number, h: number, fillColor: [number, number, number] = [248, 250, 252]) => {
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
  };

  // Helper para verificar salto de página
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
    doc.text(`${companyName} | Cierre de Caja Diario`, marginX, currentY);
    doc.text(`Sucursal: ${storeName} · Fecha: ${formatTenantDate(closingDate, "dd/MM/yyyy")}`, pageWidth - marginX, currentY, {
      align: "right",
    });
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 6;
  };

  // -------------------------------------------------------------
  // 1. ENCABEZADO PRINCIPAL
  // -------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Slate-900 elegante
  doc.rect(marginX, currentY, contentWidth, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("ACTA DE CIERRE Y ARQUEO DIARIO DE CAJA", marginX + 6, currentY + 9);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`${companyName}  |  NIT: ${nit}  |  Generado por: ${userName}`, marginX + 6, currentY + 16);
  doc.text(`Corte generado el: ${formatTenantDate(new Date(), "dd/MM/yyyy")} a las ${formattedTime}`, marginX + 6, currentY + 20.5);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(56, 189, 248); // Sky blue
  doc.text(`SUCURSAL: ${storeName.toUpperCase()}`, pageWidth - marginX - 6, currentY + 9, { align: "right" });
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`FECHA DE CORTE: ${formatTenantDate(closingDate, "dd/MM/yyyy")}`, pageWidth - marginX - 6, currentY + 16, { align: "right" });

  currentY += 28;

  // -------------------------------------------------------------
  // 2. RESUMEN DE COBROS Y MÉTODOS DE PAGO (BENTO CARDS)
  // -------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("1. RESUMEN DE RECAUDACIÓN Y MÉTODOS DE PAGO", marginX, currentY);
  currentY += 4;

  const cardW = (contentWidth - 6) / 3; // 3 tarjetas en fila
  const cardH = 22;

  // Card 1: Total Efectivo
  drawCard(marginX, currentY, cardW, cardH, [236, 253, 245]); // Emerald-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text("TOTAL EFECTIVO", marginX + 4, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(6, 78, 59);
  doc.text(`${curr}${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + 4, currentY + 14);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const pctCash = totalGeneral > 0 ? ((totalCash / totalGeneral) * 100).toFixed(1) : "0.0";
  doc.text(`${pctCash}% del total recaudado`, marginX + 4, currentY + 19);

  // Card 2: Total QR / Transferencia
  drawCard(marginX + cardW + 3, currentY, cardW, cardH, [238, 242, 255]); // Indigo-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(79, 70, 229);
  doc.text("TOTAL QR / TRANSFERENCIA", marginX + cardW + 7, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`${curr}${totalQr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + cardW + 7, currentY + 14);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const pctQr = totalGeneral > 0 ? ((totalQr / totalGeneral) * 100).toFixed(1) : "0.0";
  doc.text(`${pctQr}% del total recaudado`, marginX + cardW + 7, currentY + 19);

  // Card 3: Total General del Día
  drawCard(marginX + (cardW + 3) * 2, currentY, cardW, cardH, [248, 250, 252]); // Slate-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL RECAUDADO", marginX + (cardW + 3) * 2 + 4, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${curr}${totalGeneral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + (cardW + 3) * 2 + 4, currentY + 14);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${sales.length} comprobante(s) emitido(s)`, marginX + (cardW + 3) * 2 + 4, currentY + 19);

  currentY += cardH + 7;

  // -------------------------------------------------------------
  // 3. PRODUCTOS VENDIDOS EN EL DÍA
  // -------------------------------------------------------------
  checkNewPage(25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("2. DETALLE DE PRODUCTOS VENDIDOS EN EL DÍA", marginX, currentY);
  currentY += 4;

  // Cabecera de la tabla de productos
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("PRODUCTO", marginX + 3, currentY + 4.8);
  doc.text("SKU / CÓDIGO", marginX + 90, currentY + 4.8);
  doc.text("CANTIDAD", marginX + 130, currentY + 4.8, { align: "right" });
  doc.text("TOTAL", pageWidth - marginX - 3, currentY + 4.8, { align: "right" });
  currentY += 8;

  if (productsList.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registraron ventas de productos en la fecha seleccionada.", marginX + 3, currentY + 3);
    currentY += 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    productsList.forEach((prod, index) => {
      checkNewPage(7);
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

    // Subtotal de unidades vendidas
    checkNewPage(8);
    const totalUnits = productsList.reduce((sum, p) => sum + p.quantity, 0);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("TOTAL UNIDADES VENDIDAS:", marginX + 3, currentY);
    doc.text(`${totalUnits} unidades`, marginX + 130, currentY, { align: "right" });
    doc.text(`${curr}${totalGeneral.toFixed(2)}`, pageWidth - marginX - 3, currentY, { align: "right" });
    currentY += 9;
  }

  // -------------------------------------------------------------
  // 4. DETALLE DE VENTAS A CLIENTES
  // -------------------------------------------------------------
  checkNewPage(25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("3. DETALLE DE TRANSACCIONES Y CLIENTES", marginX, currentY);
  currentY += 4;

  // Cabecera de la tabla de ventas
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("N° TICKET", marginX + 3, currentY + 4.8);
  doc.text("HORA", marginX + 26, currentY + 4.8);
  doc.text("CLIENTE / COMPRADOR", marginX + 48, currentY + 4.8);
  doc.text("MÉTODO", marginX + 125, currentY + 4.8);
  doc.text("TOTAL", pageWidth - marginX - 3, currentY + 4.8, { align: "right" });
  currentY += 8;

  if (sales.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registraron comprobantes en esta fecha.", marginX + 3, currentY + 3);
    currentY += 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    sales.forEach((sale, index) => {
      checkNewPage(7);
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginX, currentY - 1.5, contentWidth, 6, "F");
      }

      const clientName = sale.customer_name || sale.customer?.name || sale.name;
      const shortTicket = `#${String(sale.id).slice(-8)}`;
      let timeStr = "--:--";
      if (sale.created_at) {
        try {
          timeStr = formatTenantDate(sale.created_at, "HH:mm");
        } catch {
          timeStr = "--:--";
        }
      }

      doc.setTextColor(71, 85, 105);
      doc.text(shortTicket, marginX + 3, currentY + 2.5);
      doc.text(timeStr, marginX + 26, currentY + 2.5);

      doc.setTextColor(15, 23, 42);
      const truncatedClient = clientName.length > 45 ? clientName.substring(0, 42) + "..." : clientName;
      doc.text(truncatedClient, marginX + 48, currentY + 2.5);

      const payMethod = (sale.payment_method || "Efectivo").toUpperCase();
      if (payMethod.includes("QR")) {
        doc.setTextColor(79, 70, 229);
      } else if (payMethod.includes("EFECTIVO")) {
        doc.setTextColor(5, 150, 105);
      } else {
        doc.setTextColor(100, 116, 139);
      }
      doc.text(payMethod, marginX + 125, currentY + 2.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const totalNum = parseFloat(sale.total) || 0;
      doc.text(`${curr}${totalNum.toFixed(2)}`, pageWidth - marginX - 3, currentY + 2.5, { align: "right" });
      doc.setFont("helvetica", "normal");

      currentY += 6;
    });
  }

  // -------------------------------------------------------------
  // 5. BLOQUE DE FIRMAS Y CONFORMIDAD
  // -------------------------------------------------------------
  checkNewPage(45);
  currentY += 8;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 16;

  const signColWidth = (contentWidth - 20) / 2;

  // Firma 1: Cajero / Operador
  doc.line(marginX + 10, currentY, marginX + 10 + signColWidth - 20, currentY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("FIRMA DE CAJERO / RESPONSABLE", marginX + 10 + (signColWidth - 20) / 2, currentY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Nombre: ${userName}`, marginX + 10 + (signColWidth - 20) / 2, currentY + 8, { align: "center" });

  // Firma 2: Supervisor / Administrador
  const rightSignX = marginX + signColWidth + 20;
  doc.line(rightSignX + 10, currentY, rightSignX + 10 + signColWidth - 20, currentY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("SUPERVISOR / ADMINISTRACIÓN", rightSignX + 10 + (signColWidth - 20) / 2, currentY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Conformidad y Arqueo Verificado", rightSignX + 10 + (signColWidth - 20) / 2, currentY + 8, { align: "center" });

  const filename = `Cierre_Caja_${formatTenantDate(closingDate, "yyyy-MM-dd")}_${storeName.replace(/\s+/g, "_")}.pdf`;

  return { doc, filename };
};
