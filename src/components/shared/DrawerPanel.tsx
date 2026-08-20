/**
 * @module components/shared/DrawerPanel
 * Reusable right-edge panel frame shared by file explorer, git, notes, and
 * any future workspace drawers.
 *
 * Handles:
 * - Absolute positioning within the workbench (`absolute inset-y-0 right-0`)
 * - Shared visual chrome: bg, border, shadow
 * - Left-edge drag resize handle with localStorage persistence
 * - Escape key → onClose
 *
 * Pass `storageKey` + `defaultWidth` + `minWidth` to opt into resizing.
 * `maxWidth` may be a number or a function (evaluated on each drag event).
 * `onWidthChange` fires whenever the width changes (used by WorkspacePanel
 * to keep its internal tree-width in sync).
 */
import {
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

interface DrawerPanelProps extends HTMLAttributes<HTMLElement> {
  /** Called when the user presses Escape. */
  onClose: () => void;
  children: ReactNode;
  /** localStorage key — enables the resize handle when provided. */
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  /** Number or function returning the max allowed width. */
  maxWidth?: number | (() => number);
  /** Fires after every width change so callers can react (e.g. clamp tree width). */
  onWidthChange?: (width: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readWidth(key: string, defaultWidth: number) {
  const saved = Number.parseInt(localStorage.getItem(key) ?? "", 10);
  return Number.isFinite(saved) ? saved : defaultWidth;
}

export default function DrawerPanel({
  onClose,
  children,
  className,
  storageKey,
  defaultWidth = 320,
  minWidth = 240,
  maxWidth,
  onWidthChange,
  style,
  ...rest
}: DrawerPanelProps) {
  const resizable = Boolean(storageKey);
  const [width, setWidth] = useState(() =>
    storageKey ? readWidth(storageKey, defaultWidth) : defaultWidth
  );
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Escape → close
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

  // Drag resize
  useEffect(() => {
    if (!resizable) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const max =
        typeof maxWidth === "function"
          ? maxWidth()
          : (maxWidth ?? window.innerWidth - 200);
      const next = clamp(
        dragStartWidth.current + dragStartX.current - e.clientX,
        minWidth,
        max
      );
      widthRef.current = next;
      setWidth(next);
      onWidthChange?.(next);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) {
        localStorage.setItem(storageKey, String(Math.round(widthRef.current)));
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizable, minWidth, maxWidth, storageKey, onWidthChange]);

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current =
      e.currentTarget.parentElement?.getBoundingClientRect().width ?? width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const panelStyle: CSSProperties = resizable ? { width, ...style } : { ...style };

  return (
    <aside
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex flex-col overflow-hidden",
        "border-l border-[var(--color-border)] bg-[var(--color-bg-elev)]",
        "shadow-[-16px_0_32px_rgba(0,0,0,0.28)]",
        className
      )}
      style={panelStyle}
      {...rest}
    >
      {/* Left-edge resize handle — same on every panel */}
      {resizable && (
        <div
          role="separator"
          aria-label="Resize panel"
          aria-orientation="vertical"
          onMouseDown={startResize}
          className="group absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize"
        >
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2
              bg-[var(--color-border)] transition-colors
              duration-[var(--duration-fast)] group-hover:bg-[var(--color-accent)]"
          />
        </div>
      )}
      {children}
    </aside>
  );
}
