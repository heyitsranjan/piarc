/**
 * @module components/EnvPanel
 * Slide-out drawer for per-session environment variables.
 * Variables here override global env (same key wins).
 */
import { useState } from "react";

import { CirclePlus, Trash2, Variable, X } from "lucide-react";

import DrawerPanel from "@/components/shared/DrawerPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import type { EnvVar } from "@/store/env";
import { useEnvStore } from "@/store/env";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { shortId } from "@/lib/utils";

export default function EnvPanel() {
  const envPanelOpen = useUiStore((s) => s.envPanelOpen);
  const toggleEnvPanel = useUiStore((s) => s.toggleEnvPanel);

  const activeTab = useTerminalStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const setTabEnvVars = useTerminalStore((s) => s.setTabEnvVars);

  const globalVars = useEnvStore((s) => s.envVars);

  // Local draft — changes don't apply until Save.
  const [draft, setDraft] = useState<EnvVar[]>(() => activeTab?.envVars ?? []);
  const [savedTabId, setSavedTabId] = useState<string | null>(null);

  // Reset draft when the active tab changes.
  if (activeTab && activeTab.id !== savedTabId) {
    setSavedTabId(activeTab.id);
    setDraft(activeTab.envVars ?? []);
  }

  const updateDraft = (id: string, field: "key" | "value", text: string) =>
    setDraft((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: text } : v)));

  const removeDraft = (id: string) => setDraft((prev) => prev.filter((v) => v.id !== id));

  const addDraft = () =>
    setDraft((prev) => [...prev, { id: shortId(), key: "", value: "" }]);

  const handleSave = () => {
    if (!activeTab) return;
    const saved = draft.filter((v) => v.key.trim());
    setTabEnvVars(activeTab.id, saved);
    setDraft(saved);
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(activeTab?.envVars ?? []);

  if (!envPanelOpen || !activeTab) return null;

  return (
    <DrawerPanel
      aria-label={`Environment for ${activeTab.title}`}
      storageKey="piarc-env-width"
      defaultWidth={340}
      minWidth={260}
      maxWidth={620}
      onClose={toggleEnvPanel}
    >
      <header className="arc-workspace-header">
        <Variable size={14} strokeWidth={1.8} className="arc-workspace-icon" />
        <div className="arc-workspace-heading">
          <p className="arc-workspace-title">Session Environment</p>
          <p className="arc-workspace-path" title={activeTab.title}>
            {activeTab.title}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleEnvPanel}
          title="Close (Esc)"
          aria-label="Close env panel"
          className="arc-workspace-action"
        >
          <X size={13} />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* Global vars hint */}
        {globalVars.filter((v) => v.key.trim()).length > 0 && (
          <div className="rounded border border-[var(--color-border)] p-2">
            <p className="mb-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-7)]">
              Global ({globalVars.filter((v) => v.key.trim()).length})
            </p>
            <div className="flex flex-col gap-1">
              {globalVars
                .filter((v) => v.key.trim())
                .map((v) => {
                  const overridden = draft.some(
                    (d) => d.key.trim() === v.key.trim() && d.key.trim()
                  );
                  return (
                    <div
                      key={v.id}
                      className="grid grid-cols-2 gap-1.5 font-mono text-[8px]"
                    >
                      <span
                        className={
                          overridden
                            ? "truncate text-[var(--color-ink-9)] line-through"
                            : "truncate text-[var(--color-ink-5)]"
                        }
                      >
                        {v.key}
                      </span>
                      <span className="truncate text-[var(--color-ink-7)]">
                        {v.value}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Session-level vars */}
        <div>
          <div className="mb-1.5 grid grid-cols-[1fr_1fr_24px] gap-1.5 px-0.5">
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-7)]">
              Key
            </span>
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-7)]">
              Value
            </span>
            <span />
          </div>

          <div className="flex flex-col gap-1">
            {draft.length === 0 && (
              <p className="py-3 text-center font-mono text-[9px] text-[var(--color-ink-9)]">
                No session overrides. Click + to add.
              </p>
            )}
            {draft.map((v) => (
              <div key={v.id} className="grid grid-cols-[1fr_1fr_24px] gap-1.5">
                <Input
                  value={v.key}
                  onChange={(e) => updateDraft(v.id, "key", e.target.value)}
                  placeholder="KEY"
                  className="h-7 font-mono text-[9px]"
                  spellCheck={false}
                />
                <Input
                  value={v.value}
                  onChange={(e) => updateDraft(v.id, "value", e.target.value)}
                  placeholder="value"
                  className="h-7 font-mono text-[9px]"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => removeDraft(v.id)}
                  className="grid place-items-center rounded text-[var(--color-ink-7)] hover:text-[var(--color-danger)]"
                  aria-label="Remove"
                >
                  <Trash2 size={11} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-[var(--color-border)] p-2">
        <button
          type="button"
          onClick={addDraft}
          className="arc-dialog-button flex items-center gap-1 font-mono text-[9px] text-[var(--color-ink-3)]"
        >
          <CirclePlus size={10} strokeWidth={2} />
          Add
        </button>
        <span className="flex-1" />
        <p className="font-mono text-[8px] text-[var(--color-ink-9)]">
          Takes effect on next resume
        </p>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="h-6 px-2.5 font-mono text-[9px]"
        >
          Save
        </Button>
      </div>
    </DrawerPanel>
  );
}
