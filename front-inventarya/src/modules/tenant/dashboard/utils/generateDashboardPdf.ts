import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DashboardSummary } from "../store/home/home.store";

interface GeneratePdfOptions {
  summary: DashboardSummary;
  periodLabel: string;
  storeName: string;
  currencySymbol?: string | null;
  companyName?: string;
  nit?: string;
}

export const generateDashboardPdf = ({
  summary,
  periodLabel,
  storeName,
  currencySymbol,
  companyName = "INVENTARYA",
  nit = "-",
}: GeneratePdfOptions): { doc: jsPDF; filename: string; blobUrl: string } => {
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

  const kpis = summary.kpis;
  const meta = summary.meta;

  const curr = currencySymbol ? `${currencySymbol} ` : "";

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
    doc.text(`${companyName} | Reporte Ejecutivo de Panel de Control`, marginX, currentY);
    doc.text(`Alcance: ${storeName} · Periodo: ${periodLabel}`, pageWidth - marginX, currentY, { align: "right" });
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 6;
  };

  // -------------------------------------------------------------
  // 1. ENCABEZADO PRINCIPAL
  // -------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Slate-900 elegante
  doc.rect(marginX, currentY, contentWidth, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("INFORME EJECUTIVO DE RENDIMIENTO E INVENTARIO", marginX + 6, currentY + 8.5);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`${companyName}  |  NIT: ${nit}  |  Emisión: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, marginX + 6, currentY + 15);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(56, 189, 248); // Sky blue
  doc.text(`FILTRO: ${periodLabel.toUpperCase()}`, pageWidth - marginX - 6, currentY + 9, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`SUCURSAL: ${storeName}`, pageWidth - marginX - 6, currentY + 15, { align: "right" });

  currentY += 27;

  // -------------------------------------------------------------
  // 2. RESUMEN EJECUTIVO (4 TARJETAS BENTO DE KPIs)
  // -------------------------------------------------------------
  const cardWidth = (contentWidth - 6) / 2; // ~90.9 mm cada una (2x2 grid)
  const cardHeight = 22;

  // Card 1: Ventas Netas
  drawCard(marginX, currentY, cardWidth, cardHeight, [240, 249, 255]); // Sky-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(3, 105, 161);
  doc.text("VENTAS NETAS DEL PERIODO", marginX + 4, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${curr}${kpis.net_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + 4, currentY + 13.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const growthSign = kpis.sales_growth >= 0 ? "+" : "";
  doc.text(`Bruto: ${curr}${kpis.total_sales.toFixed(2)} | Crecimiento: ${growthSign}${kpis.sales_growth}%`, marginX + 4, currentY + 19);

  // Card 2: Transacciones y Ticket Promedio
  drawCard(marginX + cardWidth + 6, currentY, cardWidth, cardHeight, [245, 243, 255]); // Violet-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(109, 40, 217);
  doc.text("TRANSACCIONES Y TICKET PROMEDIO", marginX + cardWidth + 10, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${kpis.orders_count} Pedidos Registrados`, marginX + cardWidth + 10, currentY + 13.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Ticket Promedio: ${curr}${kpis.avg_ticket.toFixed(2)} por venta`, marginX + cardWidth + 10, currentY + 19);

  currentY += cardHeight + 4;

  // Card 3: Valor Patrimonial de Inventario
  drawCard(marginX, currentY, cardWidth, cardHeight, [240, 253, 244]); // Green-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text("VALOR PATRIMONIAL DE INVENTARIO (COSTO)", marginX + 4, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${curr}${kpis.inventory_cost_valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + 4, currentY + 13.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Almacén: ${curr}${kpis.warehouse_cost.toFixed(2)} | Tiendas: ${curr}${kpis.stores_cost.toFixed(2)}`, marginX + 4, currentY + 19);

  // Card 4: Salud de Stock y Catálogo
  drawCard(marginX + cardWidth + 6, currentY, cardWidth, cardHeight, [254, 242, 242]); // Red-50
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text("ALERTAS DE STOCK Y REPOSICIÓN", marginX + cardWidth + 10, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28);
  doc.text(`${kpis.critical_stock_count} Ítems en Riesgo Crítico`, marginX + cardWidth + 10, currentY + 13.5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${kpis.out_of_stock_count} Agotados | ${kpis.total_products} productos registrados en catálogo`, marginX + cardWidth + 10, currentY + 19);

  currentY += cardHeight + 8;

  // -------------------------------------------------------------
  // 3. MÉTODOS DE PAGO Y RENDIMIENTO POR SUCURSAL (2 Columnas)
  // -------------------------------------------------------------
  checkNewPage(45);

  const colWidth = (contentWidth - 6) / 2;

  // Subtítulo Col 1: Métodos de Pago
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("DISTRIBUCIÓN POR MÉTODO DE PAGO", marginX, currentY);

  // Subtítulo Col 2: Rendimiento por Sucursal
  doc.text("RENDIMIENTO POR SUCURSAL", marginX + colWidth + 6, currentY);
  currentY += 4;

  // Cabecera Tabla Métodos
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, colWidth, 6, "F");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("MÉTODO", marginX + 3, currentY + 4.2);
  doc.text("PAGOS", marginX + 38, currentY + 4.2, { align: "center" });
  doc.text("TOTAL", marginX + 62, currentY + 4.2, { align: "right" });
  doc.text("CUOTA", marginX + colWidth - 3, currentY + 4.2, { align: "right" });

  // Cabecera Tabla Sucursales
  doc.rect(marginX + colWidth + 6, currentY, colWidth, 6, "F");
  doc.text("SUCURSAL", marginX + colWidth + 9, currentY + 4.2);
  doc.text("VTS", marginX + colWidth + 46, currentY + 4.2, { align: "center" });
  doc.text("TOTAL", marginX + colWidth + 68, currentY + 4.2, { align: "right" });
  doc.text("CUOTA", marginX + contentWidth - 3, currentY + 4.2, { align: "right" });

  currentY += 6;

  const maxRows = Math.max(summary.payment_methods.length, summary.stores_performance.length, 1);
  for (let i = 0; i < Math.min(maxRows, 5); i++) {
    const pm = summary.payment_methods[i];
    const st = summary.stores_performance[i];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    const rowY = currentY + i * 5.5;

    // Fila Métodos de pago
    if (pm) {
      doc.text(pm.label, marginX + 3, rowY + 3.8);
      doc.text(String(pm.count), marginX + 38, rowY + 3.8, { align: "center" });
      doc.text(`${curr}${pm.total.toFixed(2)}`, marginX + 62, rowY + 3.8, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(`${pm.percentage}%`, marginX + colWidth - 3, rowY + 3.8, { align: "right" });
      doc.setFont("helvetica", "normal");
    }

    // Fila Sucursal
    if (st) {
      const sName = st.name.length > 15 ? st.name.substring(0, 15) + "..." : st.name;
      doc.text(sName, marginX + colWidth + 9, rowY + 3.8);
      doc.text(String(st.count), marginX + colWidth + 46, rowY + 3.8, { align: "center" });
      doc.text(`${curr}${st.total.toFixed(2)}`, marginX + colWidth + 68, rowY + 3.8, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(`${st.percentage}%`, marginX + contentWidth - 3, rowY + 3.8, { align: "right" });
      doc.setFont("helvetica", "normal");
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, rowY + 5.2, marginX + colWidth, rowY + 5.2);
    doc.line(marginX + colWidth + 6, rowY + 5.2, marginX + contentWidth, rowY + 5.2);
  }

  currentY += Math.min(maxRows, 5) * 5.5 + 8;

  // -------------------------------------------------------------
  // 4. TABLA: PRODUCTOS MÁS VENDIDOS
  // -------------------------------------------------------------
  checkNewPage(45);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("PRODUCTOS MÁS VENDIDOS (TOP LÍDERES)", marginX, currentY);
  currentY += 4;

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 6, "F");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("#", marginX + 3, currentY + 4.2);
  doc.text("PRODUCTO", marginX + 12, currentY + 4.2);
  doc.text("SKU", marginX + 85, currentY + 4.2);
  doc.text("CATEGORÍA", marginX + 120, currentY + 4.2);
  doc.text("CANT. VENDIDA", marginX + 158, currentY + 4.2, { align: "center" });
  doc.text("TOTAL RECAUDADO", marginX + contentWidth - 3, currentY + 4.2, { align: "right" });
  currentY += 6;

  if (summary.top_products.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No se registraron ventas de productos en este periodo.", marginX + 3, currentY + 4.5);
    currentY += 8;
  } else {
    summary.top_products.slice(0, 6).forEach((prod, idx) => {
      checkNewPage(6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(idx + 1), marginX + 3, currentY + 4);

      doc.setFont("helvetica", "normal");
      const pName = prod.name.length > 38 ? prod.name.substring(0, 38) + "..." : prod.name;
      doc.text(pName, marginX + 12, currentY + 4);
      doc.text(prod.sku || "-", marginX + 85, currentY + 4);
      doc.text(prod.category, marginX + 120, currentY + 4);

      doc.setFont("helvetica", "bold");
      doc.text(`${prod.quantity_sold} unid.`, marginX + 158, currentY + 4, { align: "center" });
      doc.text(`${curr}${prod.revenue.toFixed(2)}`, marginX + contentWidth - 3, currentY + 4, { align: "right" });

      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, currentY + 5.5, marginX + contentWidth, currentY + 5.5);
      currentY += 6;
    });
    currentY += 3;
  }

  // -------------------------------------------------------------
  // 5. ALERTAS DE STOCK CRÍTICO (SI EXISTEN)
  // -------------------------------------------------------------
  if (summary.critical_alerts.length > 0) {
    checkNewPage(35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(185, 28, 28);
    doc.text(`ALERTAS DE REPOSICIÓN URGENTE (${summary.critical_alerts.length} ÍTEMS)`, marginX, currentY);
    currentY += 4;

    doc.setFillColor(254, 242, 242);
    doc.rect(marginX, currentY, contentWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(153, 27, 27);
    doc.text("PRODUCTO", marginX + 3, currentY + 4.2);
    doc.text("UBICACIÓN", marginX + 85, currentY + 4.2);
    doc.text("STOCK ACTUAL", marginX + 130, currentY + 4.2, { align: "center" });
    doc.text("STOCK MÍNIMO", marginX + 155, currentY + 4.2, { align: "center" });
    doc.text("ESTADO", marginX + contentWidth - 3, currentY + 4.2, { align: "right" });
    currentY += 6;

    summary.critical_alerts.slice(0, 5).forEach((item) => {
      checkNewPage(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const pName = item.product_name.length > 38 ? item.product_name.substring(0, 38) + "..." : item.product_name;
      doc.text(pName, marginX + 3, currentY + 4);
      doc.text(item.location_name, marginX + 85, currentY + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(item.stock_quantity <= 0 ? 220 : 180, 20, 20);
      doc.text(String(item.stock_quantity), marginX + 130, currentY + 4, { align: "center" });

      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
      doc.text(String(item.min_stock), marginX + 155, currentY + 4, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(item.status === "out_of_stock" ? 220 : 202, item.status === "out_of_stock" ? 38 : 138, 38);
      doc.text(item.status === "out_of_stock" ? "AGOTADO" : "BAJO MÍNIMO", marginX + contentWidth - 3, currentY + 4, { align: "right" });

      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, currentY + 5.5, marginX + contentWidth, currentY + 5.5);
      currentY += 6;
    });
    currentY += 3;
  }

  // -------------------------------------------------------------
  // 6. PIE DE PÁGINA
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
    doc.text(
      `Documento generado automáticamente por ${companyName} · Sistema de Gestión de Inventarios y POS`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
  }

  const cleanPeriod = periodLabel.replace(/\s+/g, "_").toLowerCase();
  const filename = `reporte_dashboard_${cleanPeriod}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  return { doc, filename, blobUrl };
};
