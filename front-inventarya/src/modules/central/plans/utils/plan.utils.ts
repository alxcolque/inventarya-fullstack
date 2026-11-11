import { PlanFeatures } from "../interfaces/plan.interface";

/**
 * Standard features catalog defined in Section 5 of plans.md
 */
export const PLAN_FEATURES = [
  {
    key: 'inventory',
    label: 'Gestión de inventario',
    description: 'Control de existencias y movimientos.'
  },
  {
    key: 'stock_alerts',
    label: 'Alertas de stock mínimo',
    description: 'Notificaciones cuando un producto llega al stock mínimo.'
  },
  {
    key: 'transfers',
    label: 'Transferencias',
    description: 'Transferencia de productos entre almacenes y tiendas.'
  },
  {
    key: 'advanced_reports',
    label: 'Reportes avanzados',
    description: 'Reportes y análisis avanzados.'
  },
  {
    key: 'api',
    label: 'Acceso API',
    description: 'Permite integración con sistemas externos.'
  },
  {
    key: 'barcode',
    label: 'Código de barras',
    description: 'Gestión mediante códigos de barras.'
  },
  {
    key: 'notifications',
    label: 'Notificaciones',
    description: 'Notificaciones internas del sistema.'
  }
] as const;

export type PlanFeatureKey = typeof PLAN_FEATURES[number]['key'];

/**
 * Formats a numeric amount to US Dollar currency format (USD)
 */
export function formatPriceUsd(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : Number.parseFloat(String(amount ?? 0));
  const value = Number.isFinite(num) ? num : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Normalizes features whether they come as JSON object, JSON string, or legacy array of keys
 */
export function normalizeFeatures(features: any): PlanFeatures {
  if (!features) return {};

  // If string, try to parse
  if (typeof features === 'string') {
    try {
      features = JSON.parse(features);
    } catch {
      return {};
    }
  }

  // If legacy array: ['inventory', 'stock_alerts']
  if (Array.isArray(features)) {
    const obj: PlanFeatures = {};
    features.forEach((key) => {
      if (typeof key === 'string') {
        obj[key] = true;
      }
    });
    return obj;
  }

  // If object: { inventory: true, ... }
  if (typeof features === 'object') {
    return { ...features };
  }

  return {};
}
