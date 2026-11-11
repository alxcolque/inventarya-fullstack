import { useCallback, useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  pointerWithin, rectIntersection, useDndContext, useDraggable, useDroppable,
  useSensor, useSensors, type CollisionDetection, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useCombinedRefs } from '@dnd-kit/utilities';
import { LuGripVertical } from 'react-icons/lu';
import { toast } from 'sonner';
import type { ICategoryResponse } from '@/interface';
import { categoryMoveError, sameId } from '../../../utils/categoryHierarchy';

class DesktopPointerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [{
    eventName: 'onPointerDown',
    handler: (event, options) => event.nativeEvent.pointerType !== 'touch'
      && PointerSensor.activators[0].handler(event, options),
  }];
}

// A pointer in a gap must not snap onto the nearest row.
export const categoryCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export const categoryKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.code)) return;
  event.preventDefault();
  const direction = ['ArrowDown', 'ArrowRight'].includes(event.code) ? 1 : -1;
  const targets = context.droppableContainers.getEnabled()
    .map((item) => {
      const rect = context.droppableRects.get(item.id) ?? (item.node.current as HTMLElement | null)?.getBoundingClientRect();
      return { id: item.id, rect };
    })
    .filter((item): item is { id: typeof item.id; rect: NonNullable<typeof item.rect> } => item.rect !== undefined)
    .sort((a, b) => a.rect.top - b.rect.top);
  const current = targets.findIndex((item) => item.id === context.over?.id);
  const next = targets[current < 0 ? (direction > 0 ? 0 : targets.length - 1) : current + direction];
  if (!next?.rect || !context.collisionRect) return currentCoordinates;
  return {
    x: currentCoordinates.x + next.rect.left + next.rect.width / 2 - context.collisionRect.left - context.collisionRect.width / 2,
    y: currentCoordinates.y + next.rect.top + next.rect.height / 2 - context.collisionRect.top - context.collisionRect.height / 2,
  };
};

export function CategoryDragHandle({ category, categories, disabled }: {
  category: ICategoryResponse; categories: ICategoryResponse[]; disabled: boolean;
}) {
  const { active } = useDndContext();
  const id = String(category.id);
  const isInvalid = active !== null && (
    sameId(categories.find((item) => sameId(item.id, active.id))?.parent_id, category.id)
    || categoryMoveError(categories, String(active.id), Number(category.id)) !== null
  );
  const drop = useDroppable({ id, disabled: disabled || isInvalid });
  const drag = useDraggable({ id, disabled });
  const rowRef = useCallback((element: HTMLButtonElement | null) => {
    drop.setNodeRef(element?.closest('tr') ?? null);
  }, [drop.setNodeRef]);
  const ref = useCombinedRefs(drag.setNodeRef, drag.setActivatorNodeRef, rowRef);
  return <button type="button" ref={ref} {...drag.attributes} {...drag.listeners}
    disabled={disabled} aria-label={'Mover categoría ' + category.name}
    className={'touch-manipulation rounded p-1 text-default-400 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 ' +
      (drag.isDragging ? 'cursor-grabbing' : 'cursor-grab')}>
    <LuGripVertical size={15} aria-hidden />
  </button>;
}

export const TABLE_HEADER_DROP_ID = 'category-table-header';

export interface CategoryDndRenderProps {
  activeId: string | null;
  overId: string | null;
  isHeaderOver: boolean;
  headerDropRef: (element: HTMLElement | null) => void;
  activeCategory: ICategoryResponse | null;
  isDraggingSubcategory: boolean;
}

function CategoryDndInner({
  categories,
  disabled,
  activeId,
  overId,
  children,
}: {
  categories: ICategoryResponse[];
  disabled: boolean;
  activeId: string | null;
  overId: string | null;
  children: (props: CategoryDndRenderProps) => ReactNode;
}) {
  const activeCategory = categories.find((item) => sameId(item.id, activeId)) ?? null;
  const isDraggingSubcategory = Boolean(activeCategory?.parent_id);

  const { setNodeRef, isOver } = useDroppable({
    id: TABLE_HEADER_DROP_ID,
    disabled: disabled || !isDraggingSubcategory,
  });

  const headerDropRef = useCallback((element: HTMLElement | null) => {
    const thead = (element?.querySelector?.('thead') as HTMLElement | null) ?? element;
    setNodeRef(thead);
  }, [setNodeRef]);

  return (
    <>
      {children({
        activeId,
        overId,
        isHeaderOver: isOver,
        headerDropRef,
        activeCategory,
        isDraggingSubcategory,
      })}
    </>
  );
}

export function CategoryDnd({ categories, disabled, onMove, children }: {
  categories: ICategoryResponse[]; disabled: boolean;
  onMove: (id: number, parentId: number | null) => Promise<boolean>;
  children: (props: CategoryDndRenderProps) => ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const activeCategory = categories.find((item) => sameId(item.id, activeId));
  const sensors = useSensors(
    useSensor(DesktopPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: categoryKeyboardCoordinates }),
  );
  const reset = () => { setActiveId(null); setOverId(null); };
  const label = (id: string | number) => {
    if (String(id) === TABLE_HEADER_DROP_ID) return 'encabezado (convertir en principal)';
    return categories.find((item) => sameId(item.id, id))?.name ?? 'categoría';
  };
  return <DndContext sensors={sensors} collisionDetection={categoryCollision}
    accessibility={{
      screenReaderInstructions: { draggable: 'Pulsa espacio para mover. Usa las flechas para elegir el destino, espacio para soltar y Escape para cancelar.' },
      announcements: {
        onDragStart: ({ active }) => 'Moviendo ' + label(active.id),
        onDragOver: ({ over }) => over ? 'Soltar en ' + label(over.id) : 'Fuera de un destino válido',
        onDragEnd: ({ over }) => over ? 'Moviendo hacia ' + label(over.id) : 'Sin cambios',
        onDragCancel: () => 'Movimiento cancelado',
      },
    }}
    onDragStart={({ active }) => {
      if (disabled) return;
      setActiveId(String(active.id));
    }}
    onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
    onDragCancel={reset}
    onDragEnd={({ active, over }) => {
      reset();
      if (disabled || !over) return;

      if (String(over.id) === TABLE_HEADER_DROP_ID) {
        const activeCat = categories.find((item) => sameId(item.id, active.id));
        if (!activeCat) return;
        if (!activeCat.parent_id) {
          toast.info('Esta categoría ya es principal.');
          return;
        }
        const error = categoryMoveError(categories, String(active.id), null);
        if (error) { toast.error(error); return; }
        void onMove(Number(active.id), null);
        return;
      }

      const targetParentId = Number(over.id);
      if (isNaN(targetParentId)) return;
      const error = categoryMoveError(categories, String(active.id), targetParentId);
      if (error) { toast.error(error); return; }
      void onMove(Number(active.id), targetParentId);
    }}>
    <CategoryDndInner
      categories={categories}
      disabled={disabled}
      activeId={activeId}
      overId={overId}
    >
      {children}
    </CategoryDndInner>
    <DragOverlay dropAnimation={null}>
      {activeCategory && <div className="pointer-events-none flex max-w-xs items-center gap-2 rounded-lg border border-primary/40 bg-content1 px-3 py-2 text-sm font-semibold text-foreground shadow-lg">
        <LuGripVertical aria-hidden />{activeCategory.name}
      </div>}
    </DragOverlay>
  </DndContext>;
}
