import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DynamicBreadcrumbs, PriceDisplay } from "@/components";
import { Table, TableHeader, TableCell, TableBody, TableRow, TableColumn, User, Tooltip, Chip } from "@nextui-org/react";
import { FaEye } from "react-icons/fa6";
import { useOrdersStore } from "../../store/orders/orders.store";

export const IndexOrders = () => {
    const navigate = useNavigate();
    const sales = useOrdersStore((state) => state.sales);
    const getSales = useOrdersStore((state) => state.getSales);

    useEffect(() => {
        getSales();
    }, []);

    const columns = [
        { name: 'CLIENTE', uid: 'customer' },
        { name: 'TOTAL', uid: 'total' },
        { name: 'MÉTODO DE PAGO', uid: 'payment_method' },
        { name: 'FECHA', uid: 'created_at' },
        { name: 'ACCIONES', uid: 'actions' }
    ];

    return (
        <div className="my-2 px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
            <DynamicBreadcrumbs title="Pedidos y Ventas" />
            <h2 className="text-xl font-bold">Ventas / Pedidos</h2>
            <Table aria-label="Tabla de órdenes y ventas">
                <TableHeader columns={columns}>
                    {(column) => (
                        <TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
                            {column.name}
                        </TableColumn>
                    )}
                </TableHeader>
                <TableBody emptyContent="No hay ventas registradas" items={sales || []}>
                    {(sale: any) => (
                        <TableRow key={sale.id}>
                            <TableCell>
                                <User
                                    avatarProps={{ radius: "lg", src: `https://picsum.photos/200/300?random=${sale.id}` }}
                                    description={sale.customer?.email || sale.customer?.name || 'Cliente'}
                                    name={sale.customer?.name || `Venta #${sale.id}`}
                                >
                                    {sale.customer?.name || `Venta #${sale.id}`}
                                </User>
                            </TableCell>
                            <TableCell>
                                <span className="font-semibold text-emerald-600">
                                    <PriceDisplay amount={sale.total} />
                                </span>
                            </TableCell>
                            <TableCell>
                                <Chip className="capitalize" color={sale.payment_method === 'qr' ? 'secondary' : 'success'} size="sm" variant="flat">
                                    {sale.payment_method === 'qr' ? 'Pago QR' : 'Efectivo'}
                                </Chip>
                            </TableCell>
                            <TableCell>
                                <span className="text-default-500 text-sm">
                                    {sale.created_at ? new Date(sale.created_at).toLocaleDateString() : '-'}
                                </span>
                            </TableCell>
                            <TableCell>
                                <Tooltip color="primary" content="Ver detalle de venta">
                                    <span 
                                        className="text-lg text-primary cursor-pointer active:opacity-50"
                                        onClick={() => navigate(`/sales`)}
                                    >
                                        <FaEye />
                                    </span>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
