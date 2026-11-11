import { jsPDF } from "jspdf";

export interface RemisionMovementItem {
  id?: number | string;
  product_id?: number | string;
  quantity: number;
  cost_price?: number;
  sale_price?: number;
  unit?: string;
  product?: {
    id?: number | string;
    name?: string;
    sku?: string;
    barcode?: string;
    category?: string;
  };
}

export interface RemisionMovement {
  id: number | string;
  document_number: string;
  document_type?: string;
  status: string;
  notes?: string;
  shipped_at?: string;
  received_at?: string;
  created_at?: string;
  destination_store?: {
    id?: number | string;
    name?: string;
    address?: string;
    phone?: string;
  };
  destinationStore?: {
    id?: number | string;
    name?: string;
    address?: string;
    phone?: string;
  };
  user?: {
    id?: number | string;
    name?: string;
    email?: string;
  };
  items: RemisionMovementItem[];
}

export const generateRemisionPdf = (
  movement: RemisionMovement,
  currencySymbol: string = "$"
): { doc: jsPDF; filename: string } => {
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

  const store = movement.destinationStore || movement.destination_store;
  const user = movement.user;
  const items = movement.items || [];

  // Helper formatting
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  };

  // 1. ENCABEZADO
  // Caja de título y datos principales
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(marginX, currentY, contentWidth, 18, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text((movement.document_type || "GUÍA DE REMISIÓN").toUpperCase(), marginX + 6, currentY + 8);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(226, 232, 240);
  doc.text("DOCUMENTO INTERNO DE TRASLADO Y CONTROL DE STOCK", marginX + 6, currentY + 14);

  // Número de guía a la derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(movement.document_number, pageWidth - marginX - 6, currentY + 8, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  const statusLabel =
    movement.status === "completed"
      ? "ESTADO: RECIBIDO / COMPLETADO"
      : movement.status === "returned"
        ? "ESTADO: DEVUELTO A ALMACÉN"
        : movement.status === "cancelled"
          ? "ESTADO: CANCELADO"
          : "ESTADO: EN TRÁNSITO";
  doc.text(statusLabel, pageWidth - marginX - 6, currentY + 14, { align: "right" });

  currentY += 23;

  // 2. DATOS DE TRASLADO (ORIGEN Y DESTINO)
  const boxWidth = (contentWidth - 4) / 2;
  const boxHeight = 28;

  // Caja Origen (Almacén)
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("PUNTO DE PARTIDA (ORIGEN):", marginX + 4, currentY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Almacén Central / Inventario General", marginX + 4, currentY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Despachado por: " + (user?.name || "Administrador de Almacén"), marginX + 4, currentY + 18);
  doc.text("Fecha/Hora salida: " + formatDate(movement.shipped_at || movement.created_at), marginX + 4, currentY + 23);

  // Caja Destino (Tienda)
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX + boxWidth + 4, currentY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("PUNTO DE LLEGADA (DESTINO):", marginX + boxWidth + 8, currentY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(store?.name || "Tienda de Destino", marginX + boxWidth + 8, currentY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const storeAddr = store?.address ? store.address : "Dirección registrada de sucursal";
  doc.text("Dirección: " + storeAddr, marginX + boxWidth + 8, currentY + 18, { maxWidth: boxWidth - 10 });
  if (store?.phone) {
    doc.text("Teléfono: " + store.phone, marginX + boxWidth + 8, currentY + 23);
  }

  currentY += boxHeight + 4;

  // Observaciones si existen
  if (movement.notes) {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(254, 252, 232); // Light yellow
    doc.roundedRect(marginX, currentY, contentWidth, 9, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(133, 77, 14);
    doc.text("NOTAS / MOTIVO: ", marginX + 3, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.text(movement.notes, marginX + 28, currentY + 6, { maxWidth: contentWidth - 32 });

    currentY += 12;
  }

  // 3. TABLA DE PRODUCTOS
  // Cabecera de la tabla
  const colX = {
    num: marginX,
    sku: marginX + 9,
    name: marginX + 42,
    unit: marginX + 112,
    qty: marginX + 132,
    cost: marginX + 152,
    sale: marginX + 171,
  };

  doc.setFillColor(51, 65, 85); // Slate-700
  doc.rect(marginX, currentY, contentWidth, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("N°", colX.num + 3, currentY + 5);
  doc.text("SKU / CÓDIGO", colX.sku, currentY + 5);
  doc.text("DESCRIPCIÓN DEL PRODUCTO", colX.name, currentY + 5);
  doc.text("UNIDAD", colX.unit, currentY + 5);
  doc.text("CANT.", colX.qty + 7, currentY + 5, { align: "right" });
  doc.text("COSTO", colX.cost + 8, currentY + 5, { align: "right" });
  doc.text("P. VENTA", colX.sale + 8, currentY + 5, { align: "right" });

  currentY += 7;

  let totalQty = 0;
  let totalCostVal = 0;
  let totalSaleVal = 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    const rowHeight = 7;

    // Salto de página si se acerca al final
    if (currentY + rowHeight > pageHeight - 45) {
      doc.addPage("letter", "portrait");
      currentY = 14;

      // Re-dibujar cabecera de tabla en nueva página
      doc.setFillColor(51, 65, 85);
      doc.rect(marginX, currentY, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("N°", colX.num + 3, currentY + 5);
      doc.text("SKU / CÓDIGO", colX.sku, currentY + 5);
      doc.text("DESCRIPCIÓN DEL PRODUCTO", colX.name, currentY + 5);
      doc.text("UNIDAD", colX.unit, currentY + 5);
      doc.text("CANT.", colX.qty + 7, currentY + 5, { align: "right" });
      doc.text("COSTO", colX.cost + 8, currentY + 5, { align: "right" });
      doc.text("P. VENTA", colX.sale + 8, currentY + 5, { align: "right" });
      currentY += 7;
      doc.setFont("helvetica", "normal");
    }

    // Fondo alternado de fila
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
    }

    // Línea inferior de fila
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    const qty = Number(item.quantity) || 0;
    const cost = Number(item.cost_price) || 0;
    const sale = Number(item.sale_price) || 0;

    totalQty += qty;
    totalCostVal += qty * cost;
    totalSaleVal += qty * sale;

    const prodName = item.product?.name || "Producto #" + (item.product_id || index + 1);
    const prodSku = item.product?.sku || item.product?.barcode || "-";
    const prodUnit = item.unit || "Unidad";

    doc.setTextColor(30, 41, 59);
    doc.text(String(index + 1), colX.num + 3, currentY + 4.8);
    doc.text(prodSku, colX.sku, currentY + 4.8, { maxWidth: 30 });
    doc.text(prodName, colX.name, currentY + 4.8, { maxWidth: 67 });
    doc.text(prodUnit, colX.unit, currentY + 4.8, { maxWidth: 18 });

    doc.setFont("helvetica", "bold");
    doc.text(String(qty), colX.qty + 7, currentY + 4.8, { align: "right" });
    doc.setFont("helvetica", "normal");

    doc.text(`${currencySymbol}${cost.toFixed(2)}`, colX.cost + 8, currentY + 4.8, { align: "right" });
    doc.text(`${currencySymbol}${sale.toFixed(2)}`, colX.sale + 8, currentY + 4.8, { align: "right" });

    currentY += rowHeight;
  });

  // 4. TOTALES
  currentY += 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  currentY += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL ÍTEMS: ${items.length}`, marginX + 4, currentY);
  doc.text(`TOTAL UNIDADES FÍSICAS: ${totalQty}`, colX.unit, currentY);
  doc.text(`COSTO: ${currencySymbol}${totalCostVal.toFixed(2)}`, pageWidth - marginX - 4, currentY, { align: "right" });

  currentY += 16;

  // 5. SECCIÓN DE FIRMAS Y CONFORMIDAD
  if (currentY + 30 > pageHeight) {
    doc.addPage("letter", "portrait");
    currentY = 25;
  }

  const signBoxWidth = (contentWidth - 8) / 3;
  const signY = currentY + 12;

  // Firma 1: Despachado por
  doc.setDrawColor(148, 163, 184);
  doc.line(marginX, signY, marginX + signBoxWidth, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text("DESPACHADO POR", marginX + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma - Almacén Central", marginX + signBoxWidth / 2, signY + 7.5, { align: "center" });

  // Firma 2: Transportista
  const sign2X = marginX + signBoxWidth + 4;
  doc.line(sign2X, signY, sign2X + signBoxWidth, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text("TRANSPORTISTA / CHOFER", sign2X + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma y Placa Vehicular", sign2X + signBoxWidth / 2, signY + 7.5, { align: "center" });

  // Firma 3: Recibido por
  const sign3X = marginX + (signBoxWidth + 4) * 2;
  doc.line(sign3X, signY, sign3X + signBoxWidth, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text("RECIBIDO CONFORME", sign3X + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma y Sello - Tienda Destino", sign3X + signBoxWidth / 2, signY + 7.5, { align: "center" });

  const filename = `guia_remision_${movement.document_number.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.pdf`;

  return { doc, filename };
};
