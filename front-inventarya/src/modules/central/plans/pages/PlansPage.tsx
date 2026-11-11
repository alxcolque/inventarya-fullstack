import React, { useEffect, useState, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  Skeleton,
  ButtonGroup,
  useDisclosure,
} from "@nextui-org/react";
import {
  LuPlus,
  LuLayers,
  LuCheckCircle2,
  LuXCircle,
  LuLayoutGrid,
  LuColumns,
  LuInbox,
} from "react-icons/lu";
import { usePlansStore } from "../store/plans.store";
import { IPlan } from "../interfaces/plan.interface";
import { PlanCard } from "../components/PlanCard";
import { PlanComparison } from "../components/PlanComparison";
import { PlanModal } from "../components/PlanModal";
import { DeletePlanModal } from "../components/DeletePlanModal";
import { DeactivatePlanModal } from "../components/DeactivatePlanModal";
import { DynamicBreadcrumbs } from "@/components";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";

export const PlansPage: React.FC = () => {
  const { plans, getPlans, deletePlan, togglePlanStatus, isLoading, isSaving } = usePlansStore();
  const can = useCentralAuthStore((state) => state.can);
  const canManage = can("plans:manage");

  const [viewMode, setViewMode] = useState<"cards" | "comparison">("cards");

  // Create / Edit Modal
  const { isOpen: isFormOpen, onOpen: openForm, onClose: closeForm } = useDisclosure();
  const [selectedPlan, setSelectedPlan] = useState<IPlan | undefined>(undefined);

  // Delete Modal
  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
  const [planToDelete, setPlanToDelete] = useState<IPlan | undefined>(undefined);

  // Deactivate/Activate Modal
  const { isOpen: isToggleOpen, onOpen: openToggle, onClose: closeToggle } = useDisclosure();
  const [planToToggle, setPlanToToggle] = useState<IPlan | undefined>(undefined);

  useEffect(() => {
    getPlans();
  }, [getPlans]);

  // Summary Metrics (Section 7 of plans.md)
  const stats = useMemo(() => {
    const total = plans.length;
    const active = plans.filter((p) => p.status === "active").length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [plans]);

  const handleCreate = () => {
    setSelectedPlan(undefined);
    openForm();
  };

  const handleEdit = (plan: IPlan) => {
    setSelectedPlan(plan);
    openForm();
  };

  const handleDeleteClick = (plan: IPlan) => {
    setPlanToDelete(plan);
    openDelete();
  };

  const handleConfirmDelete = async () => {
    if (planToDelete?.id) {
      const res = await deletePlan(planToDelete.id);
      if (res.success) {
        closeDelete();
        setPlanToDelete(undefined);
      }
    }
  };

  const handleToggleClick = (plan: IPlan) => {
    setPlanToToggle(plan);
    openToggle();
  };

  const handleConfirmToggle = async () => {
    if (planToToggle?.id) {
      const success = await togglePlanStatus(planToToggle.id);
      if (success) {
        closeToggle();
        setPlanToToggle(undefined);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[95rem] mx-auto w-full pb-10">
      <DynamicBreadcrumbs title="Planes" />

      {/* Header Section (Section 6 of plans.md) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-default-900">Planes</h1>
          <p className="text-default-500 text-sm mt-0.5">
            Administra los planes comerciales disponibles para los tenants de Inventarya.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <ButtonGroup size="sm" variant="flat">
            <Button
              isIconOnly
              color={viewMode === "cards" ? "primary" : "default"}
              onPress={() => setViewMode("cards")}
              aria-label="Vista de tarjetas"
            >
              <LuLayoutGrid size={16} />
            </Button>
            <Button
              isIconOnly
              color={viewMode === "comparison" ? "primary" : "default"}
              onPress={() => setViewMode("comparison")}
              aria-label="Vista comparativa"
            >
              <LuColumns size={16} />
            </Button>
          </ButtonGroup>

          {canManage && (
            <Button
              color="primary"
              startContent={<LuPlus size={18} />}
              onPress={handleCreate}
              className="font-bold shadow-md shadow-primary-500/20"
            >
              Nuevo plan
            </Button>
          )}
        </div>
      </div>

      {/* Metric Summary Cards (Section 7 of plans.md) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-divider shadow-sm bg-content1 rounded-2xl">
          <CardBody className="p-4 flex flex-row items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">
              <LuLayers size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase font-bold text-default-400 tracking-wider">
                Total de planes
              </span>
              <span className="text-2xl font-black text-default-900">{stats.total}</span>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-divider shadow-sm bg-content1 rounded-2xl">
          <CardBody className="p-4 flex flex-row items-center gap-4">
            <div className="p-3 bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 rounded-xl">
              <LuCheckCircle2 size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase font-bold text-default-400 tracking-wider">
                Planes activos
              </span>
              <span className="text-2xl font-black text-success-600 dark:text-success-400">
                {stats.active}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-divider shadow-sm bg-content1 rounded-2xl">
          <CardBody className="p-4 flex flex-row items-center gap-4">
            <div className="p-3 bg-default-100 dark:bg-default-200/40 text-default-500 rounded-xl">
              <LuXCircle size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase font-bold text-default-400 tracking-wider">
                Planes inactivos
              </span>
              <span className="text-2xl font-black text-default-700">{stats.inactive}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Loading Skeletons (Section 22 of plans.md) */}
      {isLoading && plans.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 border border-divider h-[420px] rounded-2xl">
              <Skeleton className="h-6 w-3/5 rounded-lg mb-4" />
              <Skeleton className="h-16 w-full rounded-xl mb-6" />
              <Skeleton className="h-20 w-full rounded-xl mb-6" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded-lg" />
                <Skeleton className="h-4 w-4/5 rounded-lg" />
                <Skeleton className="h-4 w-3/4 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State (Section 24 of plans.md) */}
      {!isLoading && plans.length === 0 && (
        <Card className="border border-dashed border-divider p-12 text-center rounded-2xl bg-default-50/50">
          <CardBody className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
            <div className="p-4 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-full">
              <LuInbox size={32} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-default-900">No hay planes configurados</h3>
              <p className="text-xs text-default-500">
                Crea tu primer plan comercial para comenzar a ofrecer suscripciones a los tenants de Inventarya.
              </p>
            </div>
            {canManage && (
              <Button
                color="primary"
                startContent={<LuPlus size={16} />}
                onPress={handleCreate}
                className="font-bold mt-2"
              >
                Crear primer plan
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* Content views: Cards or Comparison Matrix */}
      {plans.length > 0 && (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id || plan.slug}
                  plan={plan}
                  onEdit={handleEdit}
                  onToggleStatus={handleToggleClick}
                  onDelete={handleDeleteClick}
                  isSaving={isSaving}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-default-500 px-1">
                Comparativa detallada de planes
              </h3>
              <PlanComparison plans={plans} />
            </div>
          )}
        </>
      )}

      {/* Form Modal (Create / Edit with Real-time Preview) */}
      <PlanModal
        isOpen={isFormOpen}
        onClose={closeForm}
        plan={selectedPlan}
      />

      {/* Deactivate / Activate Confirmation Modal (Section 20 of plans.md) */}
      <DeactivatePlanModal
        isOpen={isToggleOpen}
        onClose={closeToggle}
        onConfirm={handleConfirmToggle}
        plan={planToToggle}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Modal (Section 19 of plans.md) */}
      <DeletePlanModal
        isOpen={isDeleteOpen}
        onClose={closeDelete}
        onConfirmDelete={handleConfirmDelete}
        onDeactivateInstead={() => {
          if (planToDelete) {
            handleToggleClick(planToDelete);
          }
        }}
        plan={planToDelete}
        isLoading={isSaving}
      />
    </div>
  );
};
