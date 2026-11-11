import React, { useEffect } from "react";
import { Select, SelectItem, Input } from "@nextui-org/react";
import { useForm } from "react-hook-form";
import { useTenantFormStore } from "../store/tenantForm.store";
import { useTenantsStore } from "../store/tenants.store";
import { TenantDomainPreview } from "./TenantDomainPreview";
import { LuGlobe, LuNetwork, LuLaptop } from "react-icons/lu";

export const TenantDomainStep = () => {
  const { formData, updateDomains, updateSection, setStepValid } = useTenantFormStore();
  const { tenants } = useTenantsStore();

  // Suggest next local port e.g. 5174, 5175...
  const suggestedPort = 5174 + (tenants?.length || 0);
  const subdomainSuffix = import.meta.env.DEV
    ? /\.(inventarya\.com|localhost)$/
    : /\.(inventarya\.com)$/;

  const currentDomainInfo = formData.domains[0] || {
    domain: "",
    type: "subdomain",
  };

  const initialLocalPort = formData.tenant.data?.local_port || suggestedPort;

  interface DomainFormValues {
    type: "subdomain" | "custom";
    domain_input: string;
    local_port: number | string;
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<DomainFormValues>({
    mode: "onChange",
    defaultValues: {
      type: currentDomainInfo.type,
      domain_input: currentDomainInfo.domain 
        ? (currentDomainInfo.type === "subdomain" 
            ? currentDomainInfo.domain.replace(subdomainSuffix, "")
            : currentDomainInfo.domain)
        : (currentDomainInfo.type === "subdomain" ? formData.tenant.slug : ""),
      local_port: initialLocalPort,
    },
  });

  const typeValue = watch("type") as "subdomain" | "custom";
  const domainInputValue = watch("domain_input");
  const localPortValue = watch("local_port");

  // Track if subdomain has been manually edited by the user
  const isDomainInputManuallyEdited = React.useRef(
    !!currentDomainInfo.domain && 
    currentDomainInfo.domain.replace(subdomainSuffix, "") !== formData.tenant.slug
  );

  // Auto-generate subdomain from slug if it hasn't been edited
  useEffect(() => {
    if (typeValue === "subdomain" && !isDomainInputManuallyEdited.current) {
      if (formData.tenant.slug) {
        setValue("domain_input", formData.tenant.slug, { shouldValidate: true });
      }
    }
  }, [formData.tenant.slug, typeValue, setValue]);

  // Calculate final domain string
  const getFinalDomain = (input: string, type: "subdomain" | "custom") => {
    if (!input) return "";
    const cleanInput = input
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (type === "subdomain") {
      return `${cleanInput}.inventarya.com`;
    }
    return input.toLowerCase().trim().replace(/\s+/g, "");
  };

  const finalDomain = getFinalDomain(domainInputValue, typeValue);

  // Sync to Store and validate step
  useEffect(() => {
    setStepValid(1, isValid && !!finalDomain);
    if (isValid && finalDomain) {
      updateDomains([
        {
          domain: finalDomain,
          type: typeValue,
          is_primary: true,
          status: "pending",
        },
      ]);
      
      const cleanSlug = typeValue === "subdomain" && domainInputValue
        ? domainInputValue
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        : formData.tenant.slug;

      // Save local_port in tenant data and keep slug updated
      updateSection("tenant", {
        slug: cleanSlug,
        data: {
          ...formData.tenant.data,
          local_port: Number(localPortValue) || suggestedPort,
        },
      });
    }
  }, [isValid, domainInputValue, typeValue, finalDomain, localPortValue, updateDomains, updateSection, setStepValid]);

  // Validation functions
  const validateDomainUniqueness = (val: string) => {
    const calculated = getFinalDomain(val, typeValue);
    const domainExists = tenants.some((t) =>
      t.domains?.some((d) => d.domain === calculated)
    );
    if (domainExists) return "Este dominio ya está registrado en la red Inventarya";
    return true;
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-default-800">Configuración del Dominio</h3>
        <p className="text-sm text-default-500">
          Define cómo accederán los usuarios a esta sucursal tanto en producción como en desarrollo local.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select
          isRequired
          label="Tipo de Dominio"
          labelPlacement="outside"
          startContent={typeValue === "subdomain" ? <LuNetwork size={18} /> : <LuGlobe size={18} />}
          defaultSelectedKeys={[typeValue]}
          {...register("type", { required: true })}
        >
          <SelectItem key="subdomain" value="subdomain">Subdominio (*.inventarya.com)</SelectItem>
          <SelectItem key="custom" value="custom">Dominio Propio (ej: erp.miempresa.com)</SelectItem>
        </Select>

        <Input
          isRequired
          label={typeValue === "subdomain" ? "Subdominio" : "Dominio Personalizado"}
          placeholder={typeValue === "subdomain" ? "ej: mi-tienda" : "ej: erp.miempresa.com"}
          labelPlacement="outside"
          endContent={typeValue === "subdomain" ? <span className="text-default-400 font-semibold text-xs">.inventarya.com</span> : undefined}
          description={typeValue === "subdomain" ? `Acceso oficial: https://${domainInputValue || "mi-tienda"}.inventarya.com` : "Configura tu DNS CNAME apuntando a inventarya.com"}
          {...register("domain_input", {
            required: "Este campo es obligatorio",
            onChange: (e) => {
              isDomainInputManuallyEdited.current = !!e.target.value;
            },
            pattern: {
              value: typeValue === "subdomain" ? /^[a-z0-9-]+$/ : /^[a-z0-9.-]+\.[a-z]{2,}$/,
              message: typeValue === "subdomain" 
                ? "Subdominio inválido (solo minúsculas, números y guiones)"
                : "Dominio inválido (ej: erp.midominio.com)"
            },
            validate: validateDomainUniqueness,
          })}
          isInvalid={!!errors.domain_input}
          errorMessage={errors.domain_input?.message as string}
        />

        {import.meta.env.DEV && <Input
          type="number"
          label="Puerto Local (Desarrollo)"
          placeholder="ej: 5174"
          labelPlacement="outside"
          startContent={<LuLaptop size={18} />}
          description={import.meta.env.DEV ? `Puerto asignado en local (ej: localhost:${localPortValue || suggestedPort})` : undefined}
          {...register("local_port", {
            required: "El puerto local es necesario para desarrollo",
            min: { value: 1024, message: "Puerto mínimo 1024" },
            max: { value: 65535, message: "Puerto máximo 65535" },
          })}
          isInvalid={!!errors.local_port}
          errorMessage={errors.local_port?.message as string}
        />}

        <div className="md:col-span-2">
          <TenantDomainPreview 
            domain={finalDomain} 
            type={typeValue} 
            slug={formData.tenant.slug || domainInputValue}
            localPort={localPortValue} 
          />
        </div>
      </div>
    </div>
  );
};
