import { create } from "zustand";
import { tenantApi } from "@/api";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  BOB: "Bs.",
  USD: "$",
  EUR: "€",
  PEN: "S/.",
  ARS: "$",
  CLP: "$",
  COP: "$",
  MXN: "$",
  BRL: "R$",
  UYU: "$U",
  PYG: "Gs.",
  VES: "Bs.",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
};

/**
 * Obtiene el símbolo monetario a partir del código (o lo devuelve tal cual si ya es un símbolo).
 */
export const getCurrencySymbol = (currencyCodeOrSymbol?: string | null): string => {
  if (!currencyCodeOrSymbol) return "";
  const trimmed = currencyCodeOrSymbol.trim();
  const upper = trimmed.toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? trimmed;
};

const SESSION_CURRENCY_KEY = "tenant_currency";

const getStoredCurrency = (): string | null => {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(SESSION_CURRENCY_KEY);
    }
  } catch {
    // Si cookies/storage están bloqueados
  }
  return null;
};

const initialStored = getStoredCurrency();

interface CurrencyState {
  currency: string | null;
  symbol: string | null;
  isLoading: boolean;
  isLoaded: boolean;
}

interface CurrencyActions {
  fetchCurrency: (forceRefresh?: boolean) => Promise<string | null>;
  setCurrency: (currency: string) => void;
  clearCurrency: () => void;
  formatPrice: (amount: number | string | null | undefined, decimals?: number) => string | null;
}

export const useCurrencyStore = create<CurrencyState & CurrencyActions>((set, get) => ({
  currency: initialStored,
  symbol: initialStored ? getCurrencySymbol(initialStored) : null,
  isLoading: !initialStored,
  isLoaded: Boolean(initialStored),

  fetchCurrency: async (forceRefresh = false) => {
    // Si ya está cargado y no se fuerza recarga, retornar el actual
    if (!forceRefresh && get().isLoaded && get().currency) {
      return get().currency;
    }

    set({ isLoading: true });

    try {
      const { data } = await tenantApi.get<any>("/system-data");
      const resolvedCurrency =
        data?.setting?.currency ||
        data?.currency ||
        null;

      if (resolvedCurrency) {
        get().setCurrency(resolvedCurrency);
        return resolvedCurrency;
      }
    } catch {
      // Si falla la petición a /system-data, intentar /settings
      try {
        const { data: settingsData } = await tenantApi.get<any>("/settings");
        const resolvedCurrency =
          settingsData?.setting?.currency ||
          settingsData?.currency ||
          null;

        if (resolvedCurrency) {
          get().setCurrency(resolvedCurrency);
          return resolvedCurrency;
        }
      } catch {
        // En caso de error de red
      }
    } finally {
      // Finalizar estado de carga incluso si no se pudo resolver
      set({ isLoading: false });
    }

    return null;
  },

  setCurrency: (newCurrency: string) => {
    if (!newCurrency) return;
    const cleanCurrency = newCurrency.trim();
    const cleanSymbol = getCurrencySymbol(cleanCurrency);

    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(SESSION_CURRENCY_KEY, cleanCurrency);
      }
    } catch {
      // Ignorar restricciones de almacenamiento
    }

    set({
      currency: cleanCurrency,
      symbol: cleanSymbol,
      isLoading: false,
      isLoaded: true,
    });
  },

  clearCurrency: () => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(SESSION_CURRENCY_KEY);
      }
    } catch {}

    set({
      currency: null,
      symbol: null,
      isLoading: true,
      isLoaded: false,
    });
  },

  formatPrice: (amount, decimals = 2) => {
    const { symbol, isLoaded } = get();
    if (!isLoaded || !symbol) {
      return null;
    }
    const num = Number(amount ?? 0);
    const safeNum = isNaN(num) ? 0 : num;
    return `${symbol} ${safeNum.toFixed(decimals)}`;
  },
}));

/**
 * Hook para consumir la moneda actual con auto-carga en caso de no estar en sesión.
 */
export const useCurrency = () => {
  const currency = useCurrencyStore((s) => s.currency);
  const symbol = useCurrencyStore((s) => s.symbol);
  const isLoading = useCurrencyStore((s) => s.isLoading);
  const isLoaded = useCurrencyStore((s) => s.isLoaded);
  const fetchCurrency = useCurrencyStore((s) => s.fetchCurrency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const formatPrice = useCurrencyStore((s) => s.formatPrice);

  return {
    currency,
    symbol,
    isLoading: isLoading || !isLoaded || !symbol,
    isLoaded,
    fetchCurrency,
    setCurrency,
    formatPrice,
  };
};
