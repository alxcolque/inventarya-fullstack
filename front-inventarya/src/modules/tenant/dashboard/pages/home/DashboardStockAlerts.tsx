import React from "react";
import { 
  Card, 
  CardBody, 
  Chip, 
  Button, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell 
} from "@nextui-org/react";
import { LuAlertTriangle, LuCheckCircle2, LuArrowRight, LuPackage } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { CompactNumber } from "@/components";
import { getImageUrl } from "@/utils/image";
import { CriticalAlertItem } from "../../store/home/home.store";

interface Props {
  alerts: CriticalAlertItem[];
  isLoading: boolean;
}

export const DashboardStockAlerts: React.FC<Props> = ({ alerts, isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="border border-default-200 shadow-sm rounded-2xl p-5 min-h-[260px] animate-pulse bg-default-100" />
    );
  }

  return (
    <Card className="border border-default-200 dark:border-default-100 shadow-sm rounded-2xl bg-background">
      <CardBody className="p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-danger-100 text-danger-600 dark:bg-danger-950 dark:text-danger-400">
              <LuAlertTriangle size={16} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                Alertas de Stock y Reposición
                {alerts.length > 0 && (
                  <Chip size="sm" color="danger" variant="flat" className="font-bold text-tiny h-5">
                    {alerts.length} en riesgo
                  </Chip>
                )}
              </h3>
              <p className="text-xs text-default-400">
                Productos con existencias agotadas o por debajo del umbral mínimo
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="flat"
            color="primary"
            endContent={<LuArrowRight size={14} />}
            onPress={() => navigate("/inventory")}
            className="font-bold text-xs"
          >
            Ir al Inventario
          </Button>
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-success-100 text-success-600 flex items-center justify-center">
              <LuCheckCircle2 size={24} />
            </div>
            <p className="text-sm font-bold text-foreground">Inventario en Nivel Óptimo</p>
            <p className="text-xs text-default-400 max-w-sm">
              Todos los productos en almacén y sucursales cuentan con existencias suficientes según sus umbrales mínimos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              aria-label="Tabla de alertas críticas de stock"
              removeWrapper
              className="min-w-[440px]"
            >
              <TableHeader>
                <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                  PRODUCTO
                </TableColumn>
                <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                  UBICACIÓN
                </TableColumn>
                <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase text-center">
                  STOCK / MÍNIMO
                </TableColumn>
                <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase text-center">
                  ESTADO
                </TableColumn>
              </TableHeader>
              <TableBody>
                {alerts.map((item, idx) => (
                  <TableRow key={idx} className="border-b border-default-100 last:border-none">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {item.image || item.thumbnail ? (
                          <img
                            src={getImageUrl(item.thumbnail || item.image || "")}
                            alt={item.product_name}
                            className="w-8 h-8 rounded-lg object-cover border border-default-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-default-100 flex items-center justify-center text-default-400">
                            <LuPackage size={14} />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground line-clamp-1">
                            {item.product_name}
                          </span>
                          <span className="text-[10px] text-default-400">
                            SKU: {item.sku}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={item.location_type === "warehouse" ? "secondary" : "default"}
                        className="text-tiny font-semibold h-5"
                      >
                        {item.location_name}
                      </Chip>
                    </TableCell>

                    <TableCell className="text-center font-bold text-xs">
                      <span className={item.stock_quantity <= 0 ? "text-danger-600 font-black" : "text-warning-600"}>
                        <CompactNumber value={item.stock_quantity} />
                      </span>
                      <span className="text-default-400 font-normal"> / <CompactNumber value={item.min_stock} /> mín</span>
                    </TableCell>

                    <TableCell className="text-center">
                      <Chip
                        size="sm"
                        variant="solid"
                        color={item.status === "out_of_stock" ? "danger" : "warning"}
                        className="text-tiny font-extrabold h-5"
                      >
                        {item.status === "out_of_stock" ? "Agotado" : "Stock Bajo"}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
