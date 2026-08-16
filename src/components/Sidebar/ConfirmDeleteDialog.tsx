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
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="arc-dialog-backdrop fixed inset-0 z-[10000] flex items-center justify-center palette-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-message"
        className="arc-dialog-panel palette-panel mx-5 w-[390px] max-w-[calc(100vw-40px)] overflow-hidden border"
      >
        <div className="arc-dialog-header flex items-center gap-2.5 border-b border-[var(--color-border)]">
          <Trash2 size={15} strokeWidth={1.8} className="text-[var(--color-danger)]" />
          <h2
            id="delete-dialog-title"
            className="arc-dialog-title text-[var(--color-ink-0)]"
          >
            {title}
          </h2>
        </div>

        <p
          id="delete-dialog-message"
          className="arc-dialog-body font-mono text-[9px] leading-5 text-[var(--color-ink-5)]"
        >
          {message}
        </p>

        <div className="flex items-center justify-end gap-2 px-[15px] pb-[14px]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="arc-dialog-button h-8 border border-[var(--color-border)] px-3.5 text-[var(--color-ink-5)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-1)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="arc-dialog-button h-8 bg-[var(--color-danger)] px-3.5 text-white hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
