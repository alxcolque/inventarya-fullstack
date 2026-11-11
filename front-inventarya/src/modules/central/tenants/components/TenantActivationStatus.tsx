import React, { useEffect, useState } from "react";
import { Progress, Spinner } from "@nextui-org/react";
import { LuCheck, LuLoader, LuServerCrash } from "react-icons/lu";

interface Props {
  isFree: boolean;
  status: "submitting" | "success" | "error";
  errorMessage?: string;
}

export const TenantActivationStatus = ({ isFree, status, errorMessage }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);

  const freeSteps = [
    "Registrando información del Tenant en Base Central...",
    "Configurando los enlaces de dominios y subdominios...",
    "Creando la estructura de base de datos dedicada...",
    "Ejecutando migraciones del sistema de inventarios...",
    "Generando cuenta del Propietario y configuraciones...",
  ];

  const paidSteps = [
    "Registrando información del Tenant en Base Central...",
    "Configurando los enlaces de dominios y subdominios...",
    "Creando la estructura de base de datos dedicada...",
    "Ejecutando migraciones del sistema de inventarios...",
    "Generando cuenta del Propietario y configuraciones...",
    "Generando orden de pago inicial (Estado: Pendiente)...",
  ];

  const activeSteps = isFree ? freeSteps : paidSteps;

  // Fake progressive steps loading to simulate premium backend pipeline in frontend UX
  useEffect(() => {
    if (status === "submitting") {
      const interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < activeSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status, activeSteps.length]);

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-6 animate-in zoom-in-95 duration-400">
      {status === "submitting" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <Spinner size="lg" color="primary" />
          <div className="text-center flex flex-col gap-1">
            <h4 className="text-base font-bold text-default-800">
              Desplegando Infraestructura SaaS
            </h4>
            <p className="text-xs text-default-400">
              Por favor, no cierres esta ventana mientras configuramos tus servicios.
            </p>
          </div>

          <Progress
            aria-label="Progreso de despliegue"
            value={((currentStep + 1) / activeSteps.length) * 100}
            color="primary"
            className="w-full mt-2"
          />

          {/* Stepper Pipeline checklist */}
          <div className="flex flex-col gap-2.5 w-full mt-4 bg-default-50 border border-default-100 p-4 rounded-2xl">
            {activeSteps.map((stepName, idx) => {
              const isDone = idx < currentStep;
              const isActive = idx === currentStep;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 text-xs transition-all duration-300 ${
                    isDone
                      ? "text-success font-semibold"
                      : isActive
                      ? "text-primary font-bold animate-pulse"
                      : "text-default-400"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] ${
                      isDone
                        ? "border-success bg-success-50 text-success"
                        : isActive
                        ? "border-primary bg-primary-50 text-primary"
                        : "border-default-200"
                    }`}
                  >
                    {isDone ? <LuCheck size={10} /> : <span>{idx + 1}</span>}
                  </div>
                  <span>{stepName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3 text-center w-full max-w-md">
          <div className="w-12 h-12 rounded-full bg-danger-50 border border-danger/30 flex items-center justify-center text-danger mb-2">
            <LuServerCrash size={24} />
          </div>
          <h4 className="text-base font-bold text-danger">Fallo en el Aprovisionamiento</h4>
          <p className="text-xs text-default-500">
            {errorMessage || "Ocurrió un error inesperado al registrar el Tenant en la base central."}
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-3 text-center w-full max-w-md">
          <div className="w-12 h-12 rounded-full bg-success-50 border border-success/30 flex items-center justify-center text-success mb-2">
            <LuCheck size={24} className="animate-ping-once" />
          </div>
          <h4 className="text-base font-bold text-success">
            {isFree ? "¡Despliegue Exitoso!" : "¡Tenant Registrado con Éxito!"}
          </h4>
          <p className="text-xs text-default-500">
            {isFree
              ? "La base de datos, las migraciones y la cuenta del propietario se han aprovisionado correctamente."
              : "La base de datos y la cuenta se han aprovisionado correctamente. Podrás administrar tu negocio una vez confirmado el pago inicial."}
          </p>
        </div>
      )}
    </div>
  );
};
