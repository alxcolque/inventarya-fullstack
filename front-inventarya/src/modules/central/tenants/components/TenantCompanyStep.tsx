import React, { useEffect } from "react";
import { Input } from "@nextui-org/react";
import { useForm } from "react-hook-form";
import { useTenantFormStore } from "../store/tenantForm.store";
import { useTenantsStore } from "../store/tenants.store";
import { LuBuilding, LuDatabase } from "react-icons/lu";

export const TenantCompanyStep = () => {
  const { formData, updateSection, setStepValid } = useTenantFormStore();
  const { tenants } = useTenantsStore();

  const {
    register,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      name: formData.tenant.name,
      slug: formData.tenant.slug,
      database: formData.tenant.database,
    },
  });

  const nameValue = watch("name");
  const slugValue = watch("slug");
  const databaseValue = watch("database");

  // Validate database uniqueness locally against known tenants
  const validateDatabaseUniqueness = (val: string) => {
    if (!val) return true;
    const cleanVal = val.toLowerCase().trim();
    const exists = tenants.some(
      (t) =>
        t.database?.toLowerCase() === cleanVal ||
        t.database?.toLowerCase() === `tenant_${cleanVal}` ||
        t.id?.toLowerCase() === cleanVal
    );
    if (exists) {
      return `La base de datos '${cleanVal}' ya está registrada.`;
    }
    return true;
  };

  // Auto-generate slug from commercial name
  useEffect(() => {
    if (nameValue) {
      const cleanSlug = nameValue
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      setValue("slug", cleanSlug, { shouldValidate: true });
    } else {
      setValue("slug", "");
    }
  }, [nameValue, setValue]);

  // Sync with store and validate step
  useEffect(() => {
    setStepValid(0, isValid);
    if (isValid) {
      updateSection("tenant", {
        name: nameValue,
        slug: slugValue,
        database: databaseValue,
      });
    }
  }, [isValid, nameValue, slugValue, databaseValue, updateSection, setStepValid]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-default-800">Información del Negocio</h3>
        <p className="text-sm text-default-500">
          Registra el nombre comercial y los datos iniciales para el nuevo Tenant.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          isRequired
          label="Nombre Comercial"
          placeholder="Ej: Ferretería Central"
          labelPlacement="outside"
          className="md:col-span-1"
          description="Nombre público de la empresa o negocio."
          startContent={<LuBuilding size={18} className="text-default-400" />}
          {...register("name", { required: "El nombre comercial es obligatorio" })}
          isInvalid={!!errors.name}
          errorMessage={errors.name?.message as string}
        />

        <Input
          isRequired
          label="Base de Datos"
          placeholder="tienda_db"
          labelPlacement="outside"
          className="md:col-span-1"
          description={`Base física: tenant_${databaseValue || "tienda_db"}`}
          startContent={<LuDatabase size={18} className="text-default-400" />}
          {...register("database", {
            required: "El identificador de base de datos es obligatorio",
            pattern: {
              value: /^[a-z0-9_]+$/,
              message: "Solo letras minúsculas, números y guiones bajos (_).",
            },
            validate: validateDatabaseUniqueness,
          })}
          isInvalid={!!errors.database}
          errorMessage={errors.database?.message as string}
        />
      </div>
    </div>
  );
};
