import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useSupplierStore } from "../../store/suppliers/suppliers.store";

export const ShowSuppliers = () => {
    const { id } = useParams();
    const token = useTenantAuthStore(state => state.token);
    const supplier = useSupplierStore(state => state.supplier);
    const getSupplier = useSupplierStore(state => state.getSupplier);

    const handleGetSupplier = () => {
        if (id && token) {
            getSupplier(Number(id), token);
        }
    }

    useEffect(() => {
        handleGetSupplier();
    }, []);

    return (
        <div className="my-2 px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
            <DynamicBreadcrumbs title={supplier?.name || "Detalle del Proveedor"} />
            <div className="flex flex-col">

                <div className="flex flex-wrap gap-2">
                    <h3 className="text-lg font-medium">Nombre: </h3>
                    <p>{supplier?.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <h3 className="text-lg font-medium">CI: </h3>
                    <p>{supplier?.cinit}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <h3 className="text-lg font-medium">Email: </h3>
                    <p>{supplier?.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <h3 className="text-lg font-medium">Dirección: </h3>
                    <p>{supplier?.address}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <h3 className="text-lg font-medium">Teléfono: </h3>
                    <p>{supplier?.phone}</p>
                </div>
            </div>

        </div>
    )
}
