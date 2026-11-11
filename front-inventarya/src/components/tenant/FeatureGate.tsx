import React, { ReactNode } from "react";
import { canFeature } from "@/utils/planFeatures";
import { UpgradeNotice } from "./UpgradeNotice";

interface Props {
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
  featureTitle?: string;
}

/**
 * Feature gate component protecting modules by active plan features (Section 29 of plans.md)
 */
export const FeatureGate: React.FC<Props> = ({
  feature,
  fallback,
  children,
  featureTitle,
}) => {
  const allowed = canFeature(feature);

  if (!allowed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <UpgradeNotice
        title={featureTitle ? `🔒 ${featureTitle} requiere un plan superior` : "Funcionalidad no disponible en tu plan actual"}
        description="Esta funcionalidad no está incluida en tu suscripción actual. Comunícate con el administrador para actualizar de plan."
      />
    );
  }

  return <>{children}</>;
};
