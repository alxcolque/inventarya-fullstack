import React, { useState } from "react";
import { 
  Card, 
  CardBody, 
  Input, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Avatar,
  Chip
} from "@nextui-org/react";
import { LuSearch, LuAward, LuPackage } from "react-icons/lu";
import { PriceDisplay, CompactNumber } from "@/components";
import { getImageUrl } from "@/utils/image";
import { TopProductItem } from "../../store/home/home.store";

interface Props {
  topProducts: TopProductItem[];
  isLoading: boolean;
}

export const DashboardTopProducts: React.FC<Props> = ({ topProducts, isLoading }) => {
  const [filterText, setFilterText] = useState("");

  if (isLoading) {
    return (
      <Card className="border border-default-200 shadow-sm rounded-2xl p-5 min-h-[300px] animate-pulse bg-default-100" />
    );
  }

  const filtered = topProducts.filter((p) =>
    p.name.toLowerCase().includes(filterText.toLowerCase()) ||
    p.sku.toLowerCase().includes(filterText.toLowerCase()) ||
    p.category.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <Card className="border border-default-200 dark:border-default-100 shadow-sm rounded-2xl bg-background">
      <CardBody className="p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-warning-100 text-warning-600 dark:bg-warning-950 dark:text-warning-400">
              <LuAward size={16} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Productos Más Vendidos
              </h3>
              <p className="text-xs text-default-400">
                Líderes de demanda y recaudación en el periodo
              </p>
            </div>
          </div>

          <Input
            size="sm"
            placeholder="Filtrar producto..."
            value={filterText}
            onValueChange={setFilterText}
            startContent={<LuSearch size={14} className="text-default-400" />}
            isClearable
            className="w-full sm:w-56"
          />
        </div>

        <div className="overflow-x-auto">
          <Table
            aria-label="Tabla de productos más vendidos"
            removeWrapper
            className="min-w-[420px]"
          >
            <TableHeader>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase">
                PRODUCTO
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase text-center">
                CANT. VENDIDA
              </TableColumn>
              <TableColumn className="bg-default-100 text-[11px] font-bold text-default-600 uppercase text-right">
                RECAUDACIÓN
              </TableColumn>
            </TableHeader>
            <TableBody emptyContent="No hay productos vendidos en este periodo.">
              {filtered.map((item, idx) => (
                <TableRow key={item.product_id} className="border-b border-default-100 last:border-none">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-default-400 w-4">
                        #{idx + 1}
                      </span>
                      {item.image || item.thumbnail ? (
                        <img
                          src={getImageUrl(item.thumbnail || item.image || "")}
                          alt={item.name}
                          className="w-9 h-9 rounded-lg object-cover border border-default-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-default-100 flex items-center justify-center text-default-400">
                          <LuPackage size={16} />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground line-clamp-1">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-default-400">
                          <span>SKU: {item.sku}</span>
                          <span>•</span>
                          <Chip size="sm" variant="flat" className="h-4 text-[9px] px-1 capitalize">
                            {item.category}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Chip size="sm" variant="solid" color="primary" className="font-extrabold text-xs h-6 px-2">
                      <CompactNumber value={item.quantity_sold} suffix=" unid." />
                    </Chip>
                  </TableCell>

                  <TableCell className="text-right font-extrabold text-foreground text-xs">
                    <PriceDisplay amount={item.revenue} compact />
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
