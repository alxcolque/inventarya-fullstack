import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import { useTenantFormStore } from "../store/tenantForm.store";
import { useTenantsStore } from "../store/tenants.store";
import { usePlansStore } from "../../plans/store/plans.store";
import { TenantCompanyStep } from "./TenantCompanyStep";
import { TenantDomainStep } from "./TenantDomainStep";
import { TenantPlanStep } from "./TenantPlanStep";
import { TenantOwnerStep } from "./TenantOwnerStep";
import { TenantReviewStep } from "./TenantReviewStep";
import { TenantActivationStatus } from "./TenantActivationStatus";
import { LuArrowLeft, LuArrowRight, LuRocket } from "react-icons/lu";
import { toast } from "sonner";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export const TenantWizard = ({ onSuccess, onCancel }: Props) => {
  const {
    currentStep,
    formData,
    stepValidation,
    nextStep,
    prevStep,
    resetForm,
  } = useTenantFormStore();

  const { createTenant, checkUnique } = useTenantsStore();
  const { plans } = usePlansStore();

  const [deploymentStatus, setDeploymentStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const stepsList = [
    { title: "Compañía", description: "Datos corporativos" },
    { title: "Enlace", description: "Dominio y Red" },
    { title: "Plan", description: "Características y Ciclo" },
    { title: "Propietario", description: "Cuenta y Contacto" },
    { title: "Revisión", description: "Despliegue y Pagos" },
  ];

  const selectedPlan = plans.find((p) => p.id === formData.subscription.plan_id);
  const isFree = selectedPlan ? Number(selectedPlan.price) === 0 : true;

  const handleDeploy = async () => {
    setDeploymentStatus("submitting");

    const fullOwnerPhone = (
      formData.owner.phone_country_code || formData.owner.phone_number
        ? `${formData.owner.phone_country_code || "+591"} ${formData.owner.phone_number || ""}`
        : formData.tenant.owner_phone || ""
    ).trim();

    // Construct the payload exactly as the backend expects
    const payload = {
      tenant: {
        name: formData.tenant.name,
        slug: formData.tenant.slug,
        database: formData.tenant.database,
        business_type_id: formData.tenant.business_type_id,
        owner_name: formData.owner.name,
        owner_email: formData.owner.email,
        owner_phone: fullOwnerPhone,
        data: formData.tenant.data,
      },
      domains: formData.domains.map((d) => ({
        domain: d.domain,
        type: d.type,
        is_primary: d.is_primary,
      })),
      subscription: {
        plan_id: formData.subscription.plan_id,
        billing_cycle: formData.subscription.billing_cycle,
      },
      owner: {
        name: formData.owner.name,
        email: formData.owner.email,
        password: formData.owner.password,
      },
    };

    const success = await createTenant(payload);

    if (success) {
      setDeploymentStatus("success");
      
      if (formData.tenant.data?.local_port) {
        localStorage.setItem(`inventarya_tenant_port_${formData.tenant.data.local_port}`, formData.tenant.slug);
      }
      localStorage.setItem('inventarya_active_tenant', formData.tenant.slug);

      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 2500);
    } else {
      setDeploymentStatus("error");
      setErrorMessage("No se pudo desplegar el tenant. Verifique la disponibilidad del slug o del dominio y vuelva a intentarlo.");
    }
  };

  const handleNextStep = async () => {
    // Step 0: Validate uniqueness of database and slug
    if (currentStep === 0) {
      setIsValidating(true);
      const dbToCheck = formData.tenant.database?.trim();
      const slugToCheck = formData.tenant.slug?.trim();

      if (dbToCheck) {
        const dbResult = await checkUnique("database", dbToCheck);
        if (!dbResult.available) {
          setIsValidating(false);
          toast.error("Base de datos no disponible", {
            description: dbResult.message || `La base de datos '${dbToCheck}' ya está registrada. Elige otro nombre.`,
          });
          return;
        }
      }

      if (slugToCheck) {
        const slugResult = await checkUnique("slug", slugToCheck);
        if (!slugResult.available) {
          setIsValidating(false);
          toast.error("Identificador no disponible", {
            description: slugResult.message || `El subdominio '${slugToCheck}' ya está registrado.`,
          });
          return;
        }
      }

      setIsValidating(false);
    }

    // Step 1: Validate uniqueness of domain
    if (currentStep === 1) {
      setIsValidating(true);
      const primaryDomain = formData.domains[0]?.domain?.trim();
      if (primaryDomain) {
        const domainResult = await checkUnique("domain", primaryDomain);
        if (!domainResult.available) {
          setIsValidating(false);
          toast.error("Dominio no disponible", {
            description: domainResult.message || `El dominio '${primaryDomain}' ya se encuentra registrado.`,
          });
          return;
        }
      }
      setIsValidating(false);
    }

    nextStep();
  };

  if (deploymentStatus !== "idle") {
    return (
      <TenantActivationStatus
        isFree={isFree}
        status={deploymentStatus === "submitting" ? "submitting" : deploymentStatus === "success" ? "success" : "error"}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1 min-h-[460px] justify-between">
      {/* Wizard Step Progress Headers */}
      <div className="flex justify-between items-center bg-default-100/50 p-8 rounded-2xl border border-default-200/50 overflow-x-auto gap-4">
        {stepsList.map((step, idx) => {
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;

          return (
            <div key={idx} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${isActive
                  ? "bg-primary text-primary-foreground scale-110 shadow-md ring-2 ring-primary/20"
                  : isDone
                    ? "bg-success text-success-foreground"
                    : "bg-default-200 text-default-600"
                  }`}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className={`text-xs font-bold leading-tight ${isActive ? "text-primary" : "text-default-700"}`}>
                  {step.title}
                </span>
                <span className="text-[10px] text-default-400 font-semibold uppercase leading-none">
                  {step.description}
                </span>
              </div>
              {idx < stepsList.length - 1 && (
                <div className="hidden lg:block w-4 h-0.5 bg-default-300 mx-2"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Wizard Steps Rendering */}
      <div className="my-4 py-2 px-1">
        {currentStep === 0 && <TenantCompanyStep />}
        {currentStep === 1 && <TenantDomainStep />}
        {currentStep === 2 && <TenantPlanStep />}
        {currentStep === 3 && <TenantOwnerStep />}
        {currentStep === 4 && <TenantReviewStep />}
      </div>

      {/* Footer Navigation Buttons */}
      <div className="flex justify-between items-center border-t border-divider pt-4 mt-2">
        <Button
          color="danger"
          variant="light"
          className="font-semibold"
          onPress={currentStep === 0 ? onCancel : prevStep}
          startContent={currentStep > 0 && <LuArrowLeft size={16} />}
        >
          {currentStep === 0 ? "Cancelar" : "Atrás"}
        </Button>

        {currentStep < stepsList.length - 1 ? (
          <Button
            color="primary"
            className="font-bold px-6"
            isDisabled={!stepValidation[currentStep] || isValidating}
            isLoading={isValidating}
            onPress={handleNextStep}
            endContent={!isValidating && <LuArrowRight size={16} />}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            color="success"
            className="font-bold px-8 text-white shadow-lg shadow-success-200/50 dark:shadow-none"
            onPress={handleDeploy}
            endContent={<LuRocket size={16} />}
          >
            Desplegar Tenant
          </Button>
        )}
      </div>
    </div>
  );
};
