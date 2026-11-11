import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
  Chip,
} from "@nextui-org/react";
import {
  LuUser,
  LuCreditCard,
  LuPhone,
  LuMail,
  LuMapPin,
  LuUserPlus,
  LuSave,
  LuChevronDown,
  LuFileText,
} from "react-icons/lu";

export interface CustomerFormData {
  name: string;
  document_type?: number | string | null;
  document_number?: string;
  document_complement?: string;
  cinit?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerFormData) => Promise<boolean>;
  initialData?: Record<string, any> | null;
  isEditing?: boolean;
}

const DOCUMENT_TYPES = [
  { key: "1", label: "CI - Cédula de Identidad" },
  { key: "5", label: "NIT - Número de Identificación Tributaria" },
  { key: "2", label: "CEX - Cédula Extranjero" },
  { key: "3", label: "PAS - Pasaporte" },
  { key: "4", label: "OD - Otro Documento" },
];

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    defaultValues: {
      name: "",
      document_type: "1",
      document_number: "",
      document_complement: "",
      cinit: "",
      phone: "",
      email: "",
      address: "",
    },
  });

  const [showMoreFields, setShowMoreFields] = useState<boolean>(false);
  const selectedDocType = String(watch("document_type") || "1");

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        const docNum = initialData.document_number || initialData.cinit || "";
        const docType = initialData.document_type ? String(initialData.document_type) : "1";
        reset({
          name: initialData.name || "",
          document_type: docType,
          document_number: docNum,
          document_complement: initialData.document_complement || "",
          cinit: docNum,
          phone: initialData.phone || "",
          email: initialData.email || "",
          address: initialData.address || "",
        });
        setShowMoreFields(
          Boolean(
            initialData.phone ||
            initialData.email ||
            initialData.address ||
            initialData.document_complement
          )
        );
      } else {
        reset({
          name: "",
          document_type: "1",
          document_number: "",
          document_complement: "",
          cinit: "",
          phone: "",
          email: "",
          address: "",
        });
        setShowMoreFields(false);
      }

      // Auto focus on document_number for quick sales registration
      setTimeout(() => {
        setFocus("document_number");
      }, 100);
    }
  }, [isOpen, isEditing, initialData, reset, setFocus]);

  const onFormSubmit = async (data: CustomerFormData) => {
    const docNumber = (data.document_number || data.cinit || "").trim();
    const payload: CustomerFormData = {
      name: data.name.trim(),
      document_type: data.document_type ? Number(data.document_type) : 1,
      document_number: docNumber || undefined,
      document_complement: data.document_complement?.trim() || undefined,
      cinit: docNumber, // Backwards-compatible alias
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
    };

    const success = await onSubmit(payload);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      placement="center"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        base: "border border-default-200/70 dark:border-default-100/20 bg-background/95 backdrop-blur-md rounded-3xl shadow-2xl",
        header: "border-b border-default-100/80 px-6 py-4",
        footer: "border-t border-default-100/80 px-6 py-4",
        body: "p-6",
      }}
    >
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
            <ModalHeader className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl ${
                    isEditing
                      ? "bg-warning-100 dark:bg-warning-950/50 text-warning-600"
                      : "bg-primary-100 dark:bg-primary-950/50 text-primary-600"
                  }`}
                >
                  {isEditing ? <LuUser size={24} /> : <LuUserPlus size={24} />}
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-default-900 leading-tight">
                    {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
                  </h2>
                  <p className="text-xs text-default-500 font-normal">
                    {isEditing
                      ? "Actualiza la información del cliente registrado"
                      : "Registro rápido para ventas y facturación SIAT"}
                  </p>
                </div>
              </div>
              {!isEditing && (
                <Chip
                  size="sm"
                  color="primary"
                  variant="flat"
                  className="font-semibold"
                >
                  Registro Rápido
                </Chip>
              )}
            </ModalHeader>

            <ModalBody className="flex flex-col gap-5">
              {/* Prioridad: Datos Principales de Identificación */}
              <div className="bg-primary-50/60 dark:bg-primary-950/20 p-4 rounded-2xl border border-primary-200/50 dark:border-primary-900/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                    Identificación Fiscal & Venta
                  </span>
                  <span className="text-[11px] text-primary-600 dark:text-primary-400 font-medium">
                    Compatible con SIAT / Facturación
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
                  {/* Tipo de Documento */}
                  <div className="sm:col-span-5">
                    <Select
                      label="Tipo Documento"
                      placeholder="Seleccionar tipo"
                      labelPlacement="outside"
                      selectedKeys={[selectedDocType]}
                      onChange={(e) => setValue("document_type", e.target.value)}
                      variant="bordered"
                      radius="lg"
                      startContent={<LuFileText size={16} className="text-default-400" />}
                      classNames={{
                        trigger: "bg-background",
                      }}
                    >
                      {DOCUMENT_TYPES.map((doc) => (
                        <SelectItem key={doc.key} value={doc.key} textValue={doc.label}>
                          {doc.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  {/* Número de Documento (CI / NIT) */}
                  <div className="sm:col-span-4">
                    <Input
                      autoFocus
                      label="Nº Documento / CI / NIT"
                      placeholder="Ej: 1234567"
                      labelPlacement="outside"
                      startContent={<LuCreditCard size={17} className="text-default-400" />}
                      maxLength={50}
                      {...register("document_number", {
                        maxLength: {
                          value: 50,
                          message: "Máximo 50 caracteres",
                        },
                      })}
                      isInvalid={!!errors.document_number}
                      errorMessage={errors.document_number?.message}
                      variant="bordered"
                      radius="lg"
                      classNames={{
                        inputWrapper: "bg-background",
                      }}
                    />
                  </div>

                  {/* Complemento (Opcional, para duplicados CI) */}
                  <div className="sm:col-span-3">
                    <Input
                      label="Complemento"
                      placeholder="Ej: 1B (opcional)"
                      labelPlacement="outside"
                      maxLength={20}
                      {...register("document_complement", {
                        maxLength: {
                          value: 20,
                          message: "Máximo 20 caracteres",
                        },
                      })}
                      isInvalid={!!errors.document_complement}
                      errorMessage={errors.document_complement?.message}
                      variant="bordered"
                      radius="lg"
                      classNames={{
                        inputWrapper: "bg-background",
                      }}
                    />
                  </div>
                </div>

                {/* Nombre Completo / Razón Social */}
                <div>
                  <Input
                    isRequired
                    label="Nombre Completo / Razón Social"
                    placeholder="Ej: Juan Pérez o Mi Empresa S.R.L."
                    labelPlacement="outside"
                    startContent={<LuUser size={18} className="text-default-400" />}
                    maxLength={150}
                    {...register("name", {
                      required: "El nombre es obligatorio",
                      maxLength: {
                        value: 150,
                        message: "Máximo 150 caracteres",
                      },
                    })}
                    isInvalid={!!errors.name}
                    errorMessage={errors.name?.message}
                    variant="bordered"
                    radius="lg"
                    classNames={{
                      inputWrapper: "bg-background",
                    }}
                  />
                </div>
              </div>

              {/* Botón para abrir/cerrar Datos de Contacto (Opcionales) */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowMoreFields(!showMoreFields)}
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline cursor-pointer select-none transition-colors"
                >
                  <LuChevronDown
                    size={15}
                    className={`transition-transform duration-200 ${
                      showMoreFields ? "rotate-180" : ""
                    }`}
                  />
                  <span>
                    {showMoreFields
                      ? "Ocultar datos de contacto adicionales"
                      : "Registrar datos de contacto adicionales"}
                  </span>
                </button>
              </div>

              {/* Campos Opcionales (Colapsados por defecto) */}
              {showMoreFields && (
                <div className="pt-2 flex flex-col gap-4 border-t border-default-100 animate-fadeIn">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-default-400">
                      Datos de Contacto (Opcionales)
                    </span>
                    <span className="text-[11px] text-default-400">
                      Puedes completarlos o actualizarlos después
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Teléfono / Celular */}
                    <Input
                      label="Teléfono / Celular"
                      placeholder="Ej: +591 70012345"
                      labelPlacement="outside"
                      startContent={<LuPhone size={18} className="text-default-400" />}
                      maxLength={20}
                      {...register("phone", {
                        maxLength: {
                          value: 20,
                          message: "Máximo 20 caracteres",
                        },
                      })}
                      isInvalid={!!errors.phone}
                      errorMessage={errors.phone?.message}
                      variant="bordered"
                      radius="lg"
                    />

                    {/* Correo Electrónico */}
                    <Input
                      label="Correo Electrónico"
                      placeholder="usuario@ejemplo.com"
                      labelPlacement="outside"
                      type="email"
                      startContent={<LuMail size={18} className="text-default-400" />}
                      maxLength={150}
                      {...register("email", {
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Formato de correo no válido",
                        },
                        maxLength: {
                          value: 150,
                          message: "Máximo 150 caracteres",
                        },
                      })}
                      isInvalid={!!errors.email}
                      errorMessage={errors.email?.message}
                      variant="bordered"
                      radius="lg"
                    />

                    {/* Dirección */}
                    <div className="md:col-span-2">
                      <Input
                        label="Dirección / Domicilio"
                        placeholder="Ej: Av. Bolívar #123, Zona Central"
                        labelPlacement="outside"
                        startContent={<LuMapPin size={18} className="text-default-400" />}
                        maxLength={255}
                        {...register("address", {
                          maxLength: {
                            value: 255,
                            message: "Máximo 255 caracteres",
                          },
                        })}
                        isInvalid={!!errors.address}
                        errorMessage={errors.address?.message}
                        variant="bordered"
                        radius="lg"
                      />
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <Button
                variant="light"
                color="default"
                radius="lg"
                onPress={onClose}
                isDisabled={isSubmitting}
              >
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  color="primary"
                  radius="lg"
                  isLoading={isSubmitting}
                  startContent={
                    !isSubmitting &&
                    (isEditing ? <LuSave size={18} /> : <LuUserPlus size={18} />)
                  }
                  className="font-semibold shadow-md shadow-primary/20 px-6"
                >
                  {isEditing ? "Guardar Cambios" : "Registrar Cliente"}
                </Button>
              </div>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
