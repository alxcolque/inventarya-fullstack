import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
  Checkbox,
  Progress,
  Card,
  CardBody,
  Tooltip,
  Spinner,
} from "@nextui-org/react";
import {
  FaQrcode,
  FaFilePdf,
  FaDownload,
  FaCheck,
  FaArrowsRotate,
  FaMagnifyingGlass,
  FaArrowUpRightFromSquare,
  FaScissors,
} from "react-icons/fa6";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/image";
import { useMobileKeyboardViewport } from "@/hooks";
import { tenantApi } from "@/api";

interface ModalQrPdfProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
}

type QrSizeKey = "2x2" | "3x3" | "4x4" | "5x5";

interface SizeConfig {
  key: QrSizeKey;
  label: string;
  dimCm: string;
  description: string;
  qrSize: number; // mm
  cellW: number; // mm
  cellH: number; // mm
  cols: number;
  rows: number;
  marginX: number;
  marginY: number;
  qrYOffset: number;
  textYOffset: number;
  nameFontSize: number;
  perPage: number;
}

const SIZE_CONFIGS: Record<QrSizeKey, SizeConfig> = {
  "2x2": {
    key: "2x2",
    label: "2x2 cm",
    dimCm: "2.0 x 2.0 cm",
    description: "Compactas (72 por página)",
    qrSize: 20,
    cellW: 23,
    cellH: 29,
    cols: 8,
    rows: 9,
    marginX: 16.0,
    marginY: 9.2,
    qrYOffset: 1.5,
    textYOffset: 23.5,
    nameFontSize: 5.5,
    perPage: 72,
  },
  "3x3": {
    key: "3x3",
    label: "3x3 cm",
    dimCm: "3.0 x 3.0 cm",
    description: "Recomendado (30 por página)",
    qrSize: 30,
    cellW: 35,
    cellH: 40,
    cols: 5,
    rows: 6,
    marginX: 20.45,
    marginY: 19.7,
    qrYOffset: 2.0,
    textYOffset: 34.5,
    nameFontSize: 6.5,
    perPage: 30,
  },
  "4x4": {
    key: "4x4",
    label: "4x4 cm",
    dimCm: "4.0 x 4.0 cm",
    description: "Estándar (20 por página)",
    qrSize: 40,
    cellW: 46,
    cellH: 51,
    cols: 4,
    rows: 5,
    marginX: 16.0,
    marginY: 12.2,
    qrYOffset: 2.5,
    textYOffset: 45.0,
    nameFontSize: 7.5,
    perPage: 20,
  },
  "5x5": {
    key: "5x5",
    label: "5x5 cm",
    dimCm: "5.0 x 5.0 cm",
    description: "Alta visibilidad (12 por página)",
    qrSize: 50,
    cellW: 60,
    cellH: 63,
    cols: 3,
    rows: 4,
    marginX: 17.95,
    marginY: 13.7,
    qrYOffset: 3.0,
    textYOffset: 56.0,
    nameFontSize: 8.5,
    perPage: 12,
  },
};

