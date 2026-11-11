import React from "react";
import { Card, CardBody, CardFooter, Button, Tooltip, Divider } from "@nextui-org/react";
import { LuCheck, LuX, LuPencil, LuTrash2, LuPower } from "react-icons/lu";
import { IPlan } from "../interfaces/plan.interface";
import { formatPriceUsd, normalizeFeatures, PLAN_FEATURES } from "../utils/plan.utils";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { PlanLimits } from "./PlanLimits";

interface Props {
  plan: IPlan;
  onEdit: (plan: IPlan) => void;
  onToggleStatus: (plan: IPlan) => void;
  onDelete: (plan: IPlan) => void;
  isSaving?: boolean;
}

/**
 * Commercial Plan Card component matching Section 8 of plans.md
 */
export const PlanCard: React.FC<Props> = ({
  plan,
  onEdit,
  onToggleStatus,
  onDelete,
  isSaving = false,
}) => {
  const normFeatures = normalizeFeatures(plan.features);
  const isActive = plan.status === "active";

  return (
    <Card className="border border-divider shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full bg-content1 rounded-2xl overflow-hidden">
      <CardBody className="p-6 flex flex-col gap-5">
        {/* Card Header: Name + Badge */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="text-xl font-black tracking-tight uppercase text-default-900">
              {plan.name}
            </h3>
            <span className="text-xs text-default-400 font-mono">slug: {plan.slug}</span>
          </div>
          <PlanStatusBadge status={plan.status} />
        </div>

        {/* Pricing Block */}
        <div className="flex flex-col bg-default-50/70 dark:bg-default-100/20 p-4 rounded-xl border border-divider">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-primary-600 dark:text-primary-400 tracking-tight">
              {formatPriceUsd(plan.price)}
            </span>
            <span className="text-xs text-default-500 font-medium">/ mes</span>
          </div>

          <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-divider/60 text-xs text-default-600">
            <span className="font-semibold">{formatPriceUsd(plan.yearly_price)}</span>
            <span className="text-default-400">/ año</span>
            {plan.trial_days > 0 && (
              <span className="ml-auto text-[11px] bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold px-2 py-0.5 rounded-full">
                {plan.trial_days}d prueba
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {plan.description && (
          <p className="text-xs text-default-500 line-clamp-2 italic">
            "{plan.description}"
          </p>
        )}

        {/* Limits Block */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase font-bold tracking-wider text-default-400">
            Límites de Capacidad
          </span>
          <PlanLimits
            maxUsers={plan.max_users}
            maxStores={plan.max_stores}
            maxProducts={plan.max_products}
            compact
          />
        </div>

        <Divider />

        {/* Features Checklist */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase font-bold tracking-wider text-default-400">
            Funcionalidades
          </span>
          <div className="flex flex-col gap-1.5 text-xs">
            {/* Core Columns */}
            <div className="flex items-center gap-2">
              {plan.custom_domain ? (
                <LuCheck size={15} className="text-success font-bold flex-shrink-0" />
              ) : (
                <LuX size={15} className="text-default-300 flex-shrink-0" />
              )}
              <span className={plan.custom_domain ? "text-default-700 font-medium" : "text-default-400 line-through"}>
                Dominio personalizado
              </span>
            </div>

            <div className="flex items-center gap-2">
              {plan.multi_store ? (
                <LuCheck size={15} className="text-success font-bold flex-shrink-0" />
              ) : (
                <LuX size={15} className="text-default-300 flex-shrink-0" />
              )}
              <span className={plan.multi_store ? "text-default-700 font-medium" : "text-default-400 line-through"}>
                Múltiples sucursales
              </span>
            </div>

            <div className="flex items-center gap-2">
              {plan.reports ? (
                <LuCheck size={15} className="text-success font-bold flex-shrink-0" />
              ) : (
                <LuX size={15} className="text-default-300 flex-shrink-0" />
              )}
              <span className={plan.reports ? "text-default-700 font-medium" : "text-default-400 line-through"}>
                Módulo de reportes
              </span>
            </div>

            {/* Dynamic Features Catalog */}
            {PLAN_FEATURES.map((feat) => {
              const enabled = Boolean(normFeatures[feat.key]);
              return (
                <div key={feat.key} className="flex items-center gap-2">
                  {enabled ? (
                    <LuCheck size={15} className="text-success font-bold flex-shrink-0" />
                  ) : (
                    <LuX size={15} className="text-default-300 flex-shrink-0" />
                  )}
                  <span className={enabled ? "text-default-700 font-medium" : "text-default-400 line-through"}>
                    {feat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>

      {/* Card Actions Footer */}
      <CardFooter className="p-4 bg-default-50/50 dark:bg-default-100/10 border-t border-divider flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="flat"
          color="primary"
          startContent={<LuPencil size={14} />}
          onPress={() => onEdit(plan)}
          className="font-medium"
        >
          Editar
        </Button>

        <div className="flex items-center gap-1.5">
          <Tooltip content={isActive ? "Desactivar plan" : "Activar plan"}>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              color={isActive ? "warning" : "success"}
              onPress={() => onToggleStatus(plan)}
              isLoading={isSaving}
              aria-label={isActive ? "Desactivar plan" : "Activar plan"}
            >
              <LuPower size={15} />
            </Button>
          </Tooltip>

          <Tooltip color="danger" content="Eliminar plan">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              onPress={() => onDelete(plan)}
              aria-label="Eliminar plan"
            >
              <LuTrash2 size={15} />
            </Button>
          </Tooltip>
        </div>
      </CardFooter>
    </Card>
  );
};
