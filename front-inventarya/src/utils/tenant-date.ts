import { useSettingStore } from "@/modules/tenant/settings/store/settings/settings.store";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Obtiene la zona horaria activa del tenant desde useSettingStore (settings.timezone).
 * Si no está disponible o no es válida, retorna 'America/La_Paz' por defecto.
 */
export const getTenantTimezone = (): string => {
  try {
    const tz = useSettingStore.getState().systemData?.timezone;
    if (tz && typeof tz === "string" && tz.trim().length > 0) {
      return tz.trim();
    }
  } catch {
    // Si no está inicializado zustand
  }
  return "America/La_Paz";
};

/**
 * Parsea de manera segura cualquier timestamp del backend (MySQL / Laravel / ISO)
 * tratándolo como UTC si no especifica zona, para que luego Intl.DateTimeFormat
 * pueda proyectarlo con precisión matemática a la zona horaria del tenant.
 */
export const parseToUtcDate = (dateInput: string | Date | number): Date => {
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === "number") return new Date(dateInput);

  const cleanStr = String(dateInput).trim();
  if (!cleanStr) return new Date(NaN);

  if (cleanStr.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(cleanStr)) {
    return new Date(cleanStr);
  }
  if (cleanStr.includes("T")) {
    return new Date(`${cleanStr}Z`);
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(cleanStr)) {
    return new Date(`${cleanStr.replace(" ", "T")}Z`);
  }
  return new Date(cleanStr);
};

/**
 * Convierte cualquier fecha/timestamp a string "YYYY-MM-DD" respetando el timezone del tenant.
 */
export const toTenantDateString = (
  dateInput: string | Date | number | null | undefined,
  timeZone: string = getTenantTimezone()
): string => {
  if (!dateInput) return "";

  // Si ya viene como YYYY-MM-DD directamente (ej. sale_date)
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  try {
    const date = parseToUtcDate(dateInput);
    if (isNaN(date.getTime())) return "";

    // "en-CA" formatea naturalmente como YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return formatter.format(date);
  } catch (error) {
    console.error("Error toTenantDateString:", error);
    return "";
  }
};

/**
 * Obtiene la fecha de "hoy" (YYYY-MM-DD) según el timezone del tenant.
 */
export const getTenantTodayString = (timeZone: string = getTenantTimezone()): string => {
  return toTenantDateString(new Date(), timeZone);
};

/**
 * Extrae componentes de fecha y hora ajustados a la zona horaria del tenant.
 */
export const getTenantDateParts = (
  dateInput: string | Date | number = new Date(),
  timeZone: string = getTenantTimezone()
) => {
  const date = parseToUtcDate(dateInput);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10); // 1-12
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);

  return { year, month, day, hour, minute, second };
};

/**
 * Formatea una fecha respetando el timezone del tenant.
 * Soporta patrones comunes como:
 * - "dd/MM/yyyy"
 * - "dd/MM/yyyy HH:mm"
 * - "HH:mm"
 * - "HH:mm:ss"
 * - "EEEE, dd 'de' MMMM 'de' yyyy"
 * - "MMMM yyyy"
 */
export const formatTenantDate = (
  dateInput: string | Date | number,
  pattern: string,
  timeZone: string = getTenantTimezone()
): string => {
  if (!dateInput) return "";

  try {
    const { year, month, day, hour, minute, second } = getTenantDateParts(dateInput, timeZone);
    // Creamos un Date local con los componentes exactos calculados en la zona horaria del tenant
    const localZonedDate = new Date(year, month - 1, day, hour, minute, second);
    return format(localZonedDate, pattern, { locale: es });
  } catch (err) {
    console.error("Error formatting tenant date:", err);
    return "";
  }
};

/**
 * Calcula rangos de fechas (start, end, label) para filtros ("today", "this_week", "this_month", "last_month", "all")
 * computados en la zona horaria del tenant.
 */
export const getTenantDateRange = (
  period: string,
  customStart?: string,
  customEnd?: string,
  timeZone: string = getTenantTimezone()
): { start: string; end: string; label: string } => {
  const { year, month, day, hour, minute, second } = getTenantDateParts(new Date(), timeZone);
  const zonedNow = new Date(year, month - 1, day, hour, minute, second);

  const pad = (n: number) => String(n).padStart(2, "0");

  switch (period) {
    case "today": {
      const todayStr = `${year}-${pad(month)}-${pad(day)}`;
      const label = `Hoy (${pad(day)}/${pad(month)}/${year})`;
      return { start: todayStr, end: todayStr, label };
    }

    case "this_week": {
      // Semana de lunes a domingo
      const dayOfWeek = zonedNow.getDay(); // 0: domingo, 1: lunes...
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(zonedNow);
      monday.setDate(zonedNow.getDate() - diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const start = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      const end = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
      return { start, end, label: "Esta Semana" };
    }

    case "this_month": {
      const start = `${year}-${pad(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${pad(month)}-${pad(lastDay)}`;
      const monthLabel = format(zonedNow, "MMMM yyyy", { locale: es });
      return { start, end, label: monthLabel };
    }

    case "last_month": {
      const lastMonthYear = month === 1 ? year - 1 : year;
      const lastMonthNum = month === 1 ? 12 : month - 1;
      const start = `${lastMonthYear}-${pad(lastMonthNum)}-01`;
      const lastDay = new Date(lastMonthYear, lastMonthNum, 0).getDate();
      const end = `${lastMonthYear}-${pad(lastMonthNum)}-${pad(lastDay)}`;
      const lastMonthDate = new Date(lastMonthYear, lastMonthNum - 1, 1);
      const monthLabel = format(lastMonthDate, "MMMM yyyy", { locale: es });
      return { start, end, label: monthLabel };
    }

    case "custom": {
      const label =
        customStart && customEnd
          ? `Del ${customStart} al ${customEnd}`
          : customStart
            ? `Desde ${customStart}`
            : "Personalizado";
      return { start: customStart || "", end: customEnd || "", label };
    }

    case "all":
    default:
      return { start: "", end: "", label: "Todo el Historial" };
  }
};
