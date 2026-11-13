import React, { useEffect, useState } from "react";
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
  Switch,
  Chip,
} from "@nextui-org/react";
import { LuListPlus, LuPlus, LuX } from "react-icons/lu";
import {
  BusinessTypeFieldDataType,
  IBusinessTypeField,
  IBusinessTypeFieldValidation,
} from "../interfaces/business-type.interface";
import { useBusinessTypesStore } from "../store/businessTypes.store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessTypeId: number;
  field?: IBusinessTypeField;
  isLocked: boolean;
}

const FIELD_TYPES: Array<{ value: BusinessTypeFieldDataType; label: string }> = [
  { value: "text", label: "Texto corto (text)" },
  { value: "textarea", label: "Texto largo (textarea)" },
  { value: "number", label: "Número entero (number)" },
  { value: "decimal", label: "Número decimal (decimal)" },
  { value: "boolean", label: "Sí / No (boolean)" },
  { value: "date", label: "Fecha (date)" },
  { value: "select", label: "Lista desplegable (select)" },
];

const toSnakeKey = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "");

export const BusinessTypeFieldModal: React.FC<Props> = ({
  isOpen,
  onClose,
  businessTypeId,
  field,
  isLocked,
}) => {
  const { createField, updateField, isSaving } = useBusinessTypesStore();

  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<BusinessTypeFieldDataType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");

  const [minLength, setMinLength] = useState("");
  const [maxLength, setMaxLength] = useState("");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [decimals, setDecimals] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (field) {
      setLabel(field.label || "");
      setKey(field.key || "");
      setKeyTouched(true);
      setType(field.type || "text");
      setIsRequired(Boolean(field.is_required));
      setIsActive(Boolean(field.is_active));
      setOptions(Array.isArray(field.options) ? field.options : []);
      setMinLength(field.validation?.min_length != null ? String(field.validation.min_length) : "");
      setMaxLength(field.validation?.max_length != null ? String(field.validation.max_length) : "");
      setMinVal(field.validation?.min != null ? String(field.validation.min) : "");
      setMaxVal(field.validation?.max != null ? String(field.validation.max) : "");
      setDecimals(field.validation?.decimals != null ? String(field.validation.decimals) : "");
    } else {
      setLabel("");
      setKey("");
      setKeyTouched(false);
      setType("text");
      setIsRequired(false);
      setIsActive(true);
      setOptions([]);
      setNewOption("");
      setMinLength("");
      setMaxLength("");
      setMinVal("");
      setMaxVal("");
      setDecimals("");
    }
  }, [field, isOpen]);

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!field && !keyTouched) {
      setKey(toSnakeKey(val));
    }
  };

  const handleAddOption = () => {
    const clean = newOption.trim();
    if (!clean) return;
    if (!options.includes(clean)) {
      setOptions((prev) => [...prev, clean]);
    }
    setNewOption("");
  };

  const handleRemoveOption = (opt: string) => {
    setOptions((prev) => prev.filter((item) => item !== opt));
  };

  const buildValidation = (): IBusinessTypeFieldValidation | null => {
    const v: IBusinessTypeFieldValidation = {};
    if (type === "text" || type === "textarea") {
      if (minLength !== "") v.min_length = Number(minLength);
      if (maxLength !== "") v.max_length = Number(maxLength);
    } else if (type === "number" || type === "decimal") {
      if (minVal !== "") v.min = Number(minVal);
      if (maxVal !== "") v.max = Number(maxVal);
      if (type === "decimal" && decimals !== "") v.decimals = Number(decimals);
    }
    return Object.keys(v).length > 0 ? v : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !key.trim()) return;

    const payload: Partial<IBusinessTypeField> = {
      label: label.trim(),
      is_required: isRequired,
      is_active: isActive,
      options: type === "select" ? options : null,
      validation: buildValidation(),
    };

    if (!field || !isLocked) {
      payload.key = key.trim();
      payload.type = type;
    }

    const ok = field
      ? await updateField(businessTypeId, field.id, payload)
      : await createField(businessTypeId, payload);

    if (ok) {
      onClose();
    }
  };

  const identityLocked = Boolean(field && isLocked);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" backdrop="blur" scrollBehavior="inside">
      <ModalContent>
        {(close) => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex items-center gap-2 border-b border-divider">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <LuListPlus size={18} />
              </div>
              <span>{field ? "Editar Campo de Producto" : "Nuevo Campo de Producto"}</span>
            </ModalHeader>

            <ModalBody className="py-5 flex flex-col gap-4">
              {identityLocked && (
                <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-950/30 border border-warning-200 text-xs text-warning-700 dark:text-warning-300">
                  Este tipo de negocio ya tiene tenants asociados. La clave interna y el tipo de dato están bloqueados para proteger los atributos guardados en productos.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  isRequired
                  label="Etiqueta visible"
                  placeholder="Ej: Principio activo"
                  labelPlacement="outside"
                  variant="bordered"
                  value={label}
                  onValueChange={handleLabelChange}
                />

                <Input
                  isRequired
                  label="Clave interna"
                  placeholder="ej: active_ingredient"
                  labelPlacement="outside"
                  variant="bordered"
                  isDisabled={identityLocked}
                  value={key}
                  onValueChange={(val) => {
                    setKeyTouched(true);
                    setKey(val.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                  }}
                  description="Solo minúsculas, números y guion bajo (_). Debe iniciar con letra."
                />
              </div>

              <Select
                isRequired
                label="Tipo de dato"
                labelPlacement="outside"
                variant="bordered"
                isDisabled={identityLocked}
                selectedKeys={[type]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as BusinessTypeFieldDataType;
                  if (selected) setType(selected);
                }}
              >
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {ft.label}
                  </SelectItem>
                ))}
              </Select>

              {type === "select" && (
                <div className="p-3 rounded-xl border border-divider bg-default-50/40 flex flex-col gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-default-600">
                    Opciones permitidas
                  </span>
                  <div className="flex gap-2">
                    <Input
                      size="sm"
                      variant="bordered"
                      placeholder="Ej: Tableta"
                      value={newOption}
                      onValueChange={setNewOption}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<LuPlus size={14} />}
                      onPress={handleAddOption}
                    >
                      Agregar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.length === 0 ? (
                      <span className="text-xs text-default-400">
                        Agrega al menos una opción para el selector.
                      </span>
                    ) : (
                      options.map((opt) => (
                        <Chip
                          key={opt}
                          size="sm"
                          variant="flat"
                          color="primary"
                          onClose={() => handleRemoveOption(opt)}
                          endContent={<LuX size={12} className="cursor-pointer" />}
                        >
                          {opt}
                        </Chip>
                      ))
                    )}
                  </div>
                </div>
              )}

              {(type === "text" || type === "textarea") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl border border-divider bg-default-50/40">
                  <Input
                    type="number"
                    size="sm"
                    variant="bordered"
                    label="Longitud mínima"
                    labelPlacement="outside"
                    placeholder="Opcional"
                    min={0}
                    value={minLength}
                    onValueChange={setMinLength}
                  />
                  <Input
                    type="number"
                    size="sm"
                    variant="bordered"
                    label="Longitud máxima"
                    labelPlacement="outside"
                    placeholder="Opcional"
                    min={1}
                    value={maxLength}
                    onValueChange={setMaxLength}
                  />
                </div>
              )}

              {(type === "number" || type === "decimal") && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-xl border border-divider bg-default-50/40">
                  <Input
                    type="number"
                    size="sm"
                    variant="bordered"
                    label="Valor mínimo"
                    labelPlacement="outside"
                    placeholder="Opcional"
                    step={type === "decimal" ? "any" : "1"}
                    value={minVal}
                    onValueChange={setMinVal}
                  />
                  <Input
                    type="number"
                    size="sm"
                    variant="bordered"
                    label="Valor máximo"
                    labelPlacement="outside"
                    placeholder="Opcional"
                    step={type === "decimal" ? "any" : "1"}
                    value={maxVal}
                    onValueChange={setMaxVal}
                  />
                  {type === "decimal" && (
                    <Input
                      type="number"
                      size="sm"
                      variant="bordered"
                      label="Máximo de decimales"
                      labelPlacement="outside"
                      placeholder="Ej: 2"
                      min={0}
                      max={8}
                      value={decimals}
                      onValueChange={setDecimals}
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-divider">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Obligatorio</span>
                    <span className="text-[11px] text-default-500">Exigir al crear/editar producto</span>
                  </div>
                  <Switch size="sm" isSelected={isRequired} onValueChange={setIsRequired} color="primary" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-divider">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Campo activo</span>
                    <span className="text-[11px] text-default-500">Visible en formularios tenant</span>
                  </div>
                  <Switch size="sm" isSelected={isActive} onValueChange={setIsActive} color="success" />
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-divider">
              <Button variant="light" onPress={close} isDisabled={isSaving}>
                Cancelar
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={isSaving}
                isDisabled={!label.trim() || !key.trim() || (type === "select" && options.length === 0)}
              >
                {field ? "Guardar Campo" : "Agregar Campo"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};

