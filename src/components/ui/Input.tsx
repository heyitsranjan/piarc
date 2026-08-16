import type { ReactNode } from "react";

/**
 * @module components/ui/Input
 * Base text input primitive — forwards refs for focus control.
 */
import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered on the left inside the input. */
  leftIcon?: ReactNode;
  /** Element rendered on the right inside the input (e.g. clear button). */
  rightSlot?: ReactNode;
}

/**
 * Styled input with optional left icon and right slot.
 * Forwarded ref lets callers call `.focus()` directly.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightSlot, className, ...props }, ref) => (
    <div className="relative flex items-center w-full">
      {leftIcon && (
        <span className="absolute left-2.5 text-[var(--color-ink-7)] pointer-events-none">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        {...props}
        className={cn(
          "w-full rounded-[var(--radius-sm)] text-xs",
          "bg-[var(--color-bg-2)] text-[var(--color-ink-1)]",
          "placeholder:text-[var(--color-ink-7)]",
          "border border-[var(--color-border-2)]",
          "focus:outline-none",
          "transition-colors duration-[var(--duration-fast)]",
          leftIcon ? "pl-7" : "pl-2.5",
          rightSlot ? "pr-7" : "pr-2.5",
          "py-1.5",
          className
        )}
      />
      {rightSlot && <span className="absolute right-2">{rightSlot}</span>}
    </div>
  )
);

Input.displayName = "Input";
export default Input;
