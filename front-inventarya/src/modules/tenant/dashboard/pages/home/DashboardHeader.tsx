import React, { useState } from "react";
import { Button, Select, SelectItem, ButtonGroup, Chip } from "@nextui-org/react";
import {
  LuRefreshCw,
  LuDatabase,
  LuPrinter,
  LuStore,
  LuCalendar,
  LuSparkles,
  LuFileText
} from "react-icons/lu";
import { useHomeStore } from "../../store/home/home.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { ModalDashboardReport } from "../../components/ModalDashboardReport";

export const DashboardHeader: React.FC = () => {
  const {
    summary,
    period,
    setPeriod,
    storeFilter,
    setStoreFilter,
    fetchSummary,
    isRefreshing,
    getBackup
  } = useHomeStore();

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const shops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);
  const { token } = useTenantAuthStore();

  React.useEffect(() => {
    if (token && shops.length === 0) {
      getShops(token);
    }
  }, [token, shops.length, getShops]);

  const periodOptions = [
    { key: "today", label: "Hoy" },
    { key: "7days", label: "7 Días" },
    { key: "30days", label: "30 Días" },
    { key: "this_month", label: "Este Mes" },
  ];

  const getPeriodLabel = (p: string): string => {
    switch (p) {
      case "today": return "Hoy";
      case "yesterday": return "Ayer";
      case "7days": return "Últimos 7 Días";
      case "30days": return "Últimos 30 Días";
      case "this_month": return "Este Mes";
      case "custom": return "Rango Personalizado";
      default: return "Últimos 30 Días";
    }
  };

  const getStoreName = (sId: string): string => {
    if (sId === "all" || !sId) return "Todas las sucursales";
    const found = shops.find((s) => String(s.id) === String(sId));
    return found ? found.name : `Sucursal #${sId}`;
  };

  return (
    <>
      <div className="flex flex-col gap-2 pb-2 border-b border-default-200 dark:border-default-100 no-print">
        {/* Fila Superior: Título y Acciones Principales */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                Panel de Control
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-default-500 hidden md:block">
              Analítica integral de ventas, inventario patrimonial y sucursales en tiempo real
            </p>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="flat"
              color="default"
              startContent={<LuRefreshCw size={15} className={isRefreshing ? "animate-spin text-primary" : ""} />}
              onPress={() => fetchSummary()}
              isLoading={isRefreshing}
              className="font-semibold text-xs"
            >
              Actualizar
            </Button>

            {/* <Button
              size="sm"
              variant="flat"
              color="secondary"
              startContent={<LuDatabase size={15} />}
              onPress={() => getBackup()}
              className="font-semibold text-xs"
            >
              Copia de Seguridad
            </Button> */}

            <Button
              size="sm"
              variant="solid"
              color="primary"
              startContent={<LuPrinter size={15} />}
              onPress={() => setIsReportModalOpen(true)}
              className="font-bold text-xs shadow-md shadow-primary/20"
            >
              Imprimir Reporte
            </Button>
          </div>
        </div>

        {/* Fila Inferior: Filtros Reactivos de Periodo y Sucursales */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 bg-default-50 dark:bg-default-100/40 p-2.5 dark:border-default-100">
          {/* Selector de Periodo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-default-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <LuCalendar size={13} /> Periodo:
            </span>
            <ButtonGroup size="sm" variant="flat" className="bg-background/80 p-0.5 rounded-lg border border-default-200 dark:border-default-100">
              {periodOptions.map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  color={period === opt.key ? "primary" : "default"}
                  variant={period === opt.key ? "solid" : "light"}
                  className={`text-xs font-semibold px-3 ${period === opt.key
                    ? "font-bold shadow-sm"
                    : "text-default-600 hover:text-foreground"
                    }`}
                  onPress={() => setPeriod(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>

          {/* Filtro de Sucursales */}
          <div className="flex items-center gap-2 min-w-[240px]">
            <Select
              items={[
                { id: "all", label: "Todas las sucursales" },
                ...shops.map((s) => ({ id: String(s.id), label: `📍 ${s.name}` })),
              ]}
              size="sm"
              variant="bordered"
              labelPlacement="outside"
              selectedKeys={[storeFilter]}
              onChange={(e) => setStoreFilter(e.target.value || "all")}
              startContent={<LuStore size={15} className="text-default-400" />}
              aria-label="Filtrar por sucursal"
              className="w-full sm:w-64"
            >
              {(item) => (
                <SelectItem key={item.id} textValue={item.label}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          </div>
        </div>
      </div>

      {/* Modal de Previsualización y Descarga del Reporte PDF */}
      <ModalDashboardReport
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        summary={summary}
        periodLabel={getPeriodLabel(period)}
        storeName={getStoreName(storeFilter)}
      />
    </>
  );
};
