import React, { useEffect, useState } from "react";
import { Input } from "@nextui-org/react";
import { useForm } from "react-hook-form";
import { useTenantFormStore } from "../store/tenantForm.store";
import { LuUser, LuMail, LuLock, LuEye, LuEyeOff, LuPhone, LuGlobe } from "react-icons/lu";

export const TenantOwnerStep = () => {
  const { formData, updateSection, setStepValid } = useTenantFormStore();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      name: formData.owner.name || formData.tenant.owner_name || "",
      email: formData.owner.email || formData.tenant.owner_email || "",
      phone_country_code: formData.owner.phone_country_code || formData.tenant.phone_country_code || "+591",
      phone_number: formData.owner.phone_number || formData.tenant.phone_number || "",
      password: formData.owner.password || "",
      password_confirmation: formData.owner.password || "",
    },
  });

  const nameValue = watch("name");
  const emailValue = watch("email");
  const phoneCountryCodeValue = watch("phone_country_code");
  const phoneNumberValue = watch("phone_number");
  const passwordValue = watch("password");
  const confirmPasswordValue = watch("password_confirmation");

  // Sync to Store and validate step
  useEffect(() => {
    const passwordsMatch = passwordValue === confirmPasswordValue;
    const isStepValid = isValid && passwordsMatch && (passwordValue?.length ?? 0) >= 6;
    
    setStepValid(3, isStepValid);
    
    if (isStepValid) {
      updateSection("owner", {
        name: nameValue,
        email: emailValue,
        phone_country_code: phoneCountryCodeValue,
        phone_number: phoneNumberValue,
        password: passwordValue,
      });

      const fullPhone = `${phoneCountryCodeValue || "+591"} ${phoneNumberValue || ""}`.trim();
      updateSection("tenant", {
        owner_name: nameValue,
        owner_email: emailValue,
        owner_phone: fullPhone,
        phone_country_code: phoneCountryCodeValue,
        phone_number: phoneNumberValue,
      });
    }
  }, [
    isValid,
    nameValue,
    emailValue,
    phoneCountryCodeValue,
    phoneNumberValue,
    passwordValue,
    confirmPasswordValue,
    updateSection,
    setStepValid,
  ]);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-default-800">Información del Propietario & Cuenta de Acceso</h3>
        <p className="text-sm text-default-500">
          Registra el contacto del propietario y las credenciales del administrador principal para gestionar la empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          isRequired
          label="Nombre Completo del Propietario"
          placeholder="Juan Perez"
          labelPlacement="outside"
          startContent={<LuUser size={18} className="text-default-400" />}
          {...register("name", { required: "El nombre es obligatorio" })}
          isInvalid={!!errors.name}
          errorMessage={errors.name?.message as string}
        />

        <Input
          isRequired
          label="Correo Electrónico (Login)"
          type="email"
          placeholder="user@mail.com"
          labelPlacement="outside"
          startContent={<LuMail size={18} className="text-default-400" />}
          {...register("email", {
            required: "El correo es obligatorio",
            pattern: { value: /^\S+@\S+$/i, message: "Email inválido" },
          })}
          isInvalid={!!errors.email}
          errorMessage={errors.email?.message as string}
        />

        {/* 2 Contiguous Phone Fields: Editable & Selectable Country Code + Phone Number */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:col-span-2">
          <div className="sm:col-span-1">
            <Input
              isRequired
              label="Código de País"
              placeholder="+591"
              labelPlacement="outside"
              list="country-codes-datalist"
              startContent={<LuGlobe size={18} className="text-default-400" />}
              description="Selecciona o edita el prefijo"
              {...register("phone_country_code", {
                required: "Código obligatorio",
                pattern: {
                  value: /^\+[0-9]{1,4}$/,
                  message: "Formato: +591",
                },
              })}
              isInvalid={!!errors.phone_country_code}
              errorMessage={errors.phone_country_code?.message as string}
            />
            <datalist id="country-codes-datalist">
              <option value="+591">Bolivia (+591)</option>
              <option value="+51">Perú (+51)</option>
              <option value="+54">Argentina (+54)</option>
              <option value="+56">Chile (+56)</option>
              <option value="+57">Colombia (+57)</option>
              <option value="+52">México (+52)</option>
              <option value="+55">Brasil (+55)</option>
              <option value="+593">Ecuador (+593)</option>
              <option value="+595">Paraguay (+595)</option>
              <option value="+598">Uruguay (+598)</option>
              <option value="+34">España (+34)</option>
              <option value="+1">EE.UU. / Canadá (+1)</option>
            </datalist>
          </div>

          <div className="sm:col-span-2">
            <Input
              isRequired
              label="Número Telefónico / WhatsApp"
              type="tel"
              placeholder="70012345"
              labelPlacement="outside"
              startContent={<LuPhone size={18} className="text-default-400" />}
              description="Línea de contacto para notificaciones y alertas"
              {...register("phone_number", {
                required: "El número telefónico es obligatorio",
                pattern: {
                  value: /^[0-9\s-]{6,15}$/,
                  message: "Debe contener entre 6 y 15 dígitos",
                },
              })}
              isInvalid={!!errors.phone_number}
              errorMessage={errors.phone_number?.message as string}
            />
          </div>
        </div>

        <Input
          isRequired
          label="Contraseña de Acceso"
          type={showPassword ? "text" : "password"}
          placeholder="Mínimo 6 caracteres"
          labelPlacement="outside"
          startContent={<LuLock size={18} className="text-default-400" />}
          endContent={
            <button type="button" onClick={togglePasswordVisibility} className="focus:outline-none">
              {showPassword ? (
                <LuEyeOff size={18} className="text-default-400" />
              ) : (
                <LuEye size={18} className="text-default-400" />
              )}
            </button>
          }
          {...register("password", {
            required: "La contraseña es obligatoria",
            minLength: { value: 6, message: "Mínimo 6 caracteres" },
          })}
          isInvalid={!!errors.password}
          errorMessage={errors.password?.message as string}
        />

        <Input
          isRequired
          label="Confirmar Contraseña"
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Repite la contraseña"
          labelPlacement="outside"
          startContent={<LuLock size={18} className="text-default-400" />}
          endContent={
            <button type="button" onClick={toggleConfirmPasswordVisibility} className="focus:outline-none">
              {showConfirmPassword ? (
                <LuEyeOff size={18} className="text-default-400" />
              ) : (
                <LuEye size={18} className="text-default-400" />
              )}
            </button>
          }
          {...register("password_confirmation", {
            required: "Debe confirmar su contraseña",
            validate: (val) => val === passwordValue || "Las contraseñas no coinciden",
          })}
          isInvalid={!!errors.password_confirmation}
          errorMessage={errors.password_confirmation?.message as string}
        />
      </div>
    </div>
  );
};
