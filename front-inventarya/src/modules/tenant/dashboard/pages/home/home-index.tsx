import React, { useEffect } from "react";
import { DynamicBreadcrumbs } from "@/components";
import { useHomeStore } from "../../store/home/home.store";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardKpiCards } from "./DashboardKpiCards";
import { DashboardSalesChart } from "./DashboardSalesChart";
import { DashboardPaymentBreakdown } from "./DashboardPaymentBreakdown";
import { DashboardTopProducts } from "./DashboardTopProducts";
import { DashboardStockAlerts } from "./DashboardStockAlerts";
import { DashboardRecentSales } from "./DashboardRecentSales";

export const HomeIndex: React.FC = () => {
  const { summary, isLoading, fetchSummary } = useHomeStore();

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="h-full flex flex-col gap-6 px-3 sm:px-6 py-4 max-w-[96rem] mx-auto w-full animate-in fade-in duration-300">
      {/* Migas de pan y Cabecera de Control */}
      <div className="flex flex-col gap-3">
        <DynamicBreadcrumbs title="Inicio" />
        <DashboardHeader />
      </div>

      {/* 1. KPIs Principales */}
      <DashboardKpiCards 
        kpis={summary?.kpis} 
        isLoading={isLoading} 
      />

      {/* 2. Gráfico Interactivo de Rendimiento */}
      <DashboardSalesChart 
        timeline={summary?.timeline || []} 
        isLoading={isLoading} 
      />

      {/* 3. Desglose de Métodos de Pago y Sucursales */}
      <DashboardPaymentBreakdown
        paymentMethods={summary?.payment_methods || []}
        storesPerformance={summary?.stores_performance || []}
        isLoading={isLoading}
      />

      {/* 4. Tablas Operativas: Top Productos & Alertas de Reposición */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DashboardTopProducts
          topProducts={summary?.top_products || []}
          isLoading={isLoading}
        />
        <DashboardStockAlerts
          alerts={summary?.critical_alerts || []}
          isLoading={isLoading}
        />
      </div>

      {/* 5. Últimas Transacciones en Vivo */}
      <DashboardRecentSales
        recentSales={summary?.recent_sales || []}
        isLoading={isLoading}
      />

      {/* Estilos específicos para impresión limpia de Reporte Ejecutivo */}
      <style>{`
        @media print {
          nav, header, aside, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .max-w-[96rem] {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
