import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@nextui-org/react";
import { LuAlertTriangle } from "react-icons/lu";
import { IFaqItem } from "../interfaces/configuration.interface";
import { useCentralSettingsStore } from "../store/settings.store";

interface DeleteFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  faq?: IFaqItem | null;
}

export const DeleteFaqModal: React.FC<DeleteFaqModalProps> = ({ isOpen, onClose, faq }) => {
  const { deleteFaq } = useCentralSettingsStore();
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!faq) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteFaq(faq.id);
    setIsDeleting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        {(onCloseModal) => (
          <>
            <ModalHeader className="flex items-center gap-2 text-danger">
              <LuAlertTriangle className="w-5 h-5" />
              <span>Eliminar Pregunta Frecuente</span>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                ¿Estás seguro de que deseas eliminar permanentemente la pregunta:
              </p>
              <p className="font-semibold text-sm mt-1 p-2 rounded bg-default-100 border border-default-200">
                "{faq.question}"
              </p>
              <p className="text-xs text-danger mt-2">
                Esta acción no se puede deshacer y desaparecerá de la Landing Page.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onCloseModal} isDisabled={isDeleting}>
                Cancelar
              </Button>
              <Button color="danger" onPress={handleDelete} isLoading={isDeleting}>
                Sí, Eliminar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
