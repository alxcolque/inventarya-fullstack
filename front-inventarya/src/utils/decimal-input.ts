import { normalizeDecimalString } from "./number-format";

/**
 * Determina si un elemento HTML es un campo de entrada numérico o monetario.
 */
function isNumericInputElement(el: EventTarget | null): el is HTMLInputElement {
  if (!el || !(el instanceof HTMLInputElement)) return false;

  // Tipo nativo number
  if (el.type === "number") return true;

  // Atributos de modo numérico/decimal
  if (el.inputMode === "decimal" || el.inputMode === "numeric") return true;
  if (el.hasAttribute("step")) return true;

  // Nombres o identificadores comunes de campos numéricos en formularios
  const identifier = `${el.name || ""} ${el.id || ""} ${el.getAttribute("aria-label") || ""} ${el.placeholder || ""}`.toLowerCase();
  const numericKeywords = [
    "price",
    "precio",
    "cost",
    "costo",
    "quantity",
    "cantidad",
    "amount",
    "monto",
    "total",
    "discount",
    "descuento",
    "stock",
    "cash",
    "efectivo",
    "cambio",
    "pago",
    "subtotal",
  ];

  return numericKeywords.some((kw) => identifier.includes(kw));
}

/**
 * Inserta texto en el input simulando la entrada de usuario nativa para activar los listeners de React.
 */
function insertTextIntoInput(input: HTMLInputElement, text: string) {
  // 1. Intentar con document.execCommand para máxima compatibilidad con el árbol de React
  try {
    const success = document.execCommand("insertText", false, text);
    if (success) return;
  } catch {
    // Si falla o no está disponible, continuar con alternativa
  }

  // 2. Si el tipo es number o texto, despachar evento de entrada manual
  try {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const oldValue = input.value;
    const newValue = oldValue.slice(0, start) + text + oldValue.slice(end);

    // React sobreescribe el setter de value en HTMLInputElement
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, newValue);
    } else {
      input.value = newValue;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // Restaurar posición del cursor si no es type="number"
    if (input.type !== "number") {
      input.setSelectionRange(start + text.length, start + text.length);
    }
  } catch (err) {
    console.debug("DecimalInput fallback error:", err);
  }
}

let isInitialized = false;

/**
 * Inicializa el interceptor global para reconocer la coma (,) como punto (.) decimal
 * en todos los inputs numéricos del sistema.
 */
export function initDecimalInputInterceptor() {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;

  // 1. Interceptar pulsación de teclas (Keydown)
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      // Si la tecla presionada es coma (,) o el separador decimal de teclado numérico
      if (e.key === "," || e.code === "NumpadDecimal" || e.key === "Decimal") {
        const target = e.target;
        if (isNumericInputElement(target)) {
          // Prevenir la inserción por defecto de la coma
          e.preventDefault();
          e.stopPropagation();

          // Si el input ya tiene un punto decimal, no duplicarlo
          if (target.value && target.value.includes(".")) {
            return;
          }

          // Insertar el punto decimal (.) reconocido por el navegador y React
          insertTextIntoInput(target, ".");
        }
      }
    },
    true
  );

  // 2. Interceptar evento beforeinput para teclados virtuales / móviles
  window.addEventListener(
    "beforeinput",
    (e: InputEvent) => {
      if (e.data === ",") {
        const target = e.target;
        if (isNumericInputElement(target)) {
          e.preventDefault();
          if (target.value && target.value.includes(".")) {
            return;
          }
          insertTextIntoInput(target, ".");
        }
      }
    },
    true
  );

  // 3. Interceptar evento paste para normalizar números pegados con coma ej. "12,50" -> "12.50"
  window.addEventListener(
    "paste",
    (e: ClipboardEvent) => {
      const target = e.target;
      if (isNumericInputElement(target)) {
        const pastedText = e.clipboardData?.getData("text");
        if (pastedText && pastedText.includes(",")) {
          const normalized = normalizeDecimalString(pastedText);
          if (normalized !== pastedText && /^-?\d*(\.\d*)?$/.test(normalized)) {
            e.preventDefault();
            insertTextIntoInput(target, normalized);
          }
        }
      }
    },
    true
  );
}
