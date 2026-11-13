// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DynamicProductAttributes,
  validateDynamicAttributes,
} from "./DynamicProductAttributes";
import { IDynamicProductField } from "../store/products/business-type-fields.store";

const sampleFields: IDynamicProductField[] = [
  {
    id: 1,
    key: "active_ingredient",
    label: "Principio activo",
    type: "text",
    is_required: true,
    is_active: true,
    validation: { min_length: 3, max_length: 100 },
    sort_order: 1,
  },
  {
    id: 2,
    key: "concentration_mg",
    label: "Concentración (mg)",
    type: "decimal",
    is_required: false,
    is_active: true,
    validation: { min: 0.5, max: 2000, decimals: 2 },
    sort_order: 2,
  },
  {
    id: 3,
    key: "presentation",
    label: "Presentación",
    type: "select",
    is_required: false,
    is_active: true,
    options: ["Tableta", "Jarabe"],
    sort_order: 3,
  },
  {
    id: 4,
    key: "requires_prescription",
    label: "Requiere receta",
    type: "boolean",
    is_required: false,
    is_active: true,
    sort_order: 4,
  },
  {
    id: 5,
    key: "legacy_field",
    label: "Campo Inactivo",
    type: "text",
    is_required: true,
    is_active: false,
    sort_order: 5,
  },
];

describe("DynamicProductAttributes", () => {
  it("validates required fields, ranges, decimals and select options", () => {
    const missingErrors = validateDynamicAttributes(sampleFields, {});
    expect(missingErrors.active_ingredient).toContain("obligatorio");
    expect(missingErrors.legacy_field).toBeUndefined();

    const invalidErrors = validateDynamicAttributes(sampleFields, {
      active_ingredient: "AB",
      concentration_mg: "12.345",
      presentation: "Invalida",
    });
    expect(invalidErrors.active_ingredient).toContain("al menos 3");
    expect(invalidErrors.concentration_mg).toContain("2 decimales");
    expect(invalidErrors.presentation).toContain("opción válida");

    const okErrors = validateDynamicAttributes(sampleFields, {
      active_ingredient: "Paracetamol",
      concentration_mg: "500.5",
      presentation: "Tableta",
      requires_prescription: true,
    });
    expect(Object.keys(okErrors)).toHaveLength(0);
  });

  it("renders active fields in order with preloaded values and hides inactive fields", () => {
    const onChange = vi.fn();
    render(
      <DynamicProductAttributes
        businessTypeName="Farmacia"
        fields={sampleFields}
        values={{
          active_ingredient: "Ibuprofeno",
          concentration_mg: 400,
          requires_prescription: true,
        }}
        errors={{ concentration_mg: "Error de prueba" }}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Farmacia")).toBeTruthy();
    expect(screen.getByDisplayValue("Ibuprofeno")).toBeTruthy();
    expect(screen.getByDisplayValue("400")).toBeTruthy();
    expect(screen.getByText("Error de prueba")).toBeTruthy();
    expect(screen.queryByText("Campo Inactivo")).toBeNull();
  });
});

