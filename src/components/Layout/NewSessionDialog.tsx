import { type ReactNode, useEffect } from "react";

import { Bot, TerminalSquare } from "lucide-react";

interface NewSessionDialogProps {
  busy: boolean;
  ompAvailable: boolean;
  onClose: () => void;
  onNewSession: () => Promise<void>;
  onTerminal: () => Promise<void>;
}

export default function NewSessionDialog({
  ompAvailable,
  busy,
  onClose,
  onNewSession,
  onTerminal,
}: NewSessionDialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const choose = (action: () => Promise<void>) => {
    onClose();
    void action();
  };

  return (
    <div
      className="palette-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Create"
        className="palette-panel mx-4 w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border
          border-[var(--color-border)] bg-[var(--color-bg-2)] shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
      >
        <div className="border-b border-[var(--color-border)] px-4 py-3.5">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-0)]">Create</h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-7)]">
            Start OMPX or open a plain terminal.
          </p>
        </div>
        <div className="grid gap-2 p-3">
          <Choice
            autoFocus
            icon={<Bot size={18} strokeWidth={1.7} />}
            title="OMPX session"
            description={
              ompAvailable ? "Start a new omp session" : "Install omp to create sessions"
            }
            shortcut="⌘⇧N"
            disabled={busy || !ompAvailable}
            onClick={() => choose(onNewSession)}
          />
          <Choice
            icon={<TerminalSquare size={18} strokeWidth={1.7} />}
            title="Terminal"
            description="Open your login shell"
            shortcut="⌘T"
            disabled={busy}
            onClick={() => choose(onTerminal)}
          />
        </div>
      </div>
    </div>
  );
}

function Choice({
  autoFocus = false,
  icon,
  title,
  description,
  shortcut,
  disabled,
  onClick,
}: {
  autoFocus?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  shortcut: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      autoFocus={autoFocus}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)]
        bg-[var(--color-bg)] px-3 py-3 text-left transition-colors hover:border-[var(--color-border-strong)]
        hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="text-[var(--color-accent)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-[var(--color-ink-1)]">
          {title}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-[var(--color-ink-7)]">
          {description}
        </span>
      </span>
      <kbd className="ml-auto text-[10px] text-[var(--color-ink-9)]">{shortcut}</kbd>
    </button>
  );
}
