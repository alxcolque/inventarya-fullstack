import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@nextui-org/react";
import { LuAlertTriangle, LuPower } from "react-icons/lu";
import { IPlan } from "../interfaces/plan.interface";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  onDeactivateInstead?: () => void;
  plan?: IPlan;
  isLoading?: boolean;
}

/**
 * Delete confirmation modal complying with Section 19 of plans.md
 */
export const DeletePlanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  onDeactivateInstead,
  plan,
  isLoading = false,
}) => {
  if (!plan) return null;

  const hasTenants = (plan.tenants_count ?? 0) > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" backdrop="blur">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-2 text-danger">
              <LuAlertTriangle size={22} />
              <span className="font-bold text-lg">¿Eliminar Plan {plan.name}?</span>
            </ModalHeader>

            <ModalBody className="py-2">
              {hasTenants ? (
                <div className="flex flex-col gap-3 bg-danger-50 dark:bg-danger-900/20 p-4 rounded-xl border border-danger-200 dark:border-danger-800 text-xs text-danger-700 dark:text-danger-300">
                  <p className="font-bold">
                    ⚠️ Este plan está siendo utilizado por {plan.tenants_count} cliente(s) y no puede eliminarse.
                  </p>
                  <p>
                    Para evitar suspender el servicio de tus clientes existentes, desactiva el plan. Así los clientes actuales seguirán funcionando pero nuevos usuarios no podrán elegirlo.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 text-sm text-default-600">
                  <p>
                    ¿Estás seguro de que deseas eliminar permanentemente el plan <strong>{plan.name}</strong>?
                  </p>
                  <p className="text-xs text-default-400">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex justify-between items-center gap-2">
              <Button variant="light" onPress={onClose} isDisabled={isLoading}>
                Cancelar
              </Button>

              <div className="flex items-center gap-2">
                {hasTenants && onDeactivateInstead && (
                  <Button
                    color="warning"
                    variant="flat"
                    startContent={<LuPower size={16} />}
                    onPress={() => {
                      onClose();
                      onDeactivateInstead();
                    }}
                  >
                    Desactivar en su lugar
                  </Button>
                )}

                <Button
                  color="danger"
                  onPress={onConfirmDelete}
                  isLoading={isLoading}
                  isDisabled={hasTenants}
                  className="font-semibold"
                >
                  Eliminar permanentemente
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
