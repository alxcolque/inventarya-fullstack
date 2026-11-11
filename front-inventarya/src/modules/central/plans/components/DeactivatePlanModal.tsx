import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@nextui-org/react";
import { LuPower, LuCheckCircle2 } from "react-icons/lu";
import { IPlan } from "../interfaces/plan.interface";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  plan?: IPlan;
  isLoading?: boolean;
}

/**
 * Confirmation modal for activating or deactivating a plan (Section 20 of plans.md)
 */
export const DeactivatePlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  plan,
  isLoading = false,
}) => {
  if (!plan) return null;

  const isCurrentlyActive = plan.status === "active";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" backdrop="blur">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2">
              {isCurrentlyActive ? (
                <LuPower className="text-warning-500" size={22} />
              ) : (
                <LuCheckCircle2 className="text-success-500" size={22} />
              )}
              <span className="font-bold text-lg">
                {isCurrentlyActive ? `¿Desactivar plan ${plan.name}?` : `¿Activar plan ${plan.name}?`}
              </span>
            </ModalHeader>

            <ModalBody className="py-2">
              {isCurrentlyActive ? (
                <div className="flex flex-col gap-2 text-sm text-default-600">
                  <p>
                    Los nuevos clientes <strong>no podrán seleccionar</strong> este plan al registrarse.
                  </p>
                  <p className="text-xs text-default-400 bg-warning-50 dark:bg-warning-900/20 p-3 rounded-lg border border-warning-200 dark:border-warning-800">
                    ℹ️ Los tenants que actualmente utilizan este plan seguirán funcionando con normalidad y no serán afectados.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 text-sm text-default-600">
                  <p>
                    El plan volverá a estar <strong>disponible de inmediato</strong> para nuevas suscripciones y registros comerciales.
                  </p>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex justify-end gap-2">
              <Button variant="light" onPress={onClose} isDisabled={isLoading}>
                Cancelar
              </Button>
              <Button
                color={isCurrentlyActive ? "warning" : "success"}
                onPress={onConfirm}
                isLoading={isLoading}
                className="font-semibold"
              >
                {isCurrentlyActive ? "Desactivar plan" : "Activar plan"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
