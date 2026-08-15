import { useCallback, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { ShieldCheck, X } from "lucide-react";

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
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, refresh]);

  return createPortal(
    <div
      className="palette-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-labelledby="permissions-title"
        className="palette-panel mx-4 w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-2)] shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
      >
        <header className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3.5">
          <ShieldCheck size={17} className="text-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <h2
              id="permissions-title"
              className="text-[13px] font-semibold text-[var(--color-ink-0)]"
            >
              Privacy & Permissions
            </h2>
            <p className="mt-0.5 text-[10.5px] text-[var(--color-ink-7)]">
              πx asks only when an approved action needs access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close permissions"
            className="titlebar-button"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid gap-2 p-3">
          {permissions.map((permission) => (
            <div
              key={permission.kind}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[12px] font-medium text-[var(--color-ink-1)]">
                      {permission.title}
                    </h3>
                    <Status state={permission.state} />
                  </div>
                  <p className="mt-1 text-[10.5px] leading-4 text-[var(--color-ink-7)]">
                    {permission.detail}
                  </p>
                </div>
                {permission.state === "granted" && (
                  <button
                    type="button"
                    onClick={() => void openPermissionSettings(permission.kind)}
                    className="h-7 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 text-[10.5px] text-[var(--color-ink-5)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-1)]"
                  >
                    Settings
                  </button>
                )}
              </div>
            </div>
          ))}
          {error && (
            <p role="alert" className="px-1 text-[10.5px] text-[var(--color-danger)]">
              {error}
            </p>
          )}
        </div>

        <footer className="border-t border-[var(--color-border)] px-4 py-3 text-[10px] text-[var(--color-ink-9)]">
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
  return (
    <span className="rounded-full bg-[var(--color-bg-hi)] px-2 py-0.5 text-[9.5px] text-[var(--color-ink-7)]">
      {label}
    </span>
  );
}
