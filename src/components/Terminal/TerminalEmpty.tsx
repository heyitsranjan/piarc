/**
 * @module components/Terminal/TerminalEmpty
 * Empty state when no session is active.
 */
import { Loader2, Terminal } from "lucide-react";

import { useOmpStore } from "@/store/omp";

const INSTALL_COMMAND = "brew install can1357/tap/omp";

export default function TerminalEmpty() {
  const status = useOmpStore((state) => state.status);
  const isLoading = useOmpStore((state) => state.isLoading);

  if (!status || isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--color-bg)]">
        <Loader2
          size={28}
          strokeWidth={1.2}
          className="animate-spin text-[var(--color-ink-9)]"
        />
        <p className="text-[13px] text-[var(--color-ink-7)]">
          Checking OMP installation…
        </p>
      </div>
    );
  }

  if (!status.installed) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg)] p-6">
        <section
          aria-labelledby="omp-setup-title"
          className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)]
            bg-[var(--color-bg-2)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.25)]"
        >
          <Terminal
            size={30}
            strokeWidth={1.3}
            className="mb-4 text-[var(--color-accent)]"
          />
          <h1
            id="omp-setup-title"
            className="text-[17px] font-semibold text-[var(--color-ink-0)]"
          >
            Install OMP to use PiArc
          </h1>
          <p className="mt-2 text-[12px] leading-5 text-[var(--color-ink-7)]">
            Run this command in Terminal, then reopen PiArc.
          </p>
          <code
            className="mt-5 block select-text rounded-[var(--radius-md)] border
              border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono
              text-[12px] text-[var(--color-ink-3)]"
          >
            {INSTALL_COMMAND}
          </code>
        </section>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3
        bg-[var(--color-bg)]"
    >
      <Terminal size={28} strokeWidth={1.2} className="text-[var(--color-ink-9)]" />
      <p className="text-[13px] text-[var(--color-ink-7)]">Select a session to resume</p>
      <div className="flex gap-4 text-[11px] text-[var(--color-ink-9)]">
        <span>⌘K — command palette</span>
        <span>⌘B — toggle sidebar</span>
      </div>
    </div>
  );
}
