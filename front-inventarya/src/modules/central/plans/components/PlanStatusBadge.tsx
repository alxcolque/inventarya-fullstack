import React from "react";
import { Chip } from "@nextui-org/react";
import { PlanStatus } from "../interfaces/plan.interface";

interface Props {
  status: PlanStatus;
  onClick?: () => void;
  isClickable?: boolean;
}

/**
 * Visual badge for plan status with explicit text as required by Section 21 of plans.md
 */
export const PlanStatusBadge: React.FC<Props> = ({ status, onClick, isClickable = false }) => {
  const isActive = status === "active";

  return (
    <Chip
      size="sm"
      variant="flat"
      color={isActive ? "success" : "default"}
      onClick={isClickable ? onClick : undefined}
      className={`font-semibold uppercase tracking-wider text-[11px] ${
        isClickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
      }`}
      startContent={
        <span
          className={`inline-block w-2 h-2 rounded-full mx-1 ${
            isActive ? "bg-success-500 animate-pulse" : "bg-default-400"
          }`}
        />
      }
    >
      {isActive ? "ACTIVO" : "INACTIVO"}
    </Chip>
  );
};
