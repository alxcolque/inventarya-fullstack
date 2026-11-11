
import { useEffect, useState } from "react";
import { DynamicBreadcrumbs, DynamicTable, FormModal } from "@/components"
import { useNavigate } from "react-router-dom";

import { ISupplierResponse } from "@/interface";
import { AlertDelete } from "@/components/dialogs/alert-delete";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useSupplierStore } from "../../store/suppliers/suppliers.store";


export const IndexSuppliers = () => {
    const token = useTenantAuthStore(state => state.token);

    const [selectedRowData, setSelectedRowData] = useState<Record<string, any> | null>(null);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    /* Eliminando  */
    const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);
    const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
    /* suppliers */
    const suppliers = useSupplierStore(state => state.suppliers);
    const getSuppliers = useSupplierStore(state => state.getSuppliers);
    const createSupplier = useSupplierStore(state => state.createSupplier);
    const updateSupplier = useSupplierStore(state => state.updateSupplier);
    const deleteSupplier = useSupplierStore(state => state.deleteSupplier);

    const navigate = useNavigate();
    const handleFetchSuppliers = async () => {
        if (suppliers.length === 0) {
            await getSuppliers(token!);
        }
    }
    useEffect(() => {
        handleFetchSuppliers();

        if (deleteCountdown !== null && deleteCountdown > 0) {
            const timer = setTimeout(() => {
                setDeleteCountdown(deleteCountdown - 1);
            }, 1000);
            return () => clearTimeout(timer); // Limpia el temporizador
        } else if (deleteCountdown === 0) {
            handleConfirmDelete(); // Elimina permanentemente cuando llega a 0
        }
    }, [deleteCountdown]);



    const headers = [
        { name: 'ID', uid: 'id' },
        { name: 'NOMBRE', uid: 'name' },
        { name: 'CI', uid: 'cinit' },
        /* { name: 'EMAIL', uid: 'email' },
        { name: 'TELEFONO', uid: 'phone' },
        { name: 'DIECCION', uid: 'address' }, */
        { name: 'ACCIONES', uid: 'actions' }
    ];
    const fields = [
        { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Juan Perez' },
        { name: 'cinit', label: 'CI/NIT', type: 'text', placeholder: 'CI/NIT del Proveedor' },
        /* { name: 'email', label: 'Email', type: 'email', placeholder: 'user@mail.com' },
        { name: 'phone', label: 'Telefono', type: 'text', placeholder: 'Telefono del Proveedor' },
        { name: 'address', label: 'Direccion', type: 'text', placeholder: 'Direccion  del Proveedor' }, */
    ];
    const handleFormSubmit = async (formData: Record<string, any>) => {

        if (isEditing) {
            await updateSupplier(formData.id, formData as ISupplierResponse, token!);
        } else {
            await createSupplier(formData as ISupplierResponse, token!);
        }
        setIsModalOpen(false); // Cerrar el modal
        console.log(formData)
    };
    //Define controles para abrir el modal de agregar rol
    // Función para abrir el modal con datos vacíos (creación)
    const handleNewCategoryClick = () => {
        setSelectedRowData(null);  // Limpiar los datos
        setIsEditing(false);       // No estamos editando, estamos creando
        setIsModalOpen(true);      // Abrir el modal
    };
    // Función para abrir el modal con datos de un cliente seleccionado (edición)
    const handleEditClick = (rowData: Record<string, any>) => {
        //console.log(rowData);
        setSelectedRowData(rowData);  // Cargar datos del cliente seleccionado
        setIsEditing(true);           // Estamos en modo edición
        setIsModalOpen(true);         // Abrir el modal
    };
    /* Eliminando  */
    // Función para iniciar el contador de eliminación
    const handleDeleteClick = (id: number) => {
        //console.log(id);
        setDeleteRowId(id);
        setDeleteCountdown(10); // Inicia el temporizador de 10 segundos
    };

    // Función para cancelar la eliminación
    const handleCancelDelete = () => {
        setDeleteRowId(null);
        setDeleteCountdown(null); // Resetea el temporizador
    };

    // Función para realizar la eliminación definitiva
    const handleConfirmDelete = async () => {
        //setRows(rows.filter(row => row.id !== deleteRowId)); // Elimina el registro de los datos
        await deleteSupplier(deleteRowId!, token!); // Elimina el registro de la base de datos
        setDeleteRowId(null);
        setDeleteCountdown(null); // Resetea el temporizador
    };
    // Redirigir al hacer clic en "Ver"
    const handleViewClick = (id: number) => {
        navigate(`/suppliers/${id}`); // Redirigir a la página con el ID del usuario
    };
    return (
        <>
            <FormModal
                fields={fields}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleFormSubmit}
                initialValues={selectedRowData || {}}  // Pasar los valores seleccionados o vacío si es nuevo
            />
            <div className="my-2 px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
                <DynamicBreadcrumbs title="Proveedores" />
                <h2>Proveedor</h2>
                <DynamicTable stringSearch={'name'} onCreate={handleNewCategoryClick} data={suppliers} columns={headers} onEdit={handleEditClick} onDelete={handleDeleteClick} onView={handleViewClick} />
                {deleteRowId != null ? (
                    /* Una pequeña alerta fixed para eliminar con contador en la parte superior, tiene el boton cancelar la eliminacion */
                    <div className="fixed top-6 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
                        <AlertDelete
                            handleConfirmDelete={handleConfirmDelete}
                            handleCancelDelete={handleCancelDelete}
                            deleteCountdown={deleteCountdown}
                            message={'¿Estás seguro de querer eliminar el Proveedor?'}
                        />
                    </div>

                ) : ('')}

            </div>
        </>
    )
}