export const ModalQrPdf: React.FC<ModalQrPdfProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const [selectedSize, setSelectedSize] = useState<QrSizeKey>("3x3");
  const [productList, setProductList] = useState<any[]>(products);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number | string>>(new Set());
  const [productCopies, setProductCopies] = useState<Record<string | number, number>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<jsPDF | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string>("");
  const [generatedStats, setGeneratedStats] = useState<{
    totalLabels: number;
    totalPages: number;
  } | null>(null);

  // Hook de adaptación responsiva y gestión del teclado móvil (Android/Capacitor, iOS, Web)
  const {
    viewportHeight,
    isKeyboardOpen,
    isMobile,
    prefersReducedMotion,
    containerRef,
  } = useMobileKeyboardViewport();

  // Gesto táctil estilo bottom sheet: arrastrar hacia abajo para cerrar
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  const handleDragTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
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
    if (dragOffsetY > 65) {
      onClose();
    }
    setDragOffsetY(0);
  };

  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0);
      setIsDraggingSheet(false);
    }
  }, [isOpen]);

  const modalPlacement = useMemo<"center" | "bottom-center" | "top">(() => {
    if (!isMobile) return "center";
    return isKeyboardOpen ? "top" : "bottom-center";
  }, [isMobile, isKeyboardOpen]);

  const modalStyle = useMemo<React.CSSProperties>(() => {
    const transform = dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined;
    const transition = isDraggingSheet
      ? "none"
      : prefersReducedMotion
      ? "none"
      : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), height 180ms cubic-bezier(0.16, 1, 0.3, 1), max-height 180ms cubic-bezier(0.16, 1, 0.3, 1)";

    if (!isMobile) return {};
    if (isKeyboardOpen && viewportHeight > 0) {
      return {
        height: `${viewportHeight}px`,
        maxHeight: `${viewportHeight}px`,
        transform,
        transition,
      };
    }
    return {
      maxHeight: "94dvh",
      transform,
      transition,
    };
  }, [isMobile, isKeyboardOpen, viewportHeight, prefersReducedMotion, dragOffsetY, isDraggingSheet]);

  const footerStyle = useMemo<React.CSSProperties>(() => {
    if (isMobile && !isKeyboardOpen) {
      return {
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
      };
    }
    return {};
  }, [isMobile, isKeyboardOpen]);

  // Funciones auxiliares para obtener SKU y código de barras de manera infalible
  const getProductSku = (p: any): string => {
    return String(p?.sku || p?.product?.sku || p?.code || "").trim();
  };

  const getProductBarcode = (p: any): string => {
    return String(p?.barcode || p?.product?.barcode || "").trim();
  };

  const getProductQrValue = (p: any): string => {
    const sku = getProductSku(p);
    if (sku) return sku;
    const barcode = getProductBarcode(p);
    if (barcode) return barcode;
    return String(p?.id || "").trim();
  };

  // Reiniciar estados al abrir
  useEffect(() => {
    if (isOpen) {
      setProductList(products);
      const defaultIds = new Set<number | string>();
      const initialCopies: Record<string | number, number> = {};
      products.forEach((p) => {
        const hasBarcode = Boolean(getProductBarcode(p));
        // Preseleccionar los que no tienen código de barras como sugerencia
        if (!hasBarcode) {
          defaultIds.add(p.id);
        }
        initialCopies[p.id] = 1;
      });
      // Si todos tenían barras o la lista estaba vacía, preseleccionar todos para agilizar
      if (defaultIds.size === 0 && products.length > 0) {
        products.forEach((p) => defaultIds.add(p.id));
      }
      setSelectedProductIds(defaultIds);
      setProductCopies(initialCopies);
      setGeneratedPdfUrl(null);
      setGeneratedDoc(null);
      setGeneratedStats(null);
      setIsGenerating(false);
      setGenerationProgress(0);
      setSearchQuery("");
      setIsSearchingBackend(false);
    }
  }, [isOpen, products]);

  // Búsqueda remota flexible en el Backend
  useEffect(() => {
    if (!isOpen) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setIsSearchingBackend(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingBackend(true);
      try {
        const res = await tenantApi.get("/inventory-warehouses", {
          params: { search: trimmed, per_page: 50 },
        });
        const rawGroups: any[] = res.data?.products || [];
        const backendProds = rawGroups.flatMap((g: any) =>
          (g.products || []).map((p: any) => ({
            ...p,
            category_name: p.category_path || p.category || g.category_path || g.category || "",
            category_slug: p.category_slug || g.category_slug || g.slug_category || g.slug || "",
            brand: p.brand || p.brand_name || "",
            stock_quantity: p.stock_quantity ?? p.stock ?? 0,
          }))
        );

        let allFound = backendProds;
        if (allFound.length === 0) {
          try {
            const prodRes = await tenantApi.get("/products", {
              params: { search: trimmed },
            });
            const catProds = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || [];
            if (catProds.length > 0) {
              allFound = catProds.map((cp: any) => ({
                ...cp,
                category_name: cp.category_path || cp.category || "",
                stock_quantity: cp.stock ?? cp.stock_quantity ?? 0,
              }));
            }
          } catch {
            // fallback
          }
        }

        if (allFound.length > 0) {
          setProductList((prev) => {
            const existingMap = new Map(prev.map((item) => [String(item.id), item]));
            allFound.forEach((item: any) => {
              const idStr = String(item.id);
              if (!existingMap.has(idStr)) {
                existingMap.set(idStr, item);
              } else {
                existingMap.set(idStr, { ...existingMap.get(idStr), ...item });
              }
            });
            return Array.from(existingMap.values());
          });
        }
      } catch (err) {
        console.error("Error buscando productos en backend:", err);
      } finally {
        setIsSearchingBackend(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, isOpen]);

  // Ordenar productos: primero los que NO tienen código de barras, al final los que SÍ tienen código de barras
  const sortedProducts = useMemo(() => {
    return [...productList].sort((a, b) => {
      const aHasBarcode = Boolean(getProductBarcode(a));
      const bHasBarcode = Boolean(getProductBarcode(b));
      if (aHasBarcode === bHasBarcode) return 0;
      return aHasBarcode ? 1 : -1;
    });
  }, [productList]);

  // Filtrado de productos en la lista
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return sortedProducts;
    const q = searchQuery.toLowerCase().trim();
    return sortedProducts.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const sku = getProductSku(p).toLowerCase();
      const barcode = getProductBarcode(p).toLowerCase();
      const category = (p.category_name || p.category || "").toLowerCase();
      const brand = (p.brand || "").toLowerCase();
      const id = String(p.id || "").toLowerCase();
      return (
        name.includes(q) ||
        sku.includes(q) ||
        barcode.includes(q) ||
        category.includes(q) ||
        brand.includes(q) ||
        id.includes(q)
      );
    });
  }, [sortedProducts, searchQuery]);

  // Selección masiva
  const handleToggleSelectAll = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.has(id));

    const next = new Set(selectedProductIds);
    if (allVisibleSelected) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    setSelectedProductIds(next);
  };

  const handleToggleProduct = (id: number | string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!productCopies[id]) {
        setProductCopies((prev) => ({ ...prev, [id]: 1 }));
      }
    }
    setSelectedProductIds(next);
  };

  const handleCopiesChange = (id: number | string, val: number) => {
    const count = Math.max(1, Math.min(100, isNaN(val) ? 1 : val));
    setProductCopies((prev) => ({ ...prev, [id]: count }));
  };

  // Cálculo de etiquetas seleccionadas
  const totalSelectedLabels = useMemo(() => {
    let count = 0;
    productList.forEach((p) => {
      if (selectedProductIds.has(p.id)) {
        count += productCopies[p.id] || 1;
      }
    });
    return count;
  }, [productList, selectedProductIds, productCopies]);

  const activeConfig = SIZE_CONFIGS[selectedSize];
  const estimatedPages = Math.ceil(totalSelectedLabels / activeConfig.perPage) || 0;

  // GENERACIÓN DEL PDF
  const handleGeneratePdf = async () => {
    if (totalSelectedLabels === 0) {
      toast.error("Selecciona al menos un producto para generar los códigos QR.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(5);
    setGeneratedPdfUrl(null);
    setGeneratedDoc(null);

    try {
      const config = SIZE_CONFIGS[selectedSize];
      const doc = new jsPDF({
        format: "letter",
        unit: "mm",
        orientation: "portrait",
      });

      // Crear lista expandida de etiquetas con el identificador del producto
      const itemsToPrint: Array<{ sku: string; name: string }> = [];

      productList.forEach((p) => {
        if (selectedProductIds.has(p.id)) {
          const qrCode = getProductQrValue(p);
          const copies = productCopies[p.id] || 1;
          for (let c = 0; c < copies; c++) {
            itemsToPrint.push({
              sku: qrCode,
              name: p.name || "Producto",
            });
          }
        }
      });

      if (itemsToPrint.length === 0) {
        toast.error("Selecciona al menos un producto para generar los códigos QR.");
        setIsGenerating(false);
        return;
      }

      const totalItems = itemsToPrint.length;
      const itemsPerPage = config.cols * config.rows;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      // Cache para no re-generar códigos QR idénticos
      const qrCache = new Map<string, string>();

      for (let i = 0; i < totalItems; i++) {
        const item = itemsToPrint[i];
        const pageIndex = Math.floor(i / itemsPerPage);
        const indexOnPage = i % itemsPerPage;

        if (indexOnPage === 0 && pageIndex > 0) {
          doc.addPage("letter", "portrait");
        }

        const col = indexOnPage % config.cols;
        const row = Math.floor(indexOnPage / config.cols);

        const cellX = config.marginX + col * config.cellW;
        const cellY = config.marginY + row * config.cellH;

        // 1. Bordes de recorte (líneas punteadas color gris tenue)
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.15);
        doc.setLineDashPattern([1.5, 1], 0);
        doc.rect(cellX, cellY, config.cellW, config.cellH);
        doc.setLineDashPattern([], 0); // Restaurar línea continua

        // 2. Generar o recuperar QR del cache
        let qrDataUrl = qrCache.get(item.sku);
        if (!qrDataUrl) {
          qrDataUrl = await QRCode.toDataURL(item.sku, {
            margin: 1,
            errorCorrectionLevel: "M",
            width: 256,
          });
          qrCache.set(item.sku, qrDataUrl);
        }

        // 3. Insertar imagen QR centrada horizontalmente
        const qrX = cellX + (config.cellW - config.qrSize) / 2;
        const qrY = cellY + config.qrYOffset;
        doc.addImage(qrDataUrl, "PNG", qrX, qrY, config.qrSize, config.qrSize);

        // 4. Nombre del producto en letra pequeña debajo del QR
        doc.setFont("helvetica", "bold");
        doc.setFontSize(config.nameFontSize);
        doc.setTextColor(30, 30, 30);
        const textX = cellX + config.cellW / 2;
        const textY = cellY + config.textYOffset;

        doc.text(item.name, textX, textY, {
          align: "center",
          maxWidth: config.cellW - 2,
        });

        // 5. Código SKU en texto diminuto
        doc.setFont("helvetica", "normal");
        doc.setFontSize(Math.max(4.5, config.nameFontSize - 1.5));
        doc.setTextColor(110, 110, 110);
        const skuY = textY + (config.nameFontSize > 7 ? 3.5 : 2.8);
        if (skuY < cellY + config.cellH - 1) {
          doc.text(item.sku, textX, skuY, {
            align: "center",
            maxWidth: config.cellW - 2,
          });
        }

        // Actualizar barra de progreso
        if (i % 4 === 0 || i === totalItems - 1) {
          setGenerationProgress(Math.round(((i + 1) / totalItems) * 100));
          await new Promise((resolve) => setTimeout(resolve, 3));
        }
      }

      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const filename = `codigos_qr_almacen_${selectedSize}_carta_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      setGeneratedPdfUrl(pdfUrl);
      setGeneratedDoc(doc);
      setGeneratedFilename(filename);
      setGeneratedStats({
        totalLabels: totalItems,
        totalPages,
      });

      toast.success("¡Archivo PDF con códigos QR generado exitosamente!");
    } catch (error) {
      console.error("Error al generar PDF de códigos QR:", error);
      toast.error("Error al generar el archivo PDF de códigos QR.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Descarga del archivo
  const handleDownload = () => {
    if (generatedDoc && generatedFilename) {
      generatedDoc.save(generatedFilename);
      toast.success(`Descargando ${generatedFilename}...`);
    } else if (generatedPdfUrl) {
      const a = document.createElement("a");
      a.href = generatedPdfUrl;
      a.download = generatedFilename || "codigos_qr_almacen.pdf";
      a.click();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      placement={modalPlacement}
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
            y: isMobile ? "100%" : 20,
            opacity: 0,
            transition: {
              duration: 0.18,
              ease: [0.7, 0, 0.84, 0],
            },
          },
        },
      }}
      classNames={{
        wrapper: isMobile
          ? (isKeyboardOpen
              ? "items-start justify-center p-0"
              : "items-end sm:items-center justify-center p-0 sm:p-4")
          : "items-center justify-center",
        base: [
          "bg-background border border-default-200 dark:border-default-100",
          "w-full max-w-full sm:max-w-3xl",
          "m-0 sm:my-auto",
          "overflow-hidden min-h-0",
          isMobile
            ? (isKeyboardOpen
                ? "rounded-none max-h-full h-full"
                : "rounded-t-2xl rounded-b-none sm:rounded-2xl max-h-[94dvh] sm:max-h-[90vh]")
            : "rounded-2xl sm:max-h-[90vh]",
        ].join(" "),
        header: "border-b border-default-200 dark:border-default-100 pb-2.5 sm:pb-3 px-3.5 sm:px-6 shrink-0",
        body: "py-3 sm:py-4 px-3.5 sm:px-6 flex flex-col gap-4 sm:gap-5 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0",
        footer: "border-t border-default-200 dark:border-default-100 pt-2.5 sm:pt-3 px-3.5 sm:px-6 shrink-0 bg-background",
      }}
    >
      <ModalContent style={modalStyle}>
        {() => (
          <div ref={containerRef} className="flex flex-col h-full w-full min-h-0 overflow-hidden">
            {/* Indicador visual de Mobile Sheet con gesto de arrastre hacia abajo para cerrar */}
            {isMobile && !isKeyboardOpen && (
              <div
                className="sm:hidden w-full flex justify-center pt-3 pb-1.5 cursor-grab active:cursor-grabbing select-none touch-none"
                onTouchStart={handleDragTouchStart}
                onTouchMove={handleDragTouchMove}
                onTouchEnd={handleDragTouchEnd}
                onTouchCancel={handleDragTouchEnd}
                onClick={onClose}
                title="Deslizar hacia abajo o tocar para cerrar"
              >
                <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
              </div>
            )}
            <ModalHeader
              className="flex flex-col gap-1 select-none cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleDragTouchStart}
              onTouchMove={handleDragTouchMove}
              onTouchEnd={handleDragTouchEnd}
              onTouchCancel={handleDragTouchEnd}
            >
              <div className="flex items-center gap-2 text-secondary font-bold text-lg">
                <FaQrcode className="text-xl" />
                <span>Generar Códigos QR en PDF (SKU)</span>
              </div>
              <p className="text-xs text-default-500 font-normal">
                Genera etiquetas QR a partir del SKU con nombre de producto, tamaño Carta y líneas de recorte.
              </p>
            </ModalHeader>

            <ModalBody className="py-4 flex flex-col gap-5">
              {/* SECCIÓN 1: SELECCIÓN DE TAMAÑO */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5">
                  <FaScissors className="text-secondary text-xs" />
                  <span>1. Selecciona el tamaño del Código QR:</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(Object.keys(SIZE_CONFIGS) as QrSizeKey[]).map((key) => {
                    const cfg = SIZE_CONFIGS[key];
                    const isSelected = selectedSize === key;
                    return (
                      <Card
                        key={key}
                        isPressable
                        onPress={() => {
                          setSelectedSize(key);
                          // Reset generated PDF on size change
                          setGeneratedPdfUrl(null);
                        }}
                        className={`border-2 transition-all p-2.5 text-center ${
                          isSelected
                            ? "border-secondary bg-secondary/10 shadow-sm"
                            : "border-default-200 bg-background hover:border-default-400"
                        }`}
                      >
                        <CardBody className="p-1 flex flex-col items-center gap-1">
                          <span className="font-bold text-sm text-foreground">
                            {cfg.label}
                          </span>
                          <Chip
                            size="sm"
                            variant={isSelected ? "solid" : "flat"}
                            color={isSelected ? "secondary" : "default"}
                            className="h-5 text-[10px] font-semibold"
                          >
                            {cfg.perPage} por hoja
                          </Chip>
                          <span className="text-[10px] text-default-400">
                            {cfg.cols} col × {cfg.rows} filas
                          </span>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 2: SELECCIÓN DE PRODUCTOS */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-default-600">
                    2. Selecciona los productos a imprimir:
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-default-500 font-medium">
                      {selectedProductIds.size} de {productList.length} seleccionados
                    </span>
                    <Button
                      size="sm"
                      variant="flat"
                      color="secondary"
                      className="h-6 text-[11px] px-2"
                      onPress={handleToggleSelectAll}
                    >
                      {filteredProducts.length > 0 &&
                      filteredProducts.every((p) => selectedProductIds.has(p.id))
                        ? "Deseleccionar visibles"
                        : "Seleccionar visibles"}
                    </Button>
                  </div>
                </div>

                {/* Buscador de productos con búsqueda remota */}
                <Input
                  size="sm"
                  placeholder="Buscar por producto, SKU, código de barras o marca..."
                  startContent={<FaMagnifyingGlass className="text-default-400 text-xs" />}
                  endContent={
                    isSearchingBackend ? (
                      <Spinner size="sm" color="secondary" />
                    ) : null
                  }
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  isClearable
                  onClear={() => setSearchQuery("")}
                  variant="bordered"
                />

                {/* Lista de productos con scroll */}
                <div className="max-h-48 sm:max-h-60 overflow-y-auto overscroll-contain border border-default-200 rounded-xl p-1 bg-default-50/40 flex flex-col gap-1 divide-y divide-default-100">
                  {filteredProducts.length === 0 ? (
                    <div className="p-6 text-center text-default-400 text-xs">
                      {isSearchingBackend
                        ? "Buscando en catálogo y almacén..."
                        : "No se encontraron productos coincidentes."}
                    </div>
                  ) : (
                    filteredProducts.map((prod) => {
                      const isSelected = selectedProductIds.has(prod.id);
                      const copies = productCopies[prod.id] || 1;
                      const prodSku = getProductSku(prod);
                      const prodBarcode = getProductBarcode(prod);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleToggleProduct(prod.id)}
                          className={`flex items-center justify-between p-2 rounded-lg transition-colors gap-3 cursor-pointer select-none ${
                            isSelected
                              ? "bg-secondary/10 border border-secondary/20"
                              : "hover:bg-default-100 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Checkbox
                              isSelected={isSelected}
                              onValueChange={() => handleToggleProduct(prod.id)}
                              color="secondary"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <img
                              src={
                                prod.thumbnail || prod.image
                                  ? getImageUrl(prod.thumbnail || prod.image)
                                  : "/placeholder.png"
                              }
                              alt={prod.name}
                              className="w-9 h-9 object-cover rounded-md border border-default-200 shrink-0"
                              onError={(e: any) => {
                                e.target.src =
                                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'><rect width='36' height='36' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='10' fill='%2394a3b8'>IMG</text></svg>";
                              }}
                            />
                            <div className="flex flex-col min-w-0">
                              <span
                                className="text-xs font-semibold text-foreground truncate hover:text-secondary"
                              >
                                {prod.name}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                                {prodSku ? (
                                  <Chip size="sm" variant="flat" color="secondary" className="h-4 text-[10px] font-mono font-bold">
                                    SKU: {prodSku}
                                  </Chip>
                                ) : prodBarcode ? (
                                  <Chip size="sm" variant="flat" color="default" className="h-4 text-[10px] font-mono text-default-600 font-bold">
                                    Barras: {prodBarcode}
                                  </Chip>
                                ) : (
                                  <Chip size="sm" variant="flat" color="warning" className="h-4 text-[10px] font-mono font-medium">
                                    ID: {prod.id}
                                  </Chip>
                                )}
                                {prodBarcode && prodSku && (
                                  <span className="text-default-400 text-[10px]">
                                    • Barras: {prodBarcode}
                                  </span>
                                )}
                                {prod.brand && (
                                  <span className="text-default-400 text-[10px]">
                                    • {prod.brand}
                                  </span>
                                )}
                                <span className="text-default-400 text-[10px]">
                                  • Stock: {prod.stock_quantity ?? prod.stock ?? 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Selector de copias */}
                          {isSelected && (
                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[10px] text-default-400">Copias:</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={99}
                                value={copies}
                                onChange={(e) =>
                                  handleCopiesChange(prod.id, parseInt(e.target.value, 10))
                                }
                                className="w-12 h-7 text-center text-xs font-bold border border-default-300 rounded-lg bg-background focus:outline-none focus:border-secondary"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: RESUMEN Y CONFIGURACIÓN DE PÁGINA */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-default-100 dark:bg-default-50/50 rounded-xl border border-default-200 text-xs">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    Resumen para Impresión:
                  </span>
                  <span className="text-default-500">
                    Formato Carta (21.59 × 27.94 cm) • Márgenes estrechos • Guías de corte
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip size="sm" color="secondary" variant="flat" className="font-semibold">
                    {totalSelectedLabels} etiquetas en total
                  </Chip>
                  <Chip size="sm" color="default" variant="flat">
                    ~{estimatedPages} {estimatedPages === 1 ? "página" : "páginas"}
                  </Chip>
                </div>
              </div>

              {/* BARRA DE PROGRESO AL GENERAR */}
              {isGenerating && (
                <div className="flex flex-col gap-2 p-4 bg-secondary/10 border border-secondary/20 rounded-xl">
                  <div className="flex justify-between items-center text-xs font-semibold text-secondary">
                    <span className="flex items-center gap-1.5">
                      <FaArrowsRotate className="animate-spin" />
                      <span>Generando archivo PDF con códigos QR...</span>
                    </span>
                    <span>{generationProgress}%</span>
                  </div>
                  <Progress
                    size="sm"
                    color="secondary"
                    value={generationProgress}
                    className="max-w-full"
                  />
                  <span className="text-[11px] text-default-500 text-center">
                    Renderizando códigos QR con SKU y formato de corte...
                  </span>
                </div>
              )}

              {/* RESULTADO Y ENLACE DE DESCARGA */}
              {generatedPdfUrl && !isGenerating && (
                <div className="p-4 bg-success-50 dark:bg-success-950/20 border-2 border-success-400/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-success text-white">
                      <FaCheck className="text-lg" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">
                        ¡Archivo PDF generado con éxito!
                      </span>
                      <span className="text-xs text-default-500">
                        {generatedStats?.totalLabels} códigos QR listos en {generatedStats?.totalPages}{" "}
                        hoja(s) tamaño Carta.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Tooltip content="Abrir en pestaña nueva">
                      <Button
                        size="sm"
                        variant="bordered"
                        startContent={<FaArrowUpRightFromSquare className="text-xs" />}
                        onPress={() => window.open(generatedPdfUrl, "_blank")}
                      >
                        Ver PDF
                      </Button>
                    </Tooltip>

                    {/* ENLACE / BOTÓN DE DESCARGA DIRECTA */}
                    <Button
                      size="sm"
                      color="success"
                      variant="shadow"
                      startContent={<FaDownload className="text-xs" />}
                      onPress={handleDownload}
                      className="font-bold text-white shadow-success/30"
                    >
                      Descargar Códigos QR
                    </Button>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter style={footerStyle} className="flex flex-wrap items-center justify-between gap-2">
              <Button
                size="sm"
                variant="light"
                color="default"
                onPress={onClose}
                isDisabled={isGenerating}
                className="h-8 text-xs font-medium"
              >
                Cerrar
              </Button>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {generatedPdfUrl && !isGenerating ? (
                  <Button
                    size="sm"
                    color="secondary"
                    variant="flat"
                    onPress={handleGeneratePdf}
                    startContent={<FaArrowsRotate className="text-xs" />}
                    className="h-8 text-xs font-medium"
                  >
                    Volver a generar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    color="secondary"
                    variant="shadow"
                    isLoading={isGenerating}
                    isDisabled={totalSelectedLabels === 0 || isGenerating}
                    startContent={!isGenerating ? <FaFilePdf className="text-xs" /> : undefined}
                    onPress={handleGeneratePdf}
                    className="h-8 text-xs font-semibold shadow-secondary/25"
                  >
                    {isGenerating ? "Generando..." : "Generar"}
                  </Button>
                )}
              </div>
            </ModalFooter>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ModalQrPdf;
