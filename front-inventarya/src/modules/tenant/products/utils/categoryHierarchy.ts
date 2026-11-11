import type { ICategoryResponse } from '@/interface';

export const sameId = (a: string | number | null | undefined, b: string | number | null | undefined) =>
  String(a ?? '') === String(b ?? '');

/**
 * Comprueba si targetId es descendiente (hija, nieta, etc.) de ancestorId en el árbol.
 */
export function isDescendant(items: ICategoryResponse[], ancestorId: string | number, targetId: string | number): boolean {
  if (sameId(ancestorId, targetId)) return true;
  let current = items.find((c) => sameId(c.id, targetId));
  const visited = new Set<string>();

  while (current && current.parent_id != null) {
    const pid = String(current.parent_id);
    if (visited.has(pid)) break; // previene loops infinitos en datos corruptos
    visited.add(pid);

    if (sameId(pid, ancestorId)) {
      return true;
    }
    current = items.find((c) => sameId(c.id, current?.parent_id));
  }
  return false;
}

export function categoryMoveError(items: ICategoryResponse[], id: number | string, parentId: number | null): string | null {
  const category = items.find((item) => sameId(item.id, id));
  if (!category) return 'Categoría no encontrada.';
  if (parentId === null) {
    if (category.parent_id == null) {
      return 'Esta categoría ya es principal.';
    }
    return null;
  }
  if (sameId(id, parentId)) return 'Una categoría no puede ser padre de sí misma.';
  const parent = items.find((item) => sameId(item.id, parentId));
  if (!parent) return 'La categoría superior seleccionada no existe.';
  
  // Evitar ciclos jerárquicos: no se puede mover una categoría a sí misma o a una de sus subcategorías
  if (isDescendant(items, id, parentId)) {
    return 'No puedes mover una categoría dentro de sí misma o de una de sus subcategorías.';
  }

  return null;
}

/** Construye la ruta jerárquica completa (ej: "Tecnología > Computación > Laptops"). */
export function getCategoryFullPath(items: ICategoryResponse[], item: ICategoryResponse): string {
  const names: string[] = [item.name];
  let currentParentId = item.parent_id;
  const visited = new Set<string>();

  while (currentParentId != null) {
    const pid = String(currentParentId);
    if (visited.has(pid)) break;
    visited.add(pid);

    const parent = items.find((c) => sameId(c.id, currentParentId));
    if (!parent) break;
    names.unshift(parent.name);
    currentParentId = parent.parent_id;
  }
  return names.join(' > ');
}

/** Reconstruye los metadatos de jerarquía manteniendo intactos los productos y contadores. */
export function withCategoryParent(items: ICategoryResponse[], id: number | string, parentId: number | null): ICategoryResponse[] {
  const changed = items.map((item) => sameId(item.id, id) ? { ...item, parent_id: parentId } : item);
  return changed.map((item) => {
    const parent = changed.find((candidate) => sameId(candidate.id, item.parent_id));
    return {
      ...item,
      parent: parent ? { id: Number(parent.id), name: parent.name, slug: parent.slug } : null,
      parent_name: parent?.name ?? null,
      full_path: getCategoryFullPath(changed, item),
      children: changed.filter((child) => sameId(child.parent_id, item.id)).map(({ children: _children, ...child }) => child),
    };
  });
}
