import { useCallback, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { ShieldCheck } from "lucide-react";

import {
  type MachinePermission,
  getMachinePermissions,
  openPermissionSettings,
} from "@/lib/ipc";

interface PermissionsDialogProps {
  onClose: () => void;
}

export default function PermissionsDialog({ onClose }: PermissionsDialogProps) {
  const [permissions, setPermissions] = useState<MachinePermission[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPermissions(await getMachinePermissions());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, refresh]);

  return createPortal(
    <div
      className="arc-dialog-backdrop palette-backdrop fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-labelledby="permissions-title"
        className="arc-dialog-panel palette-panel mx-5 w-[390px] max-w-[calc(100vw-40px)] overflow-hidden border"
      >
        <header className="arc-dialog-header flex items-center gap-2.5 border-b border-[var(--color-border)]">
          <ShieldCheck size={16} className="text-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <h2
              id="permissions-title"
              className="arc-dialog-title text-[var(--color-ink-0)]"
            >
              Privacy & Permissions
            </h2>
            <p className="arc-dialog-subtitle">
              PiArc asks only when an approved action needs access.
            </p>
          </div>
          <kbd className="border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[8px] text-[var(--color-ink-9)]">
            esc
          </kbd>
        </header>

        <div className="arc-dialog-body grid gap-2">
          {permissions.map((permission) => (
            <div
              key={permission.kind}
              className="rounded-[4px] border border-[var(--color-border)] bg-[#101217] p-[11px]"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-semibold text-[var(--color-ink-0)]">
                      {permission.title}
                    </h3>
                    <Status state={permission.state} />
                  </div>
                  <p className="mt-1 font-mono text-[8px] leading-4 text-[var(--color-ink-9)]">
                    {permission.detail}
                  </p>
                </div>
                {permission.state === "granted" && (
                  <button
                    type="button"
                    onClick={() => void openPermissionSettings(permission.kind)}
                    className="arc-dialog-button h-7 shrink-0 border border-[var(--color-border)] px-2.5 text-[var(--color-ink-5)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-1)]"
                  >
                    Settings
                  </button>
                )}
              </div>
            </div>
          ))}
          {error && (
            <p
              role="alert"
              className="px-1 font-mono text-[8px] text-[var(--color-danger)]"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="border-t border-[var(--color-border)] px-[15px] py-3 font-mono text-[8px] text-[var(--color-ink-9)]">
          Access is requested only from the approved action that needs it. Granted access
          can be revoked in System Settings.
        </footer>
      </section>
    </div>,
    document.body
  );
}

function Status({ state }: { state: MachinePermission["state"] }) {
  const label = {
    granted: "Granted",
    denied: "Not granted",
    managedBySystem: "Per app",
    unsupported: "Unavailable",
  }[state];
  return <span className="font-mono text-[8px] text-[var(--color-ink-7)]">{label}</span>;
}
