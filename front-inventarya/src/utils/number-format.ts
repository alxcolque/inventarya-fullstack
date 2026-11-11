/**
 * Utilidades de formateo numérico y monetario simplificado (Compact / Full).
 * Maneja abreviaciones para números de 4 dígitos o más:
 * - 1,000 -> 1k
 * - 10,500 -> 10.5k
 * - 1,000,000 -> 1M
 * - 1,000,000,000 -> 1B
 * Con soporte para visualización del valor original completo.
 */

export interface CompactFormatOptions {
  /** Cantidad máxima de decimales para la notación compacta (por defecto 2) */
  maxDecimals?: number;
  /** Cantidad fija de decimales para la notación completa (por defecto 2) */
  fullDecimals?: number;
  /** Umbral a partir del cual se abrevia (por defecto 1000, 4 dígitos) */
  threshold?: number;
  /** Si los sufijos deben ser en minúsculas (k, m, b) */
  lowercase?: boolean;
}

/**
 * Reconoce tanto punto (.) como coma (,) como separador decimal en entradas (inputs).
 * Ejemplos:
 * - "12,50" -> 12.5
 * - "12.50" -> 12.5
 * - "1.250,50" -> 1250.5
 * - "1,250.50" -> 1250.5
 * - 45.2 -> 45.2
 */
export const parseDecimalInput = (val: number | string | null | undefined): number => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  const str = String(val).trim();
  if (!str) return 0;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  let normalized = str;
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Formato 1.250,50 -> 1250.50
      normalized = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato 1,250.50 -> 1250.50
      normalized = str.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Formato 12,50 -> 12.50
    normalized = str.replace(",", ".");
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

/**
 * Normaliza una cadena de texto para que use exclusivamente el punto (.) como decimal,
 * permitiendo enviar valores válidos a APIs o cálculos matemáticos.
 */
export const normalizeDecimalString = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return String(val);

  const str = String(val).trim();
  if (!str) return "";

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      return str.replace(/\./g, "").replace(",", ".");
    } else {
      return str.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    return str.replace(",", ".");
  }

  return str;
};

/**
 * Convierte cualquier entrada a número seguro reconociendo coma o punto decimal.
 */
export const toSafeNumber = (val: number | string | null | undefined): number => {
  return parseDecimalInput(val);
};

/**
 * Formatea un número en formato completo con separadores de miles y decimales.
 * Ej: 1250.5 -> "1,250.50"
 */
export const formatFullNumber = (
  val: number | string | null | undefined,
  decimals: number = 2
): string => {
  const num = toSafeNumber(val);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formatea un número en formato compacto si alcanza o supera 4 dígitos (>= 1,000).
 * Ej:
 * - 950 -> "950" (o "950.00" si se solicitan decimales)
 * - 1000 -> "1k"
 * - 1250 -> "1.25k"
 * - 10500 -> "10.5k"
 * - 100000 -> "100k"
 * - 1000000 -> "1M"
 * - 1500000 -> "1.5M"
 * - 1200000000 -> "1.2B"
 */
export const formatCompactNumber = (
  val: number | string | null | undefined,
  options: CompactFormatOptions = {}
): string => {
  const num = toSafeNumber(val);
  const { maxDecimals = 2, threshold = 1000 } = options;

  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  // Si no llega al umbral (menos de 4 dígitos), mostrar con formato estándar
  if (abs < threshold) {
    // Si tiene decimales reales, mostrar hasta maxDecimals, si es entero mostrar entero
    const hasDecimals = abs % 1 !== 0;
    return (
      sign +
      abs.toLocaleString("en-US", {
        minimumFractionDigits: hasDecimals ? Math.min(2, maxDecimals) : 0,
        maximumFractionDigits: maxDecimals,
      })
    );
  }

  // Definición de escalas para miles (k), millones (m), miles de millones (b/B)
  const tiers = [
    { threshold: 1e9, suffix: options.lowercase !== false ? "b" : "B" },
    { threshold: 1e6, suffix: "m" },
    { threshold: 1e3, suffix: "k" },
  ];

  for (const tier of tiers) {
    if (abs >= tier.threshold) {
      const scaled = abs / tier.threshold;
      // Formatear eliminando ceros no significativos a la derecha
      let formatted = scaled.toFixed(maxDecimals);
      // Eliminar ceros al final tras el punto decimal
      if (formatted.includes(".")) {
        formatted = formatted.replace(/\.?0+$/, "");
      }
      return `${sign}${formatted}${tier.suffix}`;
    }
  }

  return num.toString();
};

/**
 * Retorna tanto el valor compacto como el valor largo completo para tooltips/modales.
 */
export const getNumberDisplayData = (
  val: number | string | null | undefined,
  options: {
    symbol?: string;
    isCurrency?: boolean;
    maxDecimals?: number;
    fullDecimals?: number;
    unit?: string;
  } = {}
) => {
  const num = toSafeNumber(val);
  const {
    symbol = "",
    isCurrency = false,
    maxDecimals = 2,
    fullDecimals = isCurrency ? 2 : 0,
    unit = "",
  } = options;

  const isCompactApplicable = Math.abs(num) >= 1000;
  const compactText = formatCompactNumber(num, { maxDecimals });
  const fullText = formatFullNumber(num, fullDecimals);

  const prefix = symbol ? `${symbol} ` : "";
  const suffix = unit ? ` ${unit}` : "";

  return {
    rawNumber: num,
    isCompact: isCompactApplicable,
    compactFormatted: `${prefix}${compactText}${suffix}`,
    fullFormatted: `${prefix}${fullText}${suffix}`,
  };
};
