import React from "react";
import { Card, CardBody, Progress, Chip } from "@nextui-org/react";
import {
  LuCreditCard,
  LuBanknote,
  LuQrCode,
  LuStore,
  LuPercent,
  LuWallet
} from "react-icons/lu";
import { PriceDisplay } from "@/components";
import { PaymentMethodItem, StorePerformanceItem } from "../../store/home/home.store";

interface Props {
  paymentMethods: PaymentMethodItem[];
  storesPerformance: StorePerformanceItem[];
  isLoading: boolean;
}

export const DashboardPaymentBreakdown: React.FC<Props> = ({
  paymentMethods,
  storesPerformance,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 border border-default-200 shadow-sm rounded-2xl min-h-[220px] animate-pulse bg-default-100" />
        <Card className="p-5 border border-default-200 shadow-sm rounded-2xl min-h-[220px] animate-pulse bg-default-100" />
      </div>
    );
  }

  const getPaymentIcon = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes("efectivo") || m.includes("cash")) {
      return <LuBanknote className="text-success-600" size={18} />;
    }
    if (m.includes("tarjeta") || m.includes("card")) {
      return <LuCreditCard className="text-primary-600" size={18} />;
    }
    if (m.includes("qr") || m.includes("transfer")) {
      return <LuQrCode className="text-secondary-600" size={18} />;
    }
    return <LuWallet className="text-warning-600" size={18} />;
  };

  const getProgressColor = (method: string): "success" | "primary" | "secondary" | "warning" => {
    const m = method.toLowerCase();
    if (m.includes("efectivo") || m.includes("cash")) return "success";
    if (m.includes("tarjeta") || m.includes("card")) return "primary";
    if (m.includes("qr") || m.includes("transfer")) return "secondary";
    return "warning";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Panel 1: Métodos de Pago */}
      <Card className="border border-default-200 dark:border-default-100 shadow-sm rounded-2xl bg-background">
        <CardBody className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-success-100 text-success-600 dark:bg-success-950 dark:text-success-400">
                <LuBanknote size={16} />
              </span>
              <h3 className="text-base font-extrabold text-foreground">
                Métodos de Pago
              </h3>
            </div>
            <span className="text-xs text-default-400 font-medium">Participación</span>
          </div>

          <div className="flex flex-col gap-3.5">
            {paymentMethods.length === 0 ? (
              <p className="text-xs text-default-400 text-center py-6">
                No se registraron ventas en este periodo.
              </p>
            ) : (
              paymentMethods.map((pm, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-default-100">
                        {getPaymentIcon(pm.method)}
                      </div>
                      <span className="font-bold text-foreground capitalize">
                        {pm.label}
                      </span>
                      <span className="text-[11px] text-default-400">
                        ({pm.count} {pm.count === 1 ? 'pago' : 'pagos'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-foreground">
                        <PriceDisplay amount={pm.total} compact />
                      </span>
                      <Chip size="sm" variant="flat" color={getProgressColor(pm.method)} className="h-5 text-tiny font-bold">
                        {pm.percentage}%
                      </Chip>
                    </div>
                  </div>

                  <Progress
                    aria-label={pm.label}
                    size="sm"
                    value={pm.percentage}
                    color={getProgressColor(pm.method)}
                    className="h-2 rounded-full"
                  />
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      {/* Panel 2: Rendimiento por Sucursales */}
      <Card className="border border-default-200 dark:border-default-100 shadow-sm rounded-2xl bg-background">
        <CardBody className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                <LuStore size={16} />
              </span>
              <h3 className="text-base font-extrabold text-foreground">
                Rendimiento por Sucursal
              </h3>
            </div>
            <span className="text-xs text-default-400 font-medium">Cuota de Venta</span>
          </div>

          <div className="flex flex-col gap-3.5">
            {storesPerformance.length === 0 ? (
              <p className="text-xs text-default-400 text-center py-6">
                No hay sucursales registradas.
              </p>
            ) : (
              storesPerformance.map((st, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-primary-50 dark:bg-primary-950/40 text-primary">
                        <LuStore size={15} />
                      </div>
                      <span className="font-bold text-foreground">
                        {st.name}
                      </span>
                      <span className="text-[11px] text-default-400">
                        ({st.count} vts · Avg: <PriceDisplay amount={st.avg_ticket} compact />)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-foreground">
                        <PriceDisplay amount={st.total} compact />
                      </span>
                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-tiny font-bold">
                        {st.percentage}%
                      </Chip>
                    </div>
                  </div>

                  <Progress
                    aria-label={st.name}
                    size="sm"
                    value={st.percentage}
                    color="primary"
                    className="h-2 rounded-full"
                  />
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
