import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@nextui-org/react';
import { LuTrash2 } from 'react-icons/lu';
import { ICarousel } from '../interfaces/carousel.interface';
import { useCarouselStore } from '../store/carousel.store';

interface DeleteCarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  carousel: ICarousel | null;
}

export const DeleteCarouselModal: React.FC<DeleteCarouselModalProps> = ({
  isOpen,
  onClose,
  carousel,
}) => {
  const { deleteCarousel, isSaving } = useCarouselStore();

  const handleDelete = async () => {
    if (!carousel) return;
    const ok = await deleteCarousel(carousel.id);
    if (ok) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" placement="center">
      <ModalContent>
        {(onCloseModal) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-danger">
                <LuTrash2 className="w-5 h-5" />
                <span className="text-xl font-bold">Eliminar Slide</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-600">
                ¿Estás seguro de que deseas eliminar el slide{' '}
                <span className="font-semibold text-foreground">"{carousel?.title}"</span>?
              </p>
              <p className="text-xs text-default-400">
                Esta acción también eliminará la imagen asociada y no se puede deshacer.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onCloseModal} isDisabled={isSaving}>
                Cancelar
              </Button>
              <Button color="danger" onPress={handleDelete} isLoading={isSaving}>
                Eliminar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
