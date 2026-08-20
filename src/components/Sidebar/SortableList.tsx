/**
 * @module components/Sidebar/SortableList
 * dnd-kit wrappers for draggable sidebar rows.
 *
 * - SortableItem wraps a row, making it draggable via pointer/keyboard.
 * - SortableList provides the SortableContext.
 * - The DndContext lives in the Sidebar parent so onDragEnd can access store.
 *
 * Click vs drag is disambiguated by activationConstraint { distance: 8 } —
 * a pointer that moves < 8px is a click; beyond that it's a drag.
 */
import type { ReactNode } from "react";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

interface SortableItemProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
}

/** Wraps a row in sortable drag + drop. The whole row is the drag handle. */
export function SortableItem({ id, children, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isDragging && "opacity-50",
        !disabled && "cursor-grab active:cursor-grabbing"
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  );
}

interface SortableListProps {
  ids: string[];
  children: ReactNode;
  disabled?: boolean;
}

/** Provides the SortableContext for a list of sortable rows. */
export function SortableList({ ids, children, disabled }: SortableListProps) {
  return (
    <SortableContext
      items={ids}
      strategy={verticalListSortingStrategy}
      disabled={disabled}
    >
      {children}
    </SortableContext>
  );
}
