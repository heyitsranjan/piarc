/**
 * @module components/ui/Badge
 * Small inline label for status indicators (pinned, loading, etc.).
 */
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "accent" | "success" | "warn";

const variantClass: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-bg-2)] text-[var(--color-ink-5)]",
  accent: "bg-[var(--color-accent-dim)] text-[var(--color-accent)]",
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  warn: "bg-[var(--color-warn)]/15 text-[var(--color-warn)]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Pill-shaped status badge. */
export default function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center px-1.5 py-0.5",
        "rounded-full text-[10px] font-medium leading-none",
        variantClass[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
