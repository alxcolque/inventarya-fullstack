export interface PresetPrimaryColor {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export const PRESET_PRIMARY_COLORS: PresetPrimaryColor[] = [
  {
    id: "blue",
    name: "Azul Clásico",
    hex: "#3b82f6",
    description: "Predeterminado, sobrio y profesional",
  },
  {
    id: "indigo",
    name: "Índigo",
    hex: "#6366f1",
    description: "Moderno, tecnológico e intuitivo",
  },
  {
    id: "emerald",
    name: "Esmeralda",
    hex: "#10b981",
    description: "Fresco, vital y orientado a finanzas",
  },
  {
    id: "amber",
    name: "Ámbar / Naranja",
    hex: "#f59e0b",
    description: "Cálido, enérgico y llamativo",
  },
  {
    id: "rose",
    name: "Rosa / Coral",
    hex: "#f43f5e",
    description: "Vibrante, elegante y comercial",
  },
  {
    id: "cyan",
    name: "Cian / Turquesa",
    hex: "#06b6d4",
    description: "Limpio, ligero y tecnológico",
  },
  {
    id: "violet",
    name: "Violeta",
    hex: "#8b5cf6",
    description: "Creativo, exclusivo y sofisticado",
  },
];

export const DEFAULT_PRIMARY_COLOR = "#3b82f6";
const STORAGE_KEY = "tenant_primary_color";

/**
 * Convierte un código hexadecimal (#RRGGBB o #RGB) a HSL [h, s, l].
 */
export function hexToHsl(hex: string): [number, number, number] {
  let cleaned = (hex || "").replace("#", "").trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleaned.length !== 6) {
    return [217, 91, 60]; // Fallback #3b82f6
  }

  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Obtiene el color primario almacenado localmente o el por defecto.
 */
export function getStoredPrimaryColor(): string {
  if (typeof window === "undefined") return DEFAULT_PRIMARY_COLOR;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PRIMARY_COLOR;
  } catch {
    return DEFAULT_PRIMARY_COLOR;
  }
}

/**
 * Aplica de forma dinámica y reactiva el color de tema primario en todo el proyecto.
 * Configura las variables CSS nativas de NextUI y Tailwind para sincronizar
 * botones, chips, tabs, inputs, sombras e iconos primarios al instante.
 */
export function applyPrimaryColorTheme(hex?: string | null): void {
  if (typeof document === "undefined") return;

  const targetHex = hex?.trim() ? hex.trim() : DEFAULT_PRIMARY_COLOR;
  const [h, s, l] = hexToHsl(targetHex);

  const root = document.documentElement;

  // NextUI y Tailwind tokens en formato HSL
  root.style.setProperty("--nextui-primary", `${h} ${s}% ${l}%`);
  root.style.setProperty("--nextui-primary-50", `${h} ${Math.min(s, 95)}% 97%`);
  root.style.setProperty("--nextui-primary-100", `${h} ${Math.min(s, 92)}% 93%`);
  root.style.setProperty("--nextui-primary-200", `${h} ${Math.min(s, 88)}% 84%`);
  root.style.setProperty("--nextui-primary-300", `${h} ${Math.min(s, 86)}% 72%`);
  root.style.setProperty("--nextui-primary-400", `${h} ${s}% 60%`);
  root.style.setProperty("--nextui-primary-500", `${h} ${s}% ${l}%`);
  root.style.setProperty("--nextui-primary-600", `${h} ${s}% ${Math.max(12, l - 8)}%`);
  root.style.setProperty("--nextui-primary-700", `${h} ${s}% ${Math.max(10, l - 16)}%`);
  root.style.setProperty("--nextui-primary-800", `${h} ${s}% ${Math.max(8, l - 24)}%`);
  root.style.setProperty("--nextui-primary-900", `${h} ${s}% ${Math.max(6, l - 32)}%`);

  // Contraste para el texto sobre el color primario
  const isLight = l > 65 || (h >= 40 && h <= 70 && l > 50);
  root.style.setProperty("--nextui-primary-foreground", isLight ? "0 0% 0%" : "0 0% 100%");

  // Variable de apoyo hexadecimal
  root.style.setProperty("--primary-color", targetHex);

  try {
    localStorage.setItem(STORAGE_KEY, targetHex);
  } catch {
    // ignore storage error
  }
}

// Auto-inicialización al cargar en navegador
if (typeof window !== "undefined") {
  applyPrimaryColorTheme(getStoredPrimaryColor());
}
