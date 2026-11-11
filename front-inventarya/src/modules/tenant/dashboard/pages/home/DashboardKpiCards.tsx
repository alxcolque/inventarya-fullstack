import React from "react";
import { Card, CardBody, Chip, Skeleton } from "@nextui-org/react";
import {
  LuTrendingUp,
  LuTrendingDown,
  LuDollarSign,
  LuReceipt,
  LuBoxes,
  LuAlertTriangle,
  LuCheckCircle2
} from "react-icons/lu";
import { PriceDisplay, CompactNumber } from "@/components";
import { DashboardKpis } from "../../store/home/home.store";

interface Props {
  kpis?: DashboardKpis;
  isLoading: boolean;
}

export const DashboardKpiCards: React.FC<Props> = ({ kpis, isLoading }) => {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3 sm:p-4 border border-default-200 shadow-sm rounded-2xl">
            <Skeleton className="h-3 w-20 rounded-lg mb-2" />
            <Skeleton className="h-7 w-28 rounded-lg mb-2" />
            <Skeleton className="h-3 w-24 rounded-lg" />
          </Card>
        ))}
      </div>
    );
  }

  const isSalesPositive = kpis.sales_growth >= 0;
  const isOrdersPositive = kpis.orders_growth >= 0;
  const hasCriticalStock = kpis.critical_stock_count > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2">
      {/* 1. Ingresos Netos / Ventas */}
      <Card className="relative overflow-hidden border border-default-200 dark:border-default-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-primary-50/40 via-background to-background dark:from-primary-950/20 rounded-2xl">
        <CardBody className="p-3.5 sm:p-5 flex flex-col justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-default-500 uppercase tracking-wider line-clamp-1">
              Ventas Netas
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
              <LuDollarSign size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>

          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight">
              <PriceDisplay amount={kpis.net_sales} compact />
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Chip
                size="sm"
                variant="flat"
                color={isSalesPositive ? "success" : "danger"}
                startContent={
                  isSalesPositive ? <LuTrendingUp size={11} className="ml-1" /> : <LuTrendingDown size={11} className="ml-1" />
                }
                className="font-bold text-[10px] sm:text-[11px] h-5"
              >
                {isSalesPositive ? `+${kpis.sales_growth}%` : `${kpis.sales_growth}%`}
              </Chip>
              <span className="text-[10px] sm:text-[11px] text-default-400 hidden sm:inline">vs previo</span>
            </div>
          </div>

          <div className="pt-2 border-t border-default-100 flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-default-500 gap-1">
            <span>Bruto: <PriceDisplay amount={kpis.total_sales} compact /></span>
            {kpis.total_discount > 0 && (
              <span className="text-danger-500 font-medium">
                Desc: -<PriceDisplay amount={kpis.total_discount} compact />
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 2. Transacciones & Ticket Promedio */}
      <Card className="relative overflow-hidden border border-default-200 dark:border-default-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-secondary-50/40 via-background to-background dark:from-secondary-950/20 rounded-2xl">
        <CardBody className="p-3.5 sm:p-5 flex flex-col justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-default-500 uppercase tracking-wider line-clamp-1">
              Transacciones
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-secondary-100 text-secondary-600 dark:bg-secondary-950 dark:text-secondary-400">
              <LuReceipt size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>

          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-baseline gap-1.5">
              <CompactNumber value={kpis.orders_count} mobileCompactOnly />
              <span className="text-xs font-medium text-default-400">pedidos</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Chip
                size="sm"
                variant="flat"
                color={isOrdersPositive ? "success" : "default"}
                className="font-bold text-[10px] sm:text-[11px] h-5"
              >
                Ticket: <PriceDisplay amount={kpis.avg_ticket} compact />
              </Chip>
            </div>
          </div>

          <div className="pt-2 border-t border-default-100 flex items-center justify-between text-[10px] sm:text-[11px] text-default-500">
            <span className="hidden sm:inline">Crecimiento:</span>
            <span className="sm:hidden">Var:</span>
            <span className={`font-semibold ${isOrdersPositive ? "text-success-600" : "text-danger-500"}`}>
              {isOrdersPositive ? `+${kpis.orders_growth}%` : `${kpis.orders_growth}%`}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* 3. Valorización Patrimonial de Inventario */}
      <Card className="relative overflow-hidden border border-default-200 dark:border-default-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-success-50/40 via-background to-background dark:from-success-950/20 rounded-2xl">
        <CardBody className="p-3.5 sm:p-5 flex flex-col justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-default-500 uppercase tracking-wider line-clamp-1">
              Valor Inventario
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-success-100 text-success-600 dark:bg-success-950 dark:text-success-400">
              <LuBoxes size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          </div>

          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight">
              <PriceDisplay amount={kpis.inventory_cost_valuation} compact />
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-[10px] sm:text-[11px] text-default-500">
              <span className="font-semibold text-foreground">
                <CompactNumber value={kpis.warehouse_items + kpis.stores_items} mobileCompactOnly />
              </span>
              <span>unid. activas</span>
            </div>
          </div>

          <div className="pt-2 border-t border-default-100 flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-default-500 gap-1">
            <span>Alm: <PriceDisplay amount={kpis.warehouse_cost} compact /></span>
            <span>Tda: <PriceDisplay amount={kpis.stores_cost} compact /></span>
          </div>
        </CardBody>
      </Card>

      {/* 4. Salud de Stock & Alertas Críticas */}
      <Card className="relative overflow-hidden border border-default-200 dark:border-default-100 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-warning-50/40 via-background to-background dark:from-warning-950/20 rounded-2xl">
        <CardBody className="p-3.5 sm:p-5 flex flex-col justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-default-500 uppercase tracking-wider line-clamp-1">
              Alertas Stock
            </span>
            <div className={`p-1.5 sm:p-2 rounded-xl ${hasCriticalStock
              ? "bg-danger-100 text-danger-600 dark:bg-danger-950 dark:text-danger-400"
              : "bg-success-100 text-success-600 dark:bg-success-950 dark:text-success-400"
              }`}>
              {hasCriticalStock ? <LuAlertTriangle size={16} className="sm:w-[18px] sm:h-[18px]" /> : <LuCheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </div>
          </div>

          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-baseline gap-1.5">
              <span className={hasCriticalStock ? "text-danger-600 dark:text-danger-400" : "text-success-600"}>
                <CompactNumber value={kpis.critical_stock_count} mobileCompactOnly />
              </span>
              <span className="text-xs font-medium text-default-400">críticos</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Chip
                size="sm"
                variant="flat"
                color={kpis.out_of_stock_count > 0 ? "danger" : "warning"}
                className="font-bold text-[10px] sm:text-[11px] h-5"
              >
                <CompactNumber value={kpis.out_of_stock_count} mobileCompactOnly /> agotados
              </Chip>
            </div>
          </div>

          <div className="pt-2 border-t border-default-100 flex items-center justify-between text-[10px] sm:text-[11px] text-default-500">
            <span>Catálogo:</span>
            <span className="font-semibold text-foreground">
              <CompactNumber value={kpis.total_products} mobileCompactOnly /> prod.
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
