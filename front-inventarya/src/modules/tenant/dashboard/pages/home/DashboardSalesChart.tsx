import React, { useState } from "react";
import { Card, CardBody, Button, ButtonGroup, Chip } from "@nextui-org/react";
import { LuTrendingUp, LuBarChart3, LuCalendar } from "react-icons/lu";
import { PriceDisplay } from "@/components";
import { TimelinePoint } from "../../store/home/home.store";

interface Props {
  timeline: TimelinePoint[];
  isLoading: boolean;
}

export const DashboardSalesChart: React.FC<Props> = ({ timeline, isLoading }) => {
  const [activeMetric, setActiveMetric] = useState<"sales" | "orders">("sales");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading || !timeline || timeline.length === 0) {
    return (
      <Card className="border border-default-200 shadow-sm rounded-2xl p-6 min-h-[340px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-default-200" />
          <div className="h-4 w-48 bg-default-200 rounded" />
        </div>
      </Card>
    );
  }

  // Dimensiones del SVG
  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const maxSales = Math.max(...timeline.map((t) => t.sales), 10);
  const maxOrders = Math.max(...timeline.map((t) => t.orders), 5);
  const currentMax = activeMetric === "sales" ? maxSales : maxOrders;

  // Calcular coordenadas
  const points = timeline.map((item, idx) => {
    const x = paddingX + (idx / Math.max(timeline.length - 1, 1)) * innerWidth;
    const value = activeMetric === "sales" ? item.sales : item.orders;
    const y = height - paddingY - (value / currentMax) * innerHeight;
    return { x, y, item, value };
  });

  // Crear trazado de línea suave
  const linePath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");

  // Crear área sombreada
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = points.length > 0
    ? `${linePath} L ${lastPoint.x} ${height - paddingY} L ${firstPoint.x} ${height - paddingY} Z`
    : "";

  const totalPeriodSales = timeline.reduce((acc, t) => acc + t.sales, 0);
  const totalPeriodOrders = timeline.reduce((acc, t) => acc + t.orders, 0);

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1];

  return (
    <Card className="border border-default-200 dark:border-default-100 shadow-sm rounded-2xl overflow-hidden bg-background">
      <CardBody className="p-5 sm:p-6 flex flex-col gap-4">
        {/* Cabecera del Gráfico */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                <LuTrendingUp size={16} />
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-foreground">
                Evolución de Rendimiento
              </h3>
            </div>
            <p className="text-xs text-default-400">
              Tendencia cronológica de recaudación y flujo de transacciones
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ButtonGroup size="sm" variant="flat" className="bg-default-100 p-0.5 rounded-lg">
              <Button
                size="sm"
                color={activeMetric === "sales" ? "primary" : "default"}
                variant={activeMetric === "sales" ? "solid" : "light"}
                className="text-xs font-bold px-3"
                onPress={() => setActiveMetric("sales")}
              >
                Ingresos (<PriceDisplay amount={totalPeriodSales} />)
              </Button>
              <Button
                size="sm"
                color={activeMetric === "orders" ? "primary" : "default"}
                variant={activeMetric === "orders" ? "solid" : "light"}
                className="text-xs font-bold px-3"
                onPress={() => setActiveMetric("orders")}
              >
                Ventas ({totalPeriodOrders})
              </Button>
            </ButtonGroup>
          </div>
        </div>

        {/* Punto Activo / Tooltip Indicator */}
        {activePoint && (
          <div className="flex items-center justify-between px-3 py-2 bg-default-50 dark:bg-default-100/40 rounded-xl border border-default-200 dark:border-default-100 text-xs">
            <div className="flex items-center gap-2 text-default-500">
              <LuCalendar size={13} />
              <span>Fecha / Rango: <strong className="text-foreground">{activePoint.item.label}</strong></span>
            </div>
            <div className="flex items-center gap-3 font-semibold">
              <span>Venta: <strong className="text-primary"><PriceDisplay amount={activePoint.item.sales} /></strong></span>
              <span className="text-default-300">|</span>
              <span>Ventas: <strong className="text-secondary">{activePoint.item.orders}</strong></span>
            </div>
          </div>
        )}

        {/* Contenedor del Gráfico SVG Responsivo */}
        <div className="relative w-full h-[220px] sm:h-[260px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Líneas de Guía Horizontales */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = paddingY + innerHeight * ratio;
              return (
                <line
                  key={i}
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-default-200 dark:text-default-100"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

            {/* Área sombreada */}
            <path
              d={areaPath}
              fill={activeMetric === "sales" ? "url(#salesGradient)" : "url(#ordersGradient)"}
            />

            {/* Línea Principal */}
            <path
              d={linePath}
              fill="none"
              stroke={activeMetric === "sales" ? "#3b82f6" : "#8b5cf6"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Puntos y Zonas Táctiles para Hover */}
            {points.map((pt, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <g key={idx}>
                  {/* Línea vertical en hover */}
                  {isHovered && (
                    <line
                      x1={pt.x}
                      y1={paddingY}
                      x2={pt.x}
                      y2={height - paddingY}
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Círculo del punto */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : 3.5}
                    fill={activeMetric === "sales" ? "#3b82f6" : "#8b5cf6"}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all duration-150 cursor-pointer"
                  />

                  {/* Rectángulo invisible para capturar mouseover amplio */}
                  <rect
                    x={pt.x - (innerWidth / points.length) / 2}
                    y={paddingY}
                    width={innerWidth / points.length}
                    height={innerHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Eje X Etiquetas */}
        <div className="flex justify-between items-center px-4 text-[11px] text-default-400 font-medium">
          <span>{timeline[0]?.label}</span>
          {timeline.length > 2 && <span>{timeline[Math.floor(timeline.length / 2)]?.label}</span>}
          <span>{timeline[timeline.length - 1]?.label}</span>
        </div>
      </CardBody>
    </Card>
  );
};
