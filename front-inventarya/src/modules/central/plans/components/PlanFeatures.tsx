import React from "react";
import { Switch, Divider } from "@nextui-org/react";
import { PLAN_FEATURES, PlanFeatureKey } from "../utils/plan.utils";
import { PlanFeatures as IPlanFeatures } from "../interfaces/plan.interface";

interface Props {
  features: IPlanFeatures;
  customDomain: boolean;
  multiStore: boolean;
  reports: boolean;
  onChangeFeature: (key: PlanFeatureKey, value: boolean) => void;
  onChangeCore: (field: "custom_domain" | "multi_store" | "reports", value: boolean) => void;
  disabled?: boolean;
}

/**
 * Clean UI for configuring features and core capabilities (Sections 13, 14, 15 of plans.md)
 */
export const PlanFeatures: React.FC<Props> = ({
  features,
  customDomain,
  multiStore,
  reports,
  onChangeFeature,
  onChangeCore,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Funcionalidades Especiales (Columnas directas del modelo) */}
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-bold text-default-800">Funcionalidades Especiales (Base)</h4>
          <p className="text-xs text-default-500">
            Capacidades arquitectónicas registradas directamente en el modelo de suscripción.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-divider bg-default-50/50 dark:bg-default-100/20">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-default-800">Dominio Personalizado</span>
              <span className="text-[11px] text-default-400">DNS propio</span>
            </div>
            <Switch
              size="sm"
              color="success"
              isDisabled={disabled}
              isSelected={customDomain}
              onValueChange={(val) => onChangeCore("custom_domain", val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-divider bg-default-50/50 dark:bg-default-100/20">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-default-800">Múltiples Tiendas</span>
              <span className="text-[11px] text-default-400">Multi-sucursal</span>
            </div>
            <Switch
              size="sm"
              color="success"
              isDisabled={disabled}
              isSelected={multiStore}
              onValueChange={(val) => onChangeCore("multi_store", val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-divider bg-default-50/50 dark:bg-default-100/20">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-default-800">Módulo Reportes</span>
              <span className="text-[11px] text-default-400">Estadísticas</span>
            </div>
            <Switch
              size="sm"
              color="success"
              isDisabled={disabled}
              isSelected={reports}
              onValueChange={(val) => onChangeCore("reports", val)}
            />
          </div>
        </div>
      </div>

      <Divider />

      {/* Funcionalidades Dinámicas (JSONB features) */}
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-bold text-default-800">Funcionalidades Dinámicas (features JSON)</h4>
          <p className="text-xs text-default-500">
            Módulos del sistema controlados mediante el objeto dinámico de características.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAN_FEATURES.map((item) => {
            const isEnabled = Boolean(features[item.key]);
            return (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 rounded-xl border border-divider hover:border-primary-300 transition-colors bg-default-50/30 dark:bg-default-100/10"
              >
                <div className="flex flex-col pr-3">
                  <span className="text-xs font-semibold text-default-800">{item.label}</span>
                  <span className="text-[11px] text-default-400 leading-tight">{item.description}</span>
                </div>
                <Switch
                  size="sm"
                  color="primary"
                  isDisabled={disabled}
                  isSelected={isEnabled}
                  onValueChange={(val) => onChangeFeature(item.key, val)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
