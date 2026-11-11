import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Tabs,
  Tab,
  Select,
  SelectItem,
} from "@nextui-org/react";
import { useForm, Controller } from "react-hook-form";
import { IPlan, PlanFeatures as IPlanFeatures } from "../interfaces/plan.interface";
import { usePlansStore } from "../store/plans.store";
import { PlanPreview } from "./PlanPreview";
import { PlanFeatures } from "./PlanFeatures";
import { normalizeFeatures } from "../utils/plan.utils";
import { LuInfo, LuDollarSign, LuGauge, LuLayers } from "react-icons/lu";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan?: IPlan;
}

export const PlanModal: React.FC<Props> = ({ isOpen, onClose, plan }) => {
  const { createPlan, updatePlan, isSaving } = usePlansStore();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<IPlan>({
    defaultValues: {
      name: "",
      slug: "",
      price: 0,
      yearly_price: 0,
      max_users: 1,
      max_stores: 1,
      max_products: 1000,
      features: {
        inventory: true,
        stock_alerts: true,
        transfers: false,
        advanced_reports: false,
        api: false,
        barcode: true,
        notifications: true,
      },
      custom_domain: false,
      multi_store: false,
      reports: true,
      trial_days: 7,
      status: "active",
      description: "",
    },
  });

  const [featuresState, setFeaturesState] = useState<IPlanFeatures>({});

  useEffect(() => {
    if (plan && isOpen) {
      const normalized = normalizeFeatures(plan.features);
      setFeaturesState(normalized);
      reset({
        ...plan,
        features: normalized,
        description: plan.description || "",
      });
    } else if (isOpen) {
      const defaultFeats = {
        inventory: true,
        stock_alerts: true,
        transfers: false,
        advanced_reports: false,
        api: false,
        barcode: true,
        notifications: true,
      };
      setFeaturesState(defaultFeats);
      reset({
        name: "",
        slug: "",
        price: 0,
        yearly_price: 0,
        max_users: 1,
        max_stores: 1,
        max_products: 1000,
        features: defaultFeats,
        custom_domain: false,
        multi_store: false,
        reports: true,
        trial_days: 7,
        status: "active",
        description: "",
      });
    }
  }, [plan, reset, isOpen]);

  // Real-time watched form data for live preview
  const watchedValues = watch();

  // Auto-generate slug from name when creating
  const name = watch("name");
  useEffect(() => {
    if (name && !plan) {
      const generatedSlug = name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");
      setValue("slug", generatedSlug, { shouldValidate: true });
    }
  }, [name, setValue, plan]);

  const handleFeatureToggle = (key: string, value: boolean) => {
    const updated = { ...featuresState, [key]: value };
    setFeaturesState(updated);
    setValue("features", updated);
  };

  const handleCoreToggle = (field: "custom_domain" | "multi_store" | "reports", value: boolean) => {
    setValue(field, value);
  };

  const onSubmit = async (data: IPlan) => {
    const payload: Partial<IPlan> = {
      ...data,
      features: featuresState,
    };

    let success = false;
    if (plan?.id) {
      success = await updatePlan(plan.id, payload);
    } else {
      success = await createPlan(payload);
    }

    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      backdrop="blur"
      classNames={{
        base: "w-[calc(100vw-1rem)] sm:w-full max-w-5xl max-h-[92dvh] m-2 sm:m-4 overflow-hidden",
        header: "border-b border-divider shrink-0",
        body: "overflow-y-auto overflow-x-hidden",
        footer: "border-t border-divider bg-default-50/50 dark:bg-default-100/10 shrink-0",
      }}
    >
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
            <ModalHeader className="flex flex-col gap-1 py-4">
              <h2 className="text-xl font-black text-default-900">
                {plan ? `Editar Plan: ${plan.name}` : "Crear Nuevo Plan Comercial"}
              </h2>
              <p className="text-xs text-default-500 font-normal">
                Configura los precios en USD, límites de capacidad y funcionalidades incluidas.
              </p>
            </ModalHeader>

            <ModalBody className="py-4 sm:py-6 px-3 sm:px-6 min-w-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 min-w-0">
                {/* Form column */}
                <div className="lg:col-span-7 flex flex-col gap-4 min-w-0 overflow-hidden">
                  <Tabs
                    aria-label="Secciones del plan"
                    color="primary"
                    variant="underlined"
                    className="min-w-0 w-full"
                    classNames={{
                      tabList: "w-full overflow-x-auto justify-start gap-2",
                      tab: "flex-shrink-0 px-2 sm:px-3",
                      panel: "px-0 min-w-0 overflow-x-hidden",
                    }}
                  >
                    {/* 1. Información General */}
                    <Tab
                      key="general"
                      title={
                        <div className="flex items-center gap-1.5">
                          <LuInfo size={16} />
                          <span>Información</span>
                        </div>
                      }
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                        <Input
                          label="Nombre del Plan"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="Ej: Profesional"
                          {...register("name", { required: "El nombre es obligatorio" })}
                          isInvalid={!!errors.name}
                          errorMessage={errors.name?.message}
                        />

                        <Input
                          label="Slug (URL única)"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="profesional"
                          {...register("slug", { required: "El slug es obligatorio" })}
                          isInvalid={!!errors.slug}
                          errorMessage={errors.slug?.message}
                        />

                        <div className="sm:col-span-2">
                          <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                              <Select
                                label="Estado del Plan"
                                variant="bordered"
                                labelPlacement="outside"
                                selectedKeys={[field.value]}
                                onSelectionChange={(keys) => field.onChange(Array.from(keys)[0])}
                              >
                                <SelectItem key="active" value="active">
                                  Activo (Disponible para suscripción)
                                </SelectItem>
                                <SelectItem key="inactive" value="inactive">
                                  Inactivo (Oculto para nuevos registros)
                                </SelectItem>
                              </Select>
                            )}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Textarea
                            label="Descripción comercial"
                            variant="bordered"
                            labelPlacement="outside"
                            placeholder="Breve descripción del valor de este plan..."
                            rows={3}
                            {...register("description")}
                          />
                        </div>
                      </div>
                    </Tab>

                    {/* 2. Precios */}
                    <Tab
                      key="pricing"
                      title={
                        <div className="flex items-center gap-1.5">
                          <LuDollarSign size={16} />
                          <span>Precios</span>
                        </div>
                      }
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                        <Input
                          type="number"
                          step="0.01"
                          label="Precio Mensual (USD)"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="199.00"
                          startContent={<span className="text-default-400 text-xs font-bold">$</span>}
                          {...register("price", {
                            valueAsNumber: true,
                            min: { value: 0, message: "El precio no puede ser negativo" },
                          })}
                        />

                        <Input
                          type="number"
                          step="0.01"
                          label="Precio Anual (USD)"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="1990.00"
                          startContent={<span className="text-default-400 text-xs font-bold">$</span>}
                          {...register("yearly_price", {
                            valueAsNumber: true,
                            min: { value: 0, message: "El precio no puede ser negativo" },
                          })}
                        />

                        <div className="sm:col-span-2">
                          <Input
                            type="number"
                            label="Días de Prueba Gratuita"
                            variant="bordered"
                            labelPlacement="outside"
                            placeholder="7"
                            endContent={<span className="text-default-400 text-xs font-medium">días</span>}
                            {...register("trial_days", {
                              valueAsNumber: true,
                              min: { value: 0, message: "No puede ser negativo" },
                            })}
                          />
                        </div>
                      </div>
                    </Tab>

                    {/* 3. Límites */}
                    <Tab
                      key="limits"
                      title={
                        <div className="flex items-center gap-1.5">
                          <LuGauge size={16} />
                          <span>Límites</span>
                        </div>
                      }
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
                        <Input
                          type="number"
                          label="Máx. Usuarios"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="5"
                          {...register("max_users", {
                            valueAsNumber: true,
                            min: { value: 1, message: "Mínimo 1 usuario" },
                          })}
                        />

                        <Input
                          type="number"
                          label="Máx. Tiendas"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="1"
                          {...register("max_stores", {
                            valueAsNumber: true,
                            min: { value: 1, message: "Mínimo 1 tienda" },
                          })}
                        />

                        <Input
                          type="number"
                          label="Máx. Productos"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="1000"
                          {...register("max_products", {
                            valueAsNumber: true,
                            min: { value: 1, message: "Mínimo 1 producto" },
                          })}
                        />
                      </div>
                    </Tab>

                    {/* 4. Funcionalidades */}
                    <Tab
                      key="features"
                      title={
                        <div className="flex items-center gap-1.5">
                          <LuLayers size={16} />
                          <span>Funcionalidades</span>
                        </div>
                      }
                    >
                      <div className="pt-3">
                        <PlanFeatures
                          features={featuresState}
                          customDomain={watch("custom_domain")}
                          multiStore={watch("multi_store")}
                          reports={watch("reports")}
                          onChangeFeature={handleFeatureToggle}
                          onChangeCore={handleCoreToggle}
                          disabled={isSaving}
                        />
                      </div>
                    </Tab>
                  </Tabs>
                </div>

                {/* Preview column */}
                <div className="lg:col-span-5 min-w-0">
                  <PlanPreview formData={{ ...watchedValues, features: featuresState }} />
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 py-3 px-3 sm:px-6">
              <Button color="danger" variant="light" onPress={onClose} isDisabled={isSaving}>
                Cancelar
              </Button>

              <Button
                color="primary"
                type="submit"
                isLoading={isSaving}
                className="w-full sm:w-auto px-8 font-bold"
              >
                {plan ? "Guardar Cambios" : "Crear Plan"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
