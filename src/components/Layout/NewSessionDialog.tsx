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
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
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
      className="arc-dialog-backdrop palette-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Create"
        className="arc-dialog-panel palette-panel mx-5 w-[390px] max-w-[calc(100vw-40px)] overflow-hidden border"
      >
        <div className="arc-dialog-header relative flex flex-col justify-center border-b border-[var(--color-border)]">
          <h2 className="arc-dialog-title text-[var(--color-ink-0)]">Create</h2>
          <p className="arc-dialog-subtitle">Start PiArc or open a plain terminal.</p>
          <kbd className="absolute right-[15px] top-1/2 -translate-y-1/2 border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[8px] text-[var(--color-ink-9)]">
            esc
          </kbd>
        </div>
        <div className="arc-dialog-body grid">
          <Choice
            autoFocus
            icon={<Bot size={18} strokeWidth={1.7} />}
            title="PiArc session"
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
      className="mb-2 flex h-[58px] items-center gap-2.5 rounded-[4px] border border-[var(--color-border)]
        bg-[#101217] p-[11px] text-left transition-colors hover:border-[#4a5041]
        hover:bg-[#151913] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="grid size-[34px] shrink-0 place-items-center rounded-[4px] border border-[#444a3d] text-[var(--color-accent)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold text-[var(--color-ink-0)]">
          {title}
        </span>
        <span className="mt-1 block font-mono text-[8px] text-[var(--color-ink-9)]">
          {description}
        </span>
      </span>
      <kbd className="ml-auto font-mono text-[8px] text-[var(--color-ink-9)]">
        {shortcut}
      </kbd>
    </button>
  );
}
