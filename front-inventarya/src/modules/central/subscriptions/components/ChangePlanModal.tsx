import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  RadioGroup,
  Radio,
  Divider,
} from "@nextui-org/react";
import { useSubscriptionsStore } from "../store/subscriptions.store";
import { usePlansStore } from "../../plans/store/plans.store";
import { ISubscription } from "../interfaces/subscription.interface";
import { LuArrowRightLeft } from "react-icons/lu";

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: ISubscription | null;
}

export const ChangePlanModal: React.FC<ChangePlanModalProps> = ({
  isOpen,
  onClose,
  subscription,
}) => {
  const { changePlan, isLoading } = useSubscriptionsStore();
  const { plans, getPlans } = usePlansStore();

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (isOpen) {
      if (plans.length === 0) getPlans();
      if (subscription) {
        setSelectedPlan(String(subscription.plan_id));
        setBillingCycle((subscription.billing_cycle as "monthly" | "yearly") || "monthly");
      }
    }
  }, [isOpen, subscription, plans.length, getPlans]);

  const activePlans = plans.filter((p) => p.status === "active");
  const targetPlan = plans.find((p) => String(p.id) === selectedPlan);

  const handleSubmit = async () => {
    if (!subscription || !selectedPlan) return;

    const success = await changePlan(subscription.id, Number(selectedPlan), billingCycle);
    if (success) {
      onClose();
    }
  };

  if (!subscription) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" placement="center">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-2">
              <div className="flex items-center gap-2 text-xl font-bold text-secondary">
                <LuArrowRightLeft className="text-secondary" />
                <span>Cambiar Plan de Suscripción</span>
              </div>
              <p className="text-xs text-default-500 font-normal">
                Cliente: <span className="font-semibold text-default-800">{subscription.tenant?.name}</span>
              </p>
            </ModalHeader>

            <ModalBody className="gap-4">
              {/* Current Plan info */}
              <div className="bg-default-50 p-3 rounded-lg border border-default-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-default-500">Plan Actual:</span>
                  <p className="font-bold text-sm text-default-800">{subscription.plan?.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-default-500">Precio actual:</span>
                  <p className="font-bold text-success text-sm">
                    ${subscription.price} / {subscription.billing_cycle === "monthly" ? "mes" : "año"}
                  </p>
                </div>
              </div>

              <Divider className="my-1" />

              {/* New Plan Selection */}
              <Select
                label="Nuevo Plan"
                placeholder="Selecciona el nuevo plan"
                selectedKeys={selectedPlan ? [selectedPlan] : []}
                onChange={(e) => setSelectedPlan(e.target.value)}
                isRequired
                variant="bordered"
              >
                {activePlans.map((p) => (
                  <SelectItem key={String(p.id)} textValue={`${p.name} - $${p.price}/mes`}>
                    <div className="flex justify-between items-center w-full">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-success font-bold">
                        ${p.price}/mes • ${p.yearly_price}/año
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </Select>

              {/* Billing Cycle Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-default-700">Ciclo de Facturación</label>
                <RadioGroup
                  orientation="horizontal"
                  value={billingCycle}
                  onValueChange={(val) => setBillingCycle(val as "monthly" | "yearly")}
                  className="gap-4"
                >
                  <Radio value="monthly">
                    <span className="text-sm">
                      Mensual {targetPlan ? `($${targetPlan.price})` : ""}
                    </span>
                  </Radio>
                  <Radio value="yearly">
                    <span className="text-sm">
                      Anual {targetPlan ? `($${targetPlan.yearly_price})` : ""}
                    </span>
                  </Radio>
                </RadioGroup>
              </div>

              {/* Limits preview */}
              {targetPlan && (
                <div className="bg-secondary-50/40 p-3 rounded-lg border border-secondary-200 text-xs flex flex-col gap-1">
                  <span className="font-bold text-secondary-800">Nuevos límites ({targetPlan.name}):</span>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-secondary-700">
                    <div>👤 {targetPlan.max_users === null ? "Ilimitados" : `${targetPlan.max_users} usuarios`}</div>
                    <div>🏪 {targetPlan.max_stores === null ? "Ilimitadas" : `${targetPlan.max_stores} tiendas`}</div>
                    <div>📦 {targetPlan.max_products === null ? "Ilimitados" : `${targetPlan.max_products} productos`}</div>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={isLoading}>
                Cancelar
              </Button>
              <Button
                color="secondary"
                onPress={handleSubmit}
                isLoading={isLoading}
                isDisabled={!selectedPlan || selectedPlan === String(subscription.plan_id)}
              >
                Actualizar Plan
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
