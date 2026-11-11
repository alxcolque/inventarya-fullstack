import React from "react";
import { LuGlobe, LuNetwork, LuLaptop } from "react-icons/lu";

interface Props {
  domain: string;
  type: "subdomain" | "custom";
  slug?: string;
  localPort?: number | string;
}

export const TenantDomainPreview = ({ domain, type, slug, localPort = 5174 }: Props) => {
  if (!domain) return null;

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-400">
      {/* Producción */}
      <div className="p-4 rounded-xl border border-default-200 bg-default-50/50 backdrop-blur-sm flex items-center gap-3">
        {type === "subdomain" ? (
          <LuNetwork className="text-primary animate-pulse" size={20} />
        ) : (
          <LuGlobe className="text-secondary animate-pulse" size={20} />
        )}
        <div className="flex flex-col">
          <span className="text-xs text-default-400 font-semibold tracking-wider uppercase">
            Producción (Dominio)
          </span>
          <span className="text-sm font-bold text-default-700">
            https://{domain}
          </span>
        </div>
      </div>

      {/* Local Development */}
      {import.meta.env.DEV && <div className="p-4 rounded-xl border border-primary-200/50 bg-primary-50/20 backdrop-blur-sm flex items-center gap-3">
        <LuLaptop className="text-primary" size={20} />
        <div className="flex flex-col">
          <span className="text-xs text-primary font-semibold tracking-wider uppercase">
            Desarrollo Local
          </span>
          <span className="text-sm font-bold text-default-700">
            http://localhost:{localPort}
          </span>
          {slug && (
            <span className="text-[11px] text-default-400">
              o http://{slug}.localhost:5173
            </span>
          )}
        </div>
      </div>}
    </div>
  );
};
