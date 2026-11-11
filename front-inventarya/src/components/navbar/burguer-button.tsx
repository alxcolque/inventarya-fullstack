import React from "react";
import { useContext } from "react";
import { LayoutContext } from "@/context/layout-context";

/**
 * BurguerButton — Mobile sidebar toggle.
 * Safely checks if LayoutProvider exists before using it.
 * When rendered outside a LayoutProvider (e.g., PublicLayout), it is hidden.
 */
export const BurguerButton = () => {
  const context = useContext(LayoutContext);

  // If no LayoutProvider parent exists, render nothing on mobile.
  if (!context) return null;

  const { collapsed, setCollapsed } = context;

  return (
    <div
      className="flex flex-col gap-[4px] cursor-pointer md:hidden active:scale-95 transition-transform"
      onClick={() => setCollapsed(!collapsed)}
    >
      <div className={`w-6 h-[2px] bg-default-900 rounded-full transition-transform ${collapsed ? 'rotate-45 translate-y-[6px]' : ''}`} />
      <div className={`w-6 h-[2px] bg-default-900 rounded-full transition-opacity ${collapsed ? 'opacity-0' : ''}`} />
      <div className={`w-6 h-[2px] bg-default-900 rounded-full transition-transform ${collapsed ? '-rotate-45 -translate-y-[6px]' : ''}`} />
    </div>
  );
};
