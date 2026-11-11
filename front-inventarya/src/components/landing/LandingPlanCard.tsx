import React from "react";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip } from "@nextui-org/react";
import { LuCheck, LuX } from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa6";
import { ILandingPlan } from "@/interface/landing.interface";
import {
  formatPriceUsd,
  normalizeFeatures,
  PLAN_FEATURES,
} from "@/modules/central/plans/utils/plan.utils";

interface Props {
  plan: ILandingPlan;
  onContact: (plan: ILandingPlan) => void;
}

const formatLimit = (value: number | null | undefined, unlimitedAt: number) =>
  value == null || value >= unlimitedAt ? "Ilimitado" : value.toLocaleString();

export const LandingPlanCard: React.FC<Props> = ({ plan, onContact }) => {
  const features = normalizeFeatures(plan.features);

  const featureRows = [
    { key: "custom_domain", label: "Dominio personalizado", enabled: plan.custom_domain },
    { key: "multi_store", label: "Múltiples sucursales", enabled: plan.multi_store },
    { key: "reports", label: "Módulo de reportes", enabled: plan.reports },
    ...PLAN_FEATURES.map((feature) => ({
      key: feature.key,
      label: feature.label,
      enabled: Boolean(features[feature.key]),
    })),
  ];

  return (
    <Card className="p-2 shadow-none rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between border border-divider bg-content1">
      <div>
        <CardHeader className="flex flex-col items-start p-5 pb-2">
          <div className="flex justify-between items-center gap-3 w-full mb-1">
            <h3 className="text-lg font-black text-foreground uppercase">{plan.name}</h3>
            {plan.trial_days > 0 && (
              <Chip size="sm" color="primary" variant="flat" className="font-extrabold text-[10px] shrink-0">
                {plan.trial_days} días gratis
              </Chip>
            )}
          </div>

          {plan.description && (
            <p className="text-xs text-default-400 line-clamp-2 mt-1">{plan.description}</p>
          )}

          <div className="mt-3 w-full rounded-2xl bg-content2 border border-divider p-3">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-primary">{formatPriceUsd(plan.price)}</span>
              <span className="text-xs text-default-400 font-semibold">/ mes</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1 pt-2 border-t border-divider">
              <span className="text-xs font-bold text-default-600">{formatPriceUsd(plan.yearly_price)}</span>
              <span className="text-xs text-default-400">/ año</span>
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-5 pt-3">
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-content2 border border-divider text-center mb-4">
            <div>
              <p className="text-[10px] text-default-400 uppercase font-bold">Sucursales</p>
              <p className="text-xs font-black text-foreground">{formatLimit(plan.max_stores, 999)}</p>
            </div>
            <div className="border-x border-divider">
              <p className="text-[10px] text-default-400 uppercase font-bold">Usuarios</p>
              <p className="text-xs font-black text-foreground">{formatLimit(plan.max_users, 999)}</p>
            </div>
            <div>
              <p className="text-[10px] text-default-400 uppercase font-bold">Productos</p>
              <p className="text-xs font-black text-foreground">{formatLimit(plan.max_products, 99999)}</p>
            </div>
          </div>

          <p className="text-[11px] font-bold text-default-500 uppercase tracking-wider mb-2.5">
            Funcionalidades
          </p>
          <ul className="space-y-1.5 text-xs font-medium">
            {featureRows.map((feature) => (
              <li key={feature.key} className="flex items-center gap-2">
                {feature.enabled ? (
                  <LuCheck className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <LuX className="w-4 h-4 text-default-300 shrink-0" />
                )}
                <span className={feature.enabled ? "text-default-600" : "text-default-400 line-through"}>
                  {feature.label}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </div>

      <CardFooter className="p-5 pt-2">
        <Button
          fullWidth
          color="primary"
          className="font-bold text-xs py-5 rounded-2xl shadow-sm hover:scale-[1.01] transition-transform"
          startContent={<FaWhatsapp className="w-4 h-4" />}
          onPress={() => onContact(plan)}
        >
          Consultar por WhatsApp
        </Button>
      </CardFooter>
    </Card>
  );
};
