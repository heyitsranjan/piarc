import type { ReactNode } from "react";

interface TerminalBottomBarProps {
  left?: ReactNode;
  right?: ReactNode;
}

export default function TerminalBottomBar({ left, right }: TerminalBottomBarProps) {
  return (
    <div
      className="flex min-h-6 shrink-0 items-center justify-between gap-3 border-t
        border-[var(--color-border)] bg-[var(--color-bg-raised)] px-2 py-1
        text-[9px] text-[var(--color-ink-9)]"
    >
      <span className="shrink-0">{left}</span>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}
