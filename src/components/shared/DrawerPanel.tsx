/**
 * @module components/shared/DrawerPanel
 * Reusable right-edge panel frame shared by file explorer, git, notes, and
 * any future workspace drawers.
 *
 * Handles:
 * - Absolute positioning within the workbench (`absolute inset-y-0 right-0`)
 * - Shared visual chrome: bg, border, shadow
 * - Escape key → onClose
 *
 * Width and any extra attributes (data-*, style, CSS variables) are passed
 * by the caller via `className` / `style` / spread props.
 */
import { type HTMLAttributes, type ReactNode, useEffect } from "react";

import { cn } from "@/lib/utils";

interface DrawerPanelProps extends HTMLAttributes<HTMLElement> {
  /** Called when the user presses Escape. */
  onClose: () => void;
  children: ReactNode;
}

export default function DrawerPanel({
  onClose,
  children,
  className,
  ...rest
}: DrawerPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <aside
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex flex-col overflow-hidden",
        "border-l border-[var(--color-border)] bg-[var(--color-bg-elev)]",
        "shadow-[-16px_0_32px_rgba(0,0,0,0.28)]",
        className
      )}
      {...rest}
    >
      {children}
    </aside>
  );
}
