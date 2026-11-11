import React, { useEffect, useState } from "react";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Switch } from "@nextui-org/react";
import { usePlansStore } from "../../plans/store/plans.store";
import { useTenantFormStore } from "../store/tenantForm.store";
import { LuCheck, LuUsers, LuStore, LuPackage, LuShieldAlert } from "react-icons/lu";

import { PLAN_FEATURES, formatPriceUsd } from "../../plans/utils/plan.utils";

const getPlanFeatureLabels = (features: any): string[] => {
  if (!features) return [];
  let parsed = features;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (typeof item === "string") {
        const found = PLAN_FEATURES.find((f) => f.key === item);
        return found ? found.label : item.replace(/_/g, " ");
      }
      return String(item);
    });
  }

  if (typeof parsed === "object" && parsed !== null) {
    return Object.entries(parsed)
      .filter(([_, val]) => Boolean(val))
      .map(([key]) => {
        const found = PLAN_FEATURES.find((f) => f.key === key);
        return found ? found.label : key.replace(/_/g, " ");
      });
  }

  return [];
};

export const TenantPlanStep = () => {
  const { plans, getPlans } = usePlansStore();
  const { formData, updateSection, setStepValid } = useTenantFormStore();
  
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    formData.subscription.billing_cycle || 'monthly'
  );
  
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    formData.subscription.plan_id
  );

  useEffect(() => {
    getPlans();
  }, [getPlans]);

  // Auto-select default/starter plan if none is chosen yet
  useEffect(() => {
    if (plans.length > 0 && selectedPlanId === null) {
      const defaultPlan = plans.find(p => p.slug === "starter" || Number(p.price) === 0) || plans[0];
      if (defaultPlan?.id) {
        const initialPrice = billingCycle === 'yearly' ? Number(defaultPlan.yearly_price) : Number(defaultPlan.price);
        selectPlan(defaultPlan.id, initialPrice);
      }
    }
  }, [plans, selectedPlanId, billingCycle]);

  // Handle plan selection
  const selectPlan = (planId: number, price: number) => {
    setSelectedPlanId(planId);
    setStepValid(2, true);
    
    // Sync with store
    updateSection("subscription", {
      plan_id: planId,
      billing_cycle: billingCycle,
      price: price,
      status: price === 0 ? "active" : "pending",
    });

    updateSection("payment", {
      amount: price,
      billing_cycle: billingCycle,
      currency: "BOB",
      status: price === 0 ? "paid" : "pending",
    });
  };

  // Sync when billing cycle changes
  const toggleBillingCycle = (isYearly: boolean) => {
    const nextCycle = isYearly ? 'yearly' : 'monthly';
    setBillingCycle(nextCycle);
    
    if (selectedPlanId) {
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
        const nextPrice = nextCycle === 'yearly' ? Number(selectedPlan.yearly_price) : Number(selectedPlan.price);
        selectPlan(selectedPlanId, nextPrice);
      }
    }
  };

  // Check if step is valid on load
  useEffect(() => {
    setStepValid(2, selectedPlanId !== null);
  }, [selectedPlanId, setStepValid]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-default-800">Selecciona tu Plan</h3>
          <p className="text-sm text-default-500">
            Compara características y elige la opción que mejor se adapte al tamaño de tu empresa.
          </p>
        </div>

        {/* Monthly / Yearly Switcher */}
        <div className="flex items-center gap-3 self-center md:self-auto bg-default-100 p-1.5 rounded-full border border-default-200">
          <span className={`text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-all duration-300 ${billingCycle === 'monthly' ? 'bg-background shadow text-primary' : 'text-default-500'}`} onClick={() => toggleBillingCycle(false)}>
            Mensual
          </span>
          <span className={`text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-all duration-300 ${billingCycle === 'yearly' ? 'bg-background shadow text-primary' : 'text-default-500'}`} onClick={() => toggleBillingCycle(true)}>
            Anual <Chip size="sm" color="success" variant="flat" className="ml-1 text-[10px]">Ahorra ~20%</Chip>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isStarter = plan.slug === "starter" || Number(plan.price) === 0;
          const price = billingCycle === 'yearly' ? Number(plan.yearly_price) : Number(plan.price);
          const formattedPrice = isStarter ? "Gratis" : formatPriceUsd(price);
          const featureLabels = getPlanFeatureLabels(plan.features);

          return (
            <Card
              key={plan.id}
              className={`border-2 transition-all duration-300 flex flex-col justify-between ${
                isSelected
                  ? "border-primary bg-primary-50/10 dark:bg-primary-950/10 scale-102 shadow-lg ring-1 ring-primary/30"
                  : "border-default-200 hover:border-default-400 hover:scale-101"
              }`}
            >
              <CardHeader className="flex flex-col gap-1.5 items-start p-6">
                {plan.slug === "business" && (
                  <Chip color="primary" size="sm" className="mb-1 font-bold text-[10px] uppercase">
                    Más Recomendado
                  </Chip>
                )}
                <div className="flex justify-between items-center w-full">
                  <h4 className="text-xl font-extrabold text-default-800">{plan.name}</h4>
                  {isStarter && <Chip size="sm" color="default" variant="flat" className="font-bold">Starter</Chip>}
                </div>
                <p className="text-xs text-default-400 min-h-[32px]">{plan.description}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-default-800">{formattedPrice}</span>
                  {!isStarter && (
                    <span className="text-xs font-semibold text-default-500">
                      / {billingCycle === 'yearly' ? 'año' : 'mes'}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardBody className="px-6 py-2 flex flex-col gap-4">
                {/* Infrastructure Limits */}
                <div className="p-3 bg-default-100/50 rounded-xl flex flex-col gap-2.5 border border-default-200/50">
                  <div className="flex justify-between items-center text-xs text-default-600 font-medium">
                    <span className="flex items-center gap-1.5"><LuUsers size={14}/> Usuarios Max:</span>
                    <span className="font-extrabold text-default-800">
                      {plan.max_users === 9999 ? "Ilimitados" : plan.max_users}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-default-600 font-medium">
                    <span className="flex items-center gap-1.5"><LuStore size={14}/> Sucursales Max:</span>
                    <span className="font-extrabold text-default-800">
                      {plan.max_stores === 999 ? "Ilimitadas" : plan.max_stores}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-default-600 font-medium">
                    <span className="flex items-center gap-1.5"><LuPackage size={14}/> Productos Max:</span>
                    <span className="font-extrabold text-default-800">
                      {plan.max_products === 999999 ? "Ilimitados" : plan.max_products}
                    </span>
                  </div>
                </div>

                {/* Features List */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[11px] font-bold text-default-400 tracking-wider uppercase">
                    Características Incluidas
                  </span>
                  {featureLabels.length > 0 ? (
                    featureLabels.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-default-600">
                        <LuCheck size={14} className="text-success mt-0.5 flex-shrink-0" />
                        <span className="capitalize">{feat}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-default-400 italic">Funcionalidades esenciales incluidas</span>
                  )}
                </div>
              </CardBody>

              <CardFooter className="p-6">
                <Button
                  fullWidth
                  color={isSelected ? "primary" : "default"}
                  variant={isSelected ? "solid" : "bordered"}
                  className="font-bold py-5"
                  onPress={() => selectPlan(plan.id!, price)}
                >
                  {isSelected ? "Plan Seleccionado" : "Elegir Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
