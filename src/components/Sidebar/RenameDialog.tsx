/**
 * @module components/Sidebar/RenameDialog
 * Modal dialog for renaming an omp session.
 */
import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { OmpSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";

interface RenameDialogProps {
  session: OmpSession;
  onClose: () => void;
}

export default function RenameDialog({ session, onClose }: RenameDialogProps) {
  const [value,  setValue]  = useState(session.title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { renameSession } = useSessionStore();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === session.title) { onClose(); return; }
    setSaving(true);
    await renameSession(session.path, trimmed);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
        bg-black/60 backdrop-blur-[2px] palette-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-label="Rename session"
        aria-modal
        className="w-full max-w-sm mx-4 palette-panel
          bg-[var(--color-bg-2)] border border-[var(--color-border)]
          rounded-[var(--radius-lg)]
          shadow-[0_24px_64px_rgba(0,0,0,0.65)]
          overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3
          border-b border-[var(--color-border)]">
          <Pencil size={14} strokeWidth={1.8} className="text-[var(--color-ink-7)]" />
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--color-ink-0)]">
              Rename session
            </h2>
            <p className="text-[10.5px] text-[var(--color-ink-9)] mt-0.5 truncate font-mono">
              {session.path.split("/").slice(-2).join("/")}
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  handleSave();
              if (e.key === "Escape") onClose();
            }}
            placeholder="Session title"
            className={cn(
              "w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)]",
              "bg-[var(--color-bg-hover)] text-[var(--color-ink-0)]",
              "border border-[var(--color-border-strong)]",
              "focus:outline-none focus:border-[var(--color-accent)]",
              "placeholder:text-[var(--color-ink-9)]",
              "transition-colors duration-[var(--duration-fast)]"
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="h-8 px-3.5 text-[12px] rounded-[var(--radius-sm)]
              text-[var(--color-ink-5)] border border-[var(--color-border)]
              hover:text-[var(--color-ink-1)] hover:border-[var(--color-border-strong)]
              transition-colors duration-[var(--duration-fast)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="h-8 px-3.5 text-[12px] font-medium rounded-[var(--radius-sm)]
              bg-[var(--color-accent)] text-[#0a0b0e]
              hover:bg-[var(--color-accent-hover)]
              transition-colors duration-[var(--duration-fast)]
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
