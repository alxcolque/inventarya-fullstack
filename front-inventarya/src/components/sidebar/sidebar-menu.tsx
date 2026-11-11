import React from "react";
import { useSidebarContext } from "@/context/layout-context";

interface Props {
  title: string;
  children?: React.ReactNode;
}

export const SidebarMenu = ({ title, children }: Props) => {
  const { isCompact } = useSidebarContext();

  return (
    <div className="flex flex-col gap-1.5">
      {!isCompact ? (
        <span className="text-[11px] font-bold text-default-400 uppercase tracking-wider px-3.5 pt-2 pb-0.5 select-none">
          {title}
        </span>
      ) : (
        <div className="w-7 h-[1px] bg-divider/80 mx-auto my-1" />
      )}
      <div className="flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
};

