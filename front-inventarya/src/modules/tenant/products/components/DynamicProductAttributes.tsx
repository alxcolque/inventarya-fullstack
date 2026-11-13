import React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Select,
  SelectItem,
  Switch,
  Textarea,
} from "@nextui-org/react";
import { LuSlidersHorizontal } from "react-icons/lu";
import { IDynamicProductField } from "../store/products/business-type-fields.store";

export type AttributeValues = Record<string, any>;
export type AttributeErrors = Record<string, string>;

export function validateDynamicAttributes(
  fields: IDynamicProductField[],
  values: AttributeValues
): AttributeErrors {
  const errors: AttributeErrors = {};

  for (const field of fields) {
    if (!field.is_active) continue;

    const raw = values[field.key];
    const isEmpty = raw === undefined || raw === null || raw === "";

    if (field.is_required && isEmpty) {
      errors[field.key] = `El campo ${field.label} es obligatorio.`;
      continue;
    }

    if (isEmpty) continue;

    const v = field.validation || {};

    if (field.type === "text" || field.type === "textarea") {
      const str = String(raw);
      if (v.min_length != null && str.length < v.min_length) {
        errors[field.key] = `${field.label} debe tener al menos ${v.min_length} caracteres.`;
      } else if (v.max_length != null && str.length > v.max_length) {
        errors[field.key] = `${field.label} no debe superar los ${v.max_length} caracteres.`;
      }
    } else if (field.type === "number" || field.type === "decimal") {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        errors[field.key] = `${field.label} debe ser un número válido.`;
        continue;
      }
      if (field.type === "number" && !Number.isInteger(num)) {
        errors[field.key] = `${field.label} debe ser un número entero.`;
        continue;
      }
      if (v.min != null && num < v.min) {
        errors[field.key] = `${field.label} debe ser mayor o igual a ${v.min}.`;
      } else if (v.max != null && num > v.max) {
        errors[field.key] = `${field.label} debe ser menor o igual a ${v.max}.`;
      } else if (field.type === "decimal" && v.decimals != null) {
        const str = String(raw);
        const parts = str.split(".");
        if (parts[1] && parts[1].replace(/0+$/, "").length > v.decimals) {
          errors[field.key] = `${field.label} admite como máximo ${v.decimals} decimales.`;
        }
      }
    } else if (field.type === "select") {
      if (Array.isArray(field.options) && !field.options.includes(String(raw))) {
        errors[field.key] = `Selecciona una opción válida para ${field.label}.`;
      }
    }
  }

  return errors;
}

interface Props {
  businessTypeName?: string | null;
  fields: IDynamicProductField[];
  values: AttributeValues;
  errors?: AttributeErrors;
  onChange: (key: string, value: any) => void;
}

export const DynamicProductAttributes: React.FC<Props> = ({
  businessTypeName,
  fields,
  values,
  errors = {},
  onChange,
}) => {
  const activeFields = fields.filter((f) => f.is_active);
  if (activeFields.length === 0) return null;

  return (
    <Card className="border border-default-200 shadow-sm bg-content1 rounded-2xl">
      <CardHeader className="py-3 px-5 border-b border-default-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LuSlidersHorizontal className="text-primary text-base" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Atributos del Negocio
          </h3>
        </div>
        {businessTypeName && (
          <Chip size="sm" variant="flat" color="primary" className="font-semibold text-xs">
            {businessTypeName}
          </Chip>
        )}
      </CardHeader>

      <CardBody className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activeFields.map((field) => {
          const val = values[field.key];
          const errMsg = errors[field.key];

          if (field.type === "textarea") {
            return (
              <div key={field.key} className="sm:col-span-2">
                <Textarea
                  label={field.label}
                  variant="bordered"
                  isRequired={field.is_required}
                  minRows={2}
                  maxRows={4}
                  value={val != null ? String(val) : ""}
                  onValueChange={(next) => onChange(field.key, next)}
                  isInvalid={Boolean(errMsg)}
                  errorMessage={errMsg}
                  classNames={{
                    label: "text-xs font-semibold",
                    input: "text-xs",
                  }}
                />
              </div>
            );
          }

          if (field.type === "select") {
            const opts = Array.isArray(field.options) ? field.options : [];
            return (
              <Select
                key={field.key}
                label={field.label}
                placeholder="Selecciona una opción"
                variant="bordered"
                isRequired={field.is_required}
                selectedKeys={val ? [String(val)] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  onChange(field.key, selected || "");
                }}
                isInvalid={Boolean(errMsg)}
                errorMessage={errMsg}
                classNames={{
                  label: "text-xs font-semibold",
                }}
              >
                {opts.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </Select>
            );
          }

          if (field.type === "boolean") {
            return (
              <div
                key={field.key}
                className="flex items-center justify-between p-3 rounded-xl border border-default-200 bg-default-50/40"
              >
                <span className="text-xs font-semibold text-foreground">
                  {field.label}
                  {field.is_required && <span className="text-danger ml-1">*</span>}
                </span>
                <Switch
                  size="sm"
                  color="primary"
                  isSelected={Boolean(val)}
                  onValueChange={(checked) => onChange(field.key, checked)}
                  aria-label={field.label}
                />
              </div>
            );
          }

          if (field.type === "date") {
            return (
              <Input
                key={field.key}
                type="date"
                label={field.label}
                variant="bordered"
                isRequired={field.is_required}
                value={val != null ? String(val) : ""}
                onValueChange={(next) => onChange(field.key, next)}
                isInvalid={Boolean(errMsg)}
                errorMessage={errMsg}
                classNames={{
                  label: "text-xs font-semibold",
                  input: "text-sm",
                }}
              />
            );
          }

          if (field.type === "number" || field.type === "decimal") {
            return (
              <Input
                key={field.key}
                type="number"
                inputMode={field.type === "decimal" ? "decimal" : "numeric"}
                step={field.type === "decimal" ? "any" : "1"}
                label={field.label}
                variant="bordered"
                isRequired={field.is_required}
                value={val !== undefined && val !== null ? String(val) : ""}
                onValueChange={(next) => onChange(field.key, next)}
                isInvalid={Boolean(errMsg)}
                errorMessage={errMsg}
                classNames={{
                  label: "text-xs font-semibold",
                  input: "text-sm",
                }}
              />
            );
          }

          return (
            <Input
              key={field.key}
              type="text"
              label={field.label}
              variant="bordered"
              isRequired={field.is_required}
              value={val != null ? String(val) : ""}
              onValueChange={(next) => onChange(field.key, next)}
              isInvalid={Boolean(errMsg)}
              errorMessage={errMsg}
              classNames={{
                label: "text-xs font-semibold",
                input: "text-sm",
              }}
            />
          );
        })}
      </CardBody>
    </Card>
  );
};

