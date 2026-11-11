import React from "react";
import { Card, CardBody, Button, Divider } from "@nextui-org/react";
import { LuCheck, LuX, LuSparkles } from "react-icons/lu";
import { IPlan } from "../interfaces/plan.interface";
import { formatPriceUsd, normalizeFeatures, PLAN_FEATURES } from "../utils/plan.utils";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { PlanLimits } from "./PlanLimits";

interface Props {
  formData: Partial<IPlan>;
}

/**
 * Real-time live preview component as specified in Section 25 of plans.md
 */
export const PlanPreview: React.FC<Props> = ({ formData }) => {
  const normFeatures = normalizeFeatures(formData.features);

  const name = formData.name || "Nombre del Plan";
  const price = formData.price || 0;
  const yearlyPrice = formData.yearly_price || 0;
  const maxUsers = formData.max_users || 1;
  const maxStores = formData.max_stores || 1;
  const maxProducts = formData.max_products || 100;
  const trialDays = formData.trial_days || 0;
  const description = formData.description || "Descripción del plan para atraer nuevos negocios.";
  const status = formData.status || "active";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-default-400">
        <LuSparkles className="text-primary-500" size={14} />
        <span>Vista previa en vivo</span>
      </div>

      <Card className="border-2 border-primary-200 dark:border-primary-800 shadow-md bg-content1 rounded-2xl overflow-hidden sticky top-4">
        <div className="bg-primary px-4 py-1 text-center text-white text-[11px] font-bold tracking-widest uppercase">
          Previsualización Comercial
        </div>

        <CardBody className="p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black tracking-tight uppercase text-default-900">
                {name}
              </h3>
              <span className="text-[11px] text-default-400 font-mono">
                slug: {formData.slug || "auto-generado"}
              </span>
            </div>
            <PlanStatusBadge status={status} />
          </div>

          <div className="flex flex-col bg-default-50 dark:bg-default-100/30 p-3 rounded-xl border border-divider">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-primary-600 dark:text-primary-400">
                {formatPriceUsd(price)}
              </span>
              <span className="text-xs text-default-500 font-medium">/ mes</span>
            </div>

            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-divider/60 text-xs text-default-600">
              <span className="font-semibold">{formatPriceUsd(yearlyPrice)}</span>
              <span className="text-default-400">/ año</span>
              {trialDays > 0 && (
                <span className="ml-auto text-[10px] bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-bold px-2 py-0.5 rounded-full">
                  {trialDays}d prueba
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-default-500 italic">
            "{description}"
          </p>

          <PlanLimits
            maxUsers={maxUsers}
            maxStores={maxStores}
            maxProducts={maxProducts}
            compact
          />

          <Divider />

          <div className="flex flex-col gap-1.5 text-xs">
            {formData.custom_domain && (
              <div className="flex items-center gap-1.5 text-default-700 font-medium">
                <LuCheck size={14} className="text-success font-bold" />
                <span>Dominio personalizado</span>
              </div>
            )}
            {formData.multi_store && (
              <div className="flex items-center gap-1.5 text-default-700 font-medium">
                <LuCheck size={14} className="text-success font-bold" />
                <span>Múltiples tiendas</span>
              </div>
            )}
            {formData.reports && (
              <div className="flex items-center gap-1.5 text-default-700 font-medium">
                <LuCheck size={14} className="text-success font-bold" />
                <span>Módulo de reportes</span>
              </div>
            )}

            {PLAN_FEATURES.map((feat) => {
              if (!normFeatures[feat.key]) return null;
              return (
                <div key={feat.key} className="flex items-center gap-1.5 text-default-700 font-medium">
                  <LuCheck size={14} className="text-success font-bold" />
                  <span>{feat.label}</span>
                </div>
              );
            })}
          </div>

          <Button
            color="primary"
            className="w-full font-bold mt-2"
            size="sm"
            isDisabled
          >
            {trialDays > 0 ? `Comenzar prueba (${trialDays} días)` : "Suscribirse"}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
};
