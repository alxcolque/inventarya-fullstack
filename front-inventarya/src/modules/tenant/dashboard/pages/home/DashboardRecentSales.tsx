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
import { LuReceipt, LuExternalLink, LuUser, LuClock } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { PriceDisplay } from "@/components";
import { RecentSaleItem } from "../../store/home/home.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";

interface Props {
  recentSales: RecentSaleItem[];
  isLoading: boolean;
}

export const DashboardRecentSales: React.FC<Props> = ({ recentSales, isLoading }) => {
  const navigate = useNavigate();
  const shops = useShopsStore((state) => state.shops);

  if (isLoading) {
    return (
      <Card className="border border-default-200 shadow-sm rounded-2xl p-5 min-h-[280px] animate-pulse bg-default-100" />
    );
  }

  const getStoreSlug = (storeId?: number | string) => {
    if (!storeId) return 'tienda';
    const found = shops.find((s) => String(s.id) === String(storeId));
    return found?.slug || `tienda-${storeId}`;
  };

  return (
    <Card className="border border-default-200 dark:border-default-100 shadow-sm rounded-2xl bg-background">
      <CardBody className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
              <LuReceipt size={16} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Últimas Transacciones Registradas
              </h3>
              <p className="text-xs text-default-400">
                Operaciones comerciales en vivo en las sucursales
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table
            aria-label="Tabla de ventas recientes"
            removeWrapper
            className="min-w-full"
          >
            <TableHeader>

              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                FECHA / HORA
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                CLIENTE & VENDEDOR
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                SUCURSAL
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                MÉTODO
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase text-right">
                TOTAL
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase text-center">
                ACCIONES
              </TableColumn>
            </TableHeader>
            <TableBody emptyContent="Aún no hay transacciones registradas.">
              {recentSales.map((sale) => (
                <TableRow key={sale.id} className="border-b border-default-100 last:border-none">


                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-default-500">
                      <LuClock size={12} className="text-default-400" />
                      <span>{sale.formatted_time}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">
                        {sale.customer_name}
                      </span>
                      <span className="text-[10px] text-default-400 flex items-center gap-1">
                        <LuUser size={10} /> {sale.seller_name}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Chip size="sm" variant="flat" className="h-5 text-tiny font-semibold">
                      {sale.store_name}
                    </Chip>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="primary"
                      className="capitalize h-5 text-tiny font-bold"
                    >
                      {sale.payment_method}
                    </Chip>
                  </TableCell>

                  <TableCell className="text-right font-black text-foreground text-xs">
                    <PriceDisplay amount={sale.total} compact />
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      isIconOnly
                      title="Ver Comprobante de Venta"
                      onPress={() => navigate(`/tienda/${getStoreSlug(sale.store_id)}/venta/${sale.id}`)}
                    >
                      <LuExternalLink size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardBody>
    </Card>
  );
};
