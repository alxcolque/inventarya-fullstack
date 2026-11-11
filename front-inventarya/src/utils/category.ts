/**
 * Utilidades compartidas para manejo y formateo de categorías en el sistema.
 */

/**
 * Extrae de forma limpia el nombre simple de la categoría final (nodo hoja)
 * eliminando cualquier ancestro o jerarquía concatenada con ' > ', '>', ' / ' o '/'.
 * 
 * Ejemplos:
 *  - "Tecnología > Computación > Laptops" -> "Laptops"
 *  - "Bebidas / Gaseosas" -> "Gaseosas"
 *  - "Abarrotes" -> "Abarrotes"
 */
export const getLeafCategoryName = (categoryName?: string | null): string => {
  if (!categoryName || typeof categoryName !== "string") return "";
  const trimmed = categoryName.trim();
  if (!trimmed) return "";

  if (trimmed.includes(">")) {
    const parts = trimmed.split(">");
    const leaf = parts[parts.length - 1].trim();
    return leaf || trimmed;
  }

  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    const leaf = parts[parts.length - 1].trim();
    return leaf || trimmed;
  }

  return trimmed;
};
