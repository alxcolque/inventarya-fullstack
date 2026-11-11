import React from "react";
import { LuUsers, LuStore, LuPackage } from "react-icons/lu";

interface Props {
  maxUsers?: number | null;
  maxStores?: number | null;
  maxProducts?: number | null;
  compact?: boolean;
}

/**
 * Reusable limits display for plans (Section 12 of plans.md)
 */
export const PlanLimits: React.FC<Props> = ({
  maxUsers,
  maxStores,
  maxProducts,
  compact = false,
}) => {
  const formatLimit = (val?: number | null) => {
    if (val === null || val === undefined) return "Ilimitado";
    return val.toLocaleString();
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-1 text-xs text-default-600">
        <span className="flex items-center gap-1.5">
          <LuUsers size={14} className="text-primary-500 shrink-0" />
          {maxUsers != null ? (
            <span>Hasta <strong>{maxUsers.toLocaleString()}</strong> usuarios</span>
          ) : (
            <span>Usuarios <strong>Ilimitados</strong></span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <LuStore size={14} className="text-primary-500 shrink-0" />
          {maxStores != null ? (
            <span>Hasta <strong>{maxStores.toLocaleString()}</strong> tiendas</span>
          ) : (
            <span>Tiendas <strong>Ilimitadas</strong></span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <LuPackage size={14} className="text-primary-500 shrink-0" />
          {maxProducts != null ? (
            <span>Hasta <strong>{maxProducts.toLocaleString()}</strong> productos</span>
          ) : (
            <span>Productos <strong>Ilimitados</strong></span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 bg-default-50/80 dark:bg-default-100/30 p-3 rounded-xl border border-divider">
      <div className="flex flex-col items-center text-center">
        <LuUsers className="text-primary-500 mb-1" size={18} />
        <span className="text-[10px] uppercase font-bold text-default-400 tracking-wider">Usuarios</span>
        <span className="font-extrabold text-sm text-default-800">{formatLimit(maxUsers)}</span>
      </div>
      <div className="flex flex-col items-center text-center border-x border-divider px-1">
        <LuStore className="text-primary-500 mb-1" size={18} />
        <span className="text-[10px] uppercase font-bold text-default-400 tracking-wider">Tiendas</span>
        <span className="font-extrabold text-sm text-default-800">{formatLimit(maxStores)}</span>
      </div>
      <div className="flex flex-col items-center text-center">
        <LuPackage className="text-primary-500 mb-1" size={18} />
        <span className="text-[10px] uppercase font-bold text-default-400 tracking-wider">Productos</span>
        <span className="font-extrabold text-sm text-default-800">{formatLimit(maxProducts)}</span>
      </div>
    </div>
  );
};
