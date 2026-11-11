import React from "react";
import { Chip, Progress } from "@nextui-org/react";
import {
  LuBuilding,
  LuSliders,
  LuStore,
  LuKey,
  LuFileCheck,
  LuCheckCircle2,
  LuAlertCircle,
} from "react-icons/lu";
import { IListSettings } from "../interfaces/settings/list-response";

interface SiatOnboardingStepperProps {
  setting: IListSettings | null;
}

export const SiatOnboardingStepper: React.FC<SiatOnboardingStepperProps> = ({ setting }) => {
  const isStep1Done = Boolean(setting?.tax_nit && setting?.tax_business_name);
  const isStep2Done = Boolean(setting?.siat_modality && setting?.siat_environment);
  const isStep3Done = Boolean(setting?.electronic_invoicing_enabled);
  const isStep4Done = Boolean(setting?.siat_system_code && setting?.siat_token_configured);
  const isStep5Done = Number(setting?.siat_modality) === 2 || Boolean(setting?.siat_certificate_password_configured);
  const isStep6Done = isStep1Done && isStep2Done && isStep3Done && isStep4Done && isStep5Done;

  const steps = [
    {
      step: 1,
      title: "Datos Fiscales",
      desc: "NIT y Razón Social",
      icon: LuBuilding,
      completed: isStep1Done,
    },
    {
      step: 2,
      title: "Modalidad & Ambiente",
      desc: "Electrónica / Computarizada",
      icon: LuSliders,
      completed: isStep2Done,
    },
    {
      step: 3,
      title: "Sucursal / POS",
      desc: "Códigos SIN en Tiendas",
      icon: LuStore,
      completed: isStep3Done,
    },
    {
      step: 4,
      title: "Credenciales SIAT",
      desc: "Sistema y Token Delegado",
      icon: LuKey,
      completed: isStep4Done,
    },
    {
      step: 5,
      title: "Certificado Digital",
      desc: Number(setting?.siat_modality) === 2 ? "No requerido (M2)" : "Firma PKCS#12",
      icon: LuFileCheck,
      completed: isStep5Done,
    },
    {
      step: 6,
      title: "Verificación Local",
      desc: isStep6Done ? "Configuración Completa" : "Requisitos pendientes",
      icon: isStep6Done ? LuCheckCircle2 : LuAlertCircle,
      completed: isStep6Done,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="p-3.5 rounded-2xl bg-default-100/70 border border-default-200/60 dark:border-default-100/20 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            {completedCount}/{steps.length}
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">
              Guía de Configuración Fiscal SIAT (Fase Conceptual)
            </h4>
            <p className="text-[11px] text-default-400">
              Sigue los 6 pasos normativos para habilitar la facturación electrónica cuando dispongas de credenciales oficiales del SIN.
            </p>
          </div>
        </div>

        <Chip
          size="sm"
          variant="flat"
          color={isStep6Done ? "success" : "warning"}
          className="font-bold text-xs self-start sm:self-center"
        >
          {isStep6Done ? "Listo para Emisión" : `${progressPercent}% Completado`}
        </Chip>
      </div>

      <Progress
        size="sm"
        value={progressPercent}
        color={isStep6Done ? "success" : "primary"}
        className="max-w-full"
        aria-label="Progreso de configuración fiscal"
      />

      {/* Grid de Pasos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {steps.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.step}
              className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
                st.completed
                  ? "bg-success-500/10 border-success-500/30 text-success-800 dark:text-success-300"
                  : "bg-content1 border-default-200/70 text-default-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                  Paso {st.step}
                </span>
                <Icon size={14} className={st.completed ? "text-success-600 dark:text-success-400" : "text-default-400"} />
              </div>
              <span className="text-xs font-bold leading-tight line-clamp-1">{st.title}</span>
              <span className="text-[10px] text-default-400 line-clamp-1">{st.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
