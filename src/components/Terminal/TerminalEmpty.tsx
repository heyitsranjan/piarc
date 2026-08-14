/**
 * @module components/Terminal/TerminalEmpty
 * Empty state when no session is active.
 */
import { Terminal } from "lucide-react";

export default function TerminalEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3
      select-none bg-[var(--color-bg)]">
      <Terminal size={28} strokeWidth={1.2} className="text-[var(--color-ink-9)]" />
      <p className="text-[13px] text-[var(--color-ink-7)]">
        Select a session to resume
      </p>
      <div className="flex gap-4 text-[11px] text-[var(--color-ink-9)]">
        <span>⌘K — command palette</span>
        <span>⌘B — toggle sidebar</span>
      </div>
    </div>
  );
}
