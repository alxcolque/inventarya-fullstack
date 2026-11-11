import React from "react";
import { Card, CardBody, Button } from "@nextui-org/react";
import { LuLock, LuArrowUpRight } from "react-icons/lu";

interface Props {
  title?: string;
  description?: string;
  onUpgradeClick?: () => void;
}

/**
 * Visual upgrade notice component complying with Section 30 & 31 of plans.md
 */
export const UpgradeNotice: React.FC<Props> = ({
  title = "🔒 Función incluida en planes superiores",
  description = "Esta funcionalidad no está incluida en tu plan actual. Actualiza tu suscripción para desbloquearla.",
  onUpgradeClick,
}) => {
  return (
    <Card className="border border-warning-200 dark:border-warning-900/40 bg-warning-50/50 dark:bg-warning-950/20 p-4 rounded-2xl shadow-sm my-4">
      <CardBody className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-2">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-warning-100 dark:bg-warning-900/50 text-warning-700 dark:text-warning-300 rounded-xl mt-0.5">
            <LuLock size={20} />
          </div>
          <div className="flex flex-col">
            <h4 className="font-bold text-sm text-default-900">{title}</h4>
            <p className="text-xs text-default-600 mt-0.5 max-w-xl">{description}</p>
          </div>
        </div>

        {onUpgradeClick && (
          <Button
            size="sm"
            color="warning"
            variant="solid"
            endContent={<LuArrowUpRight size={16} />}
            onPress={onUpgradeClick}
            className="font-bold text-warning-950 dark:text-warning-50 flex-shrink-0"
          >
            Ver planes
          </Button>
        )}
      </CardBody>
    </Card>
  );
};
