import React, { useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useForm } from "react-hook-form";
import { ITenant } from "@/interface";
import { useTenantsStore } from "../store/tenants.store";
import { usePlansStore } from "../../plans/store/plans.store";
import { LuBuilding, LuDatabase, LuGlobe, LuMail, LuPhone, LuMapPin, LuCalendar, LuRocket } from "react-icons/lu";
import { TenantWizard } from "./TenantWizard";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenant?: ITenant;
}

export const TenantModal = ({ isOpen, onClose, tenant }: Props) => {
  const { createTenant, updateTenant, isLoading } = useTenantsStore();
  const { plans, getPlans } = usePlansStore();
  
  const { 
    register, 
    handleSubmit, 
    reset, 
    setValue, 
    watch, 
    formState: { errors, isValid } 
  } = useForm<Partial<ITenant>>({
    mode: "onChange",
    defaultValues: {
      id: "",
      name: "",
      slug: "",
      database: "",
      domain: "",
      email: "",
      phone: "",
      address: "",
      plan_id: undefined,
      status: "trial",
      trial_ends_at: "",
    },
  });

  useEffect(() => {
    getPlans();
  }, [getPlans]);

  useEffect(() => {
    if (tenant && isOpen) {
      reset({
        ...tenant,
        plan_id: tenant.plan_id || undefined,
        trial_ends_at: tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toISOString().split('T')[0] : "",
      });
    } else if (isOpen) {
      reset({
        id: "",
        name: "",
        slug: "",
        database: "",
        domain: "",
        email: "",
        phone: "",
        address: "",
        plan_id: undefined,
        status: "trial",
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
  }, [tenant, reset, isOpen]);

  const onSubmit = async (data: Partial<ITenant>) => {
    let success = false;
    if (tenant) {
      const { id, ...payload } = data;
      success = await updateTenant(tenant.id, payload);
    } else {
      success = await createTenant(data);
    }
    if (success) onClose();
  };

  const name = watch("name");
  useEffect(() => {
    if (name && !tenant) {
      const generatedSlug = name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      setValue("slug", generatedSlug, { shouldValidate: true });
      setValue("id", generatedSlug, { shouldValidate: true });
      setValue("database", `tenant_${generatedSlug.replace(/-/g, '_')}`, { shouldValidate: true });
      setValue("domain", `${generatedSlug}.inventarya.com`, { shouldValidate: true });
    }
  }, [name, setValue, tenant]);

  if (!tenant) {
    return (
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        size="4xl" 
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <LuRocket className="text-primary animate-pulse" />
              <span className="text-xl font-bold">Registro de Nuevo Tenant</span>
            </div>
          </ModalHeader>
          <ModalBody className="pb-6">
            <TenantWizard onSuccess={onClose} onCancel={onClose} />
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="3xl" 
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <LuRocket className="text-primary" />
                <span className="text-xl font-bold">{tenant ? "Configuración de Tenant" : "Registro de Nuevo Tenant"}</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <Tabs aria-label="Opciones de registro" color="primary" variant="underlined" fullWidth>
                <Tab
                  key="general"
                  title={
                    <div className="flex items-center space-x-2">
                      <LuBuilding size={16}/>
                      <span>General</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 pb-4">
                    <Input
                      isRequired
                      label="Nombre Comercial"
                      placeholder="Ej: Ferretería Central"
                      labelPlacement="outside"
                      {...register("name", { required: "El nombre comercial es obligatorio" })}
                      isInvalid={!!errors.name}
                      errorMessage={errors.name?.message}
                    />
                    <Input
                      isRequired
                      label="Subdominio"
                      placeholder="ej: ferreteria-central"
                      labelPlacement="outside"
                      isDisabled={!!tenant}
                      endContent={<span className="text-default-400 font-semibold text-xs">.inventarya.com</span>}
                      description={`Acceso: https://${watch("id") || "mi-tienda"}.inventarya.com`}
                      {...register("id", { required: "El subdominio es obligatorio" })}
                      isInvalid={!!errors.id}
                      errorMessage={errors.id?.message}
                    />
                  </div>
                </Tab>

                <Tab
                  key="technical"
                  title={
                    <div className="flex items-center space-x-2">
                      <LuDatabase size={16}/>
                      <span>Técnico</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 pb-4">
                    <Input
                      isRequired
                      label="Base de Datos"
                      placeholder="ej: tenant_db"
                      labelPlacement="outside"
                      description="Solo minúsculas (sin acentos ni ñ), números y guión bajo (_)."
                      startContent={<LuDatabase size={16}/>}
                      {...register("database", { 
                        required: "La base de datos es obligatoria",
                        pattern: {
                          value: /^[a-z0-9_]+$/,
                          message: "Formato no válido. Solo se permiten minúsculas, números y guiones bajos (_), sin acentos ni espacios."
                        }
                      })}
                      isInvalid={!!errors.database}
                      errorMessage={errors.database?.message}
                    />
                    <Input
                      isRequired
                      label="Dominio Principal"
                      placeholder="ej: mitienda.inventarya.com"
                      labelPlacement="outside"
                      startContent={<LuGlobe size={16}/>}
                      {...register("domain", { required: "El dominio es obligatorio" })}
                      isInvalid={!!errors.domain}
                      errorMessage={errors.domain?.message}
                    />
                    <Select
                      isRequired
                      label="Estado Inicial"
                      labelPlacement="outside"
                      defaultSelectedKeys={[tenant?.status || "trial"]}
                      {...register("status", { required: true })}
                    >
                      <SelectItem key="trial" value="trial">Trial</SelectItem>
                      <SelectItem key="active" value="active">Activo</SelectItem>
                      <SelectItem key="suspended" value="suspended">Suspendido</SelectItem>
                    </Select>
                  </div>
                </Tab>

                <Tab
                  key="plan"
                  title={
                    <div className="flex items-center space-x-2">
                      <LuCalendar size={16}/>
                      <span>Suscripción</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 pb-4">
                    <Select
                      isRequired
                      label="Plan SaaS"
                      labelPlacement="outside"
                      placeholder="Selecciona un plan"
                      defaultSelectedKeys={tenant?.plan_id ? [tenant.plan_id.toString()] : []}
                      {...register("plan_id", { required: "Debes seleccionar un plan" })}
                      isInvalid={!!errors.plan_id}
                      errorMessage={errors.plan_id?.message}
                    >
                      {plans.map((plan) => (
                        <SelectItem key={plan.id!.toString()} value={plan.id}>
                          {plan.name} - ${plan.price}/mes
                        </SelectItem>
                      ))}
                    </Select>
                    <Input
                      label="Fin de Trial"
                      type="date"
                      labelPlacement="outside"
                      startContent={<LuCalendar size={16}/>}
                      {...register("trial_ends_at")}
                    />
                  </div>
                </Tab>

                <Tab
                  key="contact"
                  title={
                    <div className="flex items-center space-x-2">
                      <LuMail size={16}/>
                      <span>Contacto</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 pb-4">
                    <Input
                      label="Email"
                      placeholder="user@mail.com"
                      type="email"
                      labelPlacement="outside"
                      startContent={<LuMail size={16}/>}
                      {...register("email", { 
                        pattern: { value: /^\S+@\S+$/i, message: "Email inválido" } 
                      })}
                      isInvalid={!!errors.email}
                      errorMessage={errors.email?.message}
                    />
                    <Input
                      label="Teléfono"
                      labelPlacement="outside"
                      startContent={<LuPhone size={16}/>}
                      {...register("phone")}
                    />
                    <div className="md:col-span-2">
                      <Textarea
                        label="Dirección"
                        labelPlacement="outside"
                        placeholder="Ubicación física"
                        startContent={<LuMapPin size={16} className="mt-1"/>}
                        {...register("address")}
                      />
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancelar
              </Button>
              <Button 
                color="primary" 
                type="submit" 
                isLoading={isLoading}
                isDisabled={!isValid}
              >
                {tenant ? "Actualizar" : "Desplegar Tenant"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
