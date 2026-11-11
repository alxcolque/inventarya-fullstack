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
  Input,
  RadioGroup,
  Radio,
  Divider,
} from "@nextui-org/react";
import { useSubscriptionsStore } from "../store/subscriptions.store";
import { useTenantsStore } from "../../tenants/store/tenants.store";
import { usePlansStore } from "../../plans/store/plans.store";
import { LuSparkles, LuCreditCard, LuClock } from "react-icons/lu";

interface AssignPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTenantId?: string;
}

export const AssignPlanModal: React.FC<AssignPlanModalProps> = ({
  isOpen,
  onClose,
  defaultTenantId,
}) => {
  const { assignPlan, activateTrial, isLoading } = useSubscriptionsStore();
  const { tenants, getTenants } = useTenantsStore();
  const { plans, getPlans } = usePlansStore();

  const [selectedTenant, setSelectedTenant] = useState<string>(defaultTenantId || "");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [mode, setMode] = useState<"direct" | "trial">("direct");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [trialDays, setTrialDays] = useState<number>(14);

  useEffect(() => {
    if (isOpen) {
      if (tenants.length === 0) getTenants();
      if (plans.length === 0) getPlans();
      if (defaultTenantId) setSelectedTenant(defaultTenantId);
    }
  }, [isOpen, defaultTenantId, tenants.length, plans.length, getTenants, getPlans]);

  const activePlans = plans.filter((p) => p.status === "active");

  const handleSubmit = async () => {
    if (!selectedTenant || !selectedPlan) return;

    let success = false;
    if (mode === "direct") {
      success = await assignPlan(selectedTenant, Number(selectedPlan), billingCycle);
    } else {
      success = await activateTrial(selectedTenant, Number(selectedPlan), trialDays);
    }

    if (success) {
      onClose();
      setSelectedTenant("");
      setSelectedPlan("");
    }
  };

  const currentPlan = plans.find((p) => String(p.id) === selectedPlan);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" placement="center">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-2">
              <div className="flex items-center gap-2 text-xl font-bold text-secondary">
                <LuSparkles className="text-secondary" />
                <span>Asignar Plan o Período de Prueba</span>
              </div>
              <p className="text-xs text-default-500 font-normal">
                Configura la suscripción comercial para un tenant registrado.
              </p>
            </ModalHeader>

            <ModalBody className="gap-4">
              {/* Tenant Selection */}
              <Select
                label="Empresa / Tenant"
                placeholder="Selecciona un cliente"
                selectedKeys={selectedTenant ? [selectedTenant] : []}
                onChange={(e) => setSelectedTenant(e.target.value)}
                isRequired
                variant="bordered"
              >
                {tenants.map((t) => (
                  <SelectItem key={t.id} textValue={`${t.name} (${t.slug})`}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{t.name}</span>
                      <span className="text-tiny text-default-400">{t.domain || t.slug}</span>
                    </div>
                  </SelectItem>
                ))}
              </Select>

              {/* Mode Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-default-700">Tipo de Asignación</label>
                <RadioGroup
                  orientation="horizontal"
                  value={mode}
                  onValueChange={(val) => setMode(val as "direct" | "trial")}
                  className="gap-4"
                >
                  <Radio value="direct">
                    <div className="flex items-center gap-1.5 text-sm">
                      <LuCreditCard className="text-primary" />
                      <span>Plan Inmediato (Activo)</span>
                    </div>
                  </Radio>
                  <Radio value="trial">
                    <div className="flex items-center gap-1.5 text-sm">
                      <LuClock className="text-warning" />
                      <span>Período de Prueba (Trial)</span>
                    </div>
                  </Radio>
                </RadioGroup>
              </div>

              <Divider className="my-1" />

              {/* Plan Selection */}
              <Select
                label="Plan Comercial"
                placeholder="Selecciona el plan"
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

              {/* Direct options vs Trial options */}
              {mode === "direct" ? (
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
                        Mensual {currentPlan ? `($${currentPlan.price})` : ""}
                      </span>
                    </Radio>
                    <Radio value="yearly">
                      <span className="text-sm">
                        Anual {currentPlan ? `($${currentPlan.yearly_price})` : ""}
                      </span>
                    </Radio>
                  </RadioGroup>
                </div>
              ) : (
                <Input
                  type="number"
                  label="Días de Prueba"
                  placeholder="Ej: 14"
                  value={String(trialDays)}
                  onChange={(e) => setTrialDays(Math.max(1, Number(e.target.value)))}
                  description="Durante el trial, el tenant tendrá acceso completo a los límites de este plan."
                  min={1}
                  max={365}
                  variant="bordered"
                />
              )}

              {/* Plan Limits Preview */}
              {currentPlan && (
                <div className="bg-default-50 p-3 rounded-lg border border-default-200 text-xs flex flex-col gap-1">
                  <span className="font-bold text-default-700">Límites incluidos en {currentPlan.name}:</span>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-default-600">
                    <div>👤 {currentPlan.max_users === null ? "Ilimitados" : `${currentPlan.max_users} usuarios`}</div>
                    <div>🏪 {currentPlan.max_stores === null ? "Ilimitadas" : `${currentPlan.max_stores} tiendas`}</div>
                    <div>📦 {currentPlan.max_products === null ? "Ilimitados" : `${currentPlan.max_products} productos`}</div>
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
                isDisabled={!selectedTenant || !selectedPlan}
              >
                {mode === "direct" ? "Asignar Plan" : "Activar Prueba"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
