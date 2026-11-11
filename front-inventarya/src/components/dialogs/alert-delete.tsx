import { Button } from "@nextui-org/react";

interface AlertDeleteProps {
    handleConfirmDelete: () => void;
    handleCancelDelete: () => void;
    deleteCountdown: number | null;
    message: string;
}

export const AlertDelete = ({ handleConfirmDelete, handleCancelDelete, deleteCountdown, message }: AlertDeleteProps) => {

    return (
        /* Una pequeña alerta fixed para eliminar con contador en la parte superior, tiene el boton cancelar la eliminacion */
        <div className="fixed right-0 left-0 top-6 z-50 gap-2 p-2 text-center text-white bg-yellow-500">
        <p>{message}</p>
        <div className="flex gap-2 justify-center">
            <Button color="danger" onPress={handleConfirmDelete}>Sí, eliminar</Button>
            <Button color="primary" onPress={handleCancelDelete}>Cancelar</Button>
        </div>
        <p>Se eliminará en {deleteCountdown} segundos</p>
    </div>
    )
}
