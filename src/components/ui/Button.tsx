/**
 * @module components/ui/Button
 * Base button primitive used throughout the app.
 * Supports three variants: default, ghost, and danger.
 */
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Defaults to "ghost". */
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  default: "bg-[var(--color-accent)] text-white hover:opacity-90 active:opacity-75",
  ghost:
    "text-[var(--color-ink-5)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)]",
  danger: "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10",
};

/**
 * Accessible button with consistent focus ring, disabled state,
 * and three visual variants aligned to the omp.sh design system.
 */
export default function Button({
  variant = "ghost",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5",
        "rounded-[var(--radius-sm)] px-2 py-1 text-xs",
        "transition-colors duration-[var(--duration-fast)]",
        "disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]",
        variantClass[variant],
        className
      )}
    >
      {children}
    </button>
  );
}
