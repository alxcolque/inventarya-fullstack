import React from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { IPlan } from "../interfaces/plan.interface";
import { formatPriceUsd, normalizeFeatures, PLAN_FEATURES } from "../utils/plan.utils";
import { PlanStatusBadge } from "./PlanStatusBadge";

interface Props {
  plans: IPlan[];
}

/**
 * Visual matrix comparison table across all plans (Section 9 of plans.md)
 */
export const PlanComparison: React.FC<Props> = ({ plans }) => {
  if (plans.length === 0) {
    return null;
  }

  // Rows to compare
  const rows = [
    { label: "Precio mensual", render: (p: IPlan) => formatPriceUsd(p.price) },
    { label: "Precio anual", render: (p: IPlan) => formatPriceUsd(p.yearly_price) },
    { label: "Días de prueba", render: (p: IPlan) => `${p.trial_days} días` },
    { label: "Estado", render: (p: IPlan) => <PlanStatusBadge status={p.status} /> },

    // Límites
    { label: "Usuarios permitidos", render: (p: IPlan) => p.max_users != null ? p.max_users.toLocaleString() : "Ilimitado" },
    { label: "Tiendas / Sucursales", render: (p: IPlan) => p.max_stores != null ? p.max_stores.toLocaleString() : "Ilimitado" },
    { label: "Catálogo de Productos", render: (p: IPlan) => p.max_products != null ? p.max_products.toLocaleString() : "Ilimitado" },

    // Funcionalidades Especiales
    { 
      label: "Dominio personalizado", 
      render: (p: IPlan) => p.custom_domain 
        ? <LuCheck size={18} className="text-success font-bold" /> 
        : <LuX size={18} className="text-default-300" /> 
    },
    { 
      label: "Múltiples sucursales", 
      render: (p: IPlan) => p.multi_store 
        ? <LuCheck size={18} className="text-success font-bold" /> 
        : <LuX size={18} className="text-default-300" /> 
    },
    { 
      label: "Módulo de reportes", 
      render: (p: IPlan) => p.reports 
        ? <LuCheck size={18} className="text-success font-bold" /> 
        : <LuX size={18} className="text-default-300" /> 
    },

    // Funcionalidades Dinámicas
    ...PLAN_FEATURES.map((feat) => ({
      label: feat.label,
      render: (p: IPlan) => {
        const norm = normalizeFeatures(p.features);
        return norm[feat.key]
          ? <LuCheck size={18} className="text-success font-bold" />
          : <LuX size={18} className="text-default-300" />;
      }
    }))
  ];

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-divider shadow-sm bg-content1">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-default-100/70 border-b border-divider">
            <th className="py-4 px-6 text-xs font-black uppercase tracking-wider text-default-700 w-64 min-w-[200px]">
              CARACTERÍSTICA
            </th>
            {plans.map((plan) => (
              <th
                key={plan.id || plan.slug}
                className="py-4 px-6 text-center text-sm font-black uppercase tracking-wider text-default-900 min-w-[160px]"
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-divider/50">
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={`hover:bg-default-100/40 transition-colors ${
                idx % 2 === 0 ? "bg-default-50/30 dark:bg-default-100/10" : ""
              }`}
            >
              <td className="py-3 px-6 text-xs font-medium text-default-700">
                {row.label}
              </td>
              {plans.map((plan) => (
                <td
                  key={plan.id || plan.slug}
                  className="py-3 px-6 text-center text-xs font-semibold text-default-800"
                >
                  <div className="flex justify-center items-center">
                    {row.render(plan)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
