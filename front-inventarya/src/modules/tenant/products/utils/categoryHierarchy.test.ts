import { describe, it, expect } from 'vitest';
import { categoryMoveError, withCategoryParent } from './categoryHierarchy';
import type { ICategoryResponse } from '@/interface';

describe('categoryHierarchy', () => {
  const categories: ICategoryResponse[] = [
    { id: 1, name: 'Bebidas', slug: 'bebidas', parent_id: null, color: '#333' } as ICategoryResponse,
    { id: 2, name: 'Gaseosas', slug: 'gaseosas', parent_id: 1, color: '#444' } as ICategoryResponse,
    { id: 3, name: 'Cola', slug: 'cola', parent_id: 2, color: '#555' } as ICategoryResponse,
    { id: 4, name: 'Snacks', slug: 'snacks', parent_id: null, color: '#666' } as ICategoryResponse,
  ];

  it('allows moving a subcategory to root (parentId === null) to convert it into a parent category', () => {
    // Category 2 is currently subcategory of 1
    const err = categoryMoveError(categories, 2, null);
    expect(err).toBeNull();
  });

  it('rejects moving a category that is already a root to root (parentId === null)', () => {
    // Category 1 is already root
    const err = categoryMoveError(categories, 1, null);
    expect(err).toBe('Esta categoría ya es principal.');
  });

  it('rejects moving a category to be its own parent', () => {
    const err = categoryMoveError(categories, 2, 2);
    expect(err).toBe('Una categoría no puede ser padre de sí misma.');
  });

  it('rejects circular hierarchy when moving a category inside its descendant', () => {
    // Trying to move 1 into 3 (which is child of 2 which is child of 1)
    const err = categoryMoveError(categories, 1, 3);
    expect(err).toBe('No puedes mover una categoría dentro de sí misma o de una de sus subcategorías.');
  });

  it('correctly updates hierarchy state with withCategoryParent when converted to root', () => {
    const updated = withCategoryParent(categories, 2, null);
    const cat2 = updated.find((c) => c.id === 2);
    expect(cat2?.parent_id).toBeNull();
    expect(cat2?.parent).toBeNull();
    expect(cat2?.parent_name).toBeNull();
  });
});
