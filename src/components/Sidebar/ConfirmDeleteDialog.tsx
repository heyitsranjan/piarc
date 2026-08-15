import { useEffect, useRef } from "react";

import { createPortal } from "react-dom";

import { Trash2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteDialog({
  title,
  message,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60
        backdrop-blur-[2px] palette-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-message"
        className="mx-4 w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)]
          border border-[var(--color-border)] bg-[var(--color-bg-2)] palette-panel
          shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3">
          <Trash2 size={15} strokeWidth={1.8} className="text-[var(--color-danger)]" />
          <h2
            id="delete-dialog-title"
            className="text-[13px] font-semibold text-[var(--color-ink-0)]"
          >
            {title}
          </h2>
        </div>

        <p
          id="delete-dialog-message"
          className="px-4 py-4 text-[12px] leading-5 text-[var(--color-ink-5)]"
        >
          {message}
        </p>

        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3.5
              text-[12px] text-[var(--color-ink-5)] transition-colors duration-[var(--duration-fast)]
              hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-1)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 rounded-[var(--radius-sm)] bg-[var(--color-danger)] px-3.5
              text-[12px] font-medium text-white transition-opacity duration-[var(--duration-fast)]
              hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
