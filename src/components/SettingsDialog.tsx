import { type ReactNode, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import {
  type ConnectionReport,
  type CustomModel,
  type CustomModelApi,
  type CustomModelDraft,
  type ModelRole,
  deleteCustomModel,
  listCustomModels,
  listModelRoles,
  saveCustomModel,
  setModelRole,
  testCustomModel,
  updateCustomModel,
} from "@/lib/ipc";

interface SettingsDialogProps {
  onClose: () => void;
}

const emptyDraft: CustomModelDraft = {
  name: "",
  providerName: "",
  baseUrl: "https://api.portkey.ai/v1",
  apiKey: "",
  modelId: "",
  api: "openai-completions",
  reasoning: false,
  imageInput: false,
  contextWindow: 128_000,
  maxTokens: 8_192,
};

const modelRoles: { id: ModelRole; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "smol", label: "Fast" },
  { id: "slow", label: "Strong" },
  { id: "vision", label: "Vision" },
  { id: "plan", label: "Plan" },
  { id: "designer", label: "Designer" },
  { id: "commit", label: "Commit" },
  { id: "tiny", label: "Tiny" },
  { id: "task", label: "Task" },
  { id: "advisor", label: "Advisor" },
  { id: "fallback", label: "Fallback" },
];

export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CustomModel | null>(null);
  const [models, setModels] = useState<CustomModel[]>([]);
  const [roles, setRoles] = useState<Partial<Record<ModelRole, string>>>({});
  const [draft, setDraft] = useState<CustomModelDraft>(emptyDraft);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | ModelRole | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listCustomModels(), listModelRoles()])
      .then(([savedModels, savedRoles]) => {
        setModels(savedModels);
        setRoles(savedRoles);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason))
      );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const update = <K extends keyof CustomModelDraft>(
    key: K,
    value: CustomModelDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setReport(null);
    setError(null);
  };

  const test = async () => {
    setBusy("test");
    setError(null);
    try {
      setReport(await testCustomModel(draft));
    } catch (reason) {
      setReport(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const model = editing
        ? await updateCustomModel(editing.providerId, editing.modelId, draft)
        : await saveCustomModel(draft);
      setModels((current) => [
        model,
        ...current.filter((item) =>
          editing
            ? item.providerId !== editing.providerId || item.modelId !== editing.modelId
            : item.providerId !== model.providerId || item.modelId !== model.modelId
        ),
      ]);
      setDraft(emptyDraft);
      setReport(null);
      setEditing(null);
      setAdding(false);
      setRoles(await listModelRoles());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const assignRole = async (role: ModelRole, selector: string | null) => {
    setBusy(role);
    setError(null);
    try {
      setRoles(await setModelRole(role, selector));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const editModel = (model: CustomModel) => {
    setEditing(model);
    setDraft({
      name: model.name,
      providerName: model.providerName,
      baseUrl: model.baseUrl,
      apiKey: "",
      modelId: model.modelId,
      api: model.api,
      reasoning: model.reasoning,
      imageInput: model.imageInput,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    });
    setReport(null);
    setError(null);
    setAdding(true);
  };

  const removeModel = async (model: CustomModel) => {
    const selector = `${model.providerId}/${model.modelId}`;
    if (!window.confirm(`Delete ${model.name}? This removes it from OMP.`)) return;
    setDeleting(selector);
    setError(null);
    try {
      await deleteCustomModel(model.providerId, model.modelId);
      setModels((current) =>
        current.filter(
          (item) => item.providerId !== model.providerId || item.modelId !== model.modelId
        )
      );
      setRoles(await listModelRoles());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDeleting(null);
    }
  };

  const valid =
    draft.name.trim() &&
    draft.providerName.trim() &&
    draft.baseUrl.trim() &&
    (editing || draft.apiKey) &&
    draft.modelId.trim() &&
    draft.contextWindow > 0 &&
    draft.maxTokens > 0 &&
    draft.maxTokens <= draft.contextWindow;

  return createPortal(
    <div
      className="palette-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-labelledby="settings-title"
        className="palette-panel mx-4 flex h-[min(680px,calc(100vh-48px))] w-full max-w-3xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-2)] shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
      >
        <aside className="w-44 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Settings size={16} className="text-[var(--color-accent)]" />
            <h2
              id="settings-title"
              className="text-[13px] font-semibold text-[var(--color-ink-0)]"
            >
              Settings
            </h2>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bg-active)] px-2 py-2 text-left text-[11.5px] text-[var(--color-ink-0)]"
          >
            <SlidersHorizontal size={14} />
            Custom Models
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center border-b border-[var(--color-border)] px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold text-[var(--color-ink-0)]">
                Custom Models
              </h3>
              <p className="mt-0.5 text-[10.5px] text-[var(--color-ink-7)]">
                Connect an OMP-compatible model provider. Credentials stay in macOS
                Keychain.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="titlebar-button"
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {adding ? (
              <ModelForm
                draft={draft}
                update={update}
                report={report}
                error={error}
                editing={Boolean(editing)}
                busy={busy}
                valid={Boolean(valid)}
                onCancel={() => {
                  setEditing(null);
                  setAdding(false);
                  setDraft(emptyDraft);
                  setReport(null);
                  setError(null);
                }}
                onTest={() => void test()}
                onSave={() => void save()}
              />
            ) : (
              <ModelList
                models={models}
                roles={roles}
                busyRole={busy !== "test" && busy !== "save" ? busy : null}
                deleting={deleting}
                error={error}
                onAssign={(role, selector) => void assignRole(role, selector)}
                onEdit={editModel}
                onDelete={(model) => void removeModel(model)}
                onAdd={() => {
                  setEditing(null);
                  setDraft(emptyDraft);
                  setAdding(true);
                }}
              />
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

interface ModelFormProps {
  draft: CustomModelDraft;
  update: <K extends keyof CustomModelDraft>(key: K, value: CustomModelDraft[K]) => void;
  report: ConnectionReport | null;
  error: string | null;
  busy: "test" | "save" | ModelRole | null;
  editing: boolean;
  valid: boolean;
  onCancel: () => void;
  onTest: () => void;
  onSave: () => void;
}

function ModelForm({
  draft,
  update,
  report,
  error,
  busy,
  valid,
  editing,
  onCancel,
  onTest,
  onSave,
}: ModelFormProps) {
  return (
    <form
      className="mx-auto grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (report?.success) onSave();
        else onTest();
      }}
    >
      <div>
        <h4 className="text-[13px] font-medium text-[var(--color-ink-0)]">
          {editing ? "Edit custom model" : "Add custom model"}
        </h4>
        <p className="mt-1 text-[10.5px] text-[var(--color-ink-7)]">
          Test sends a minimal request and may incur a small provider charge.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Display name">
          <Input
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Work Claude"
            autoFocus
          />
        </Field>
        <Field label="Provider name">
          <Input
            value={draft.providerName}
            onChange={(event) => update("providerName", event.target.value)}
            placeholder="Company Portkey"
          />
        </Field>
      </div>

      <Field label="Protocol">
        <select
          value={draft.api}
          onChange={(event) => update("api", event.target.value as CustomModelApi)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-2)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-xs text-[var(--color-ink-1)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          <option value="openai-completions">OpenAI Chat Completions / Portkey</option>
          <option value="openai-responses">OpenAI Responses</option>
          <option value="anthropic-messages">Anthropic Messages</option>
        </select>
      </Field>

      <Field label="Base URL">
        <Input
          value={draft.baseUrl}
          onChange={(event) => update("baseUrl", event.target.value)}
          placeholder="https://api.example.com/v1"
        />
      </Field>
      <Field
        label="API key"
        hint={
          editing ? "Leave blank to keep the stored key" : "Stored only in macOS Keychain"
        }
      >
        <Input
          type="password"
          value={draft.apiKey}
          onChange={(event) => update("apiKey", event.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Model ID">
        <Input
          value={draft.modelId}
          onChange={(event) => update("modelId", event.target.value)}
          placeholder="@provider/model-name"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Context window">
          <Input
            type="number"
            min={1}
            value={draft.contextWindow}
            onChange={(event) => update("contextWindow", Number(event.target.value))}
          />
        </Field>
        <Field label="Maximum output tokens">
          <Input
            type="number"
            min={1}
            max={draft.contextWindow}
            value={draft.maxTokens}
            onChange={(event) => update("maxTokens", Number(event.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 text-[11px] text-[var(--color-ink-5)]">
        <Check
          label="Reasoning"
          checked={draft.reasoning}
          onChange={(value) => update("reasoning", value)}
        />
        <Check
          label="Image input"
          checked={draft.imageInput}
          onChange={(value) => update("imageInput", value)}
        />
      </div>

      {(report || error) && (
        <div
          role={report?.success ? "status" : "alert"}
          className={`rounded-[var(--radius-sm)] border p-3 text-[11px] ${
            report?.success
              ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-ink-1)]"
              : "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
          }`}
        >
          {report?.success && <CheckCircle2 size={14} className="mr-2 inline" />}
          {report?.message ?? error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onTest}
          disabled={!valid || busy !== null}
          className="border border-[var(--color-border)]"
        >
          {busy === "test" && <Loader2 size={13} className="animate-spin" />}
          Test Connection
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={!report?.success || busy !== null}
        >
          {busy === "save" && <Loader2 size={13} className="animate-spin" />}
          {editing ? "Save Changes" : "Save Model"}
        </Button>
      </div>
    </form>
  );
}

function ModelList({
  models,
  roles,
  busyRole,
  deleting,
  error,
  onAssign,
  onEdit,
  onDelete,
  onAdd,
}: {
  models: CustomModel[];
  roles: Partial<Record<ModelRole, string>>;
  busyRole: ModelRole | null;
  deleting: string | null;
  error: string | null;
  onAssign: (role: ModelRole, selector: string | null) => void;
  onEdit: (model: CustomModel) => void;
  onDelete: (model: CustomModel) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-[12px] font-medium text-[var(--color-ink-1)]">
            Model use cases
          </h4>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--color-ink-7)]">
            Assign each saved model to OMP roles. Changes appear immediately in every{" "}
            <code>/model</code> picker.
          </p>
        </div>
        <Button variant="default" onClick={onAdd} className="shrink-0">
          <Plus size={13} /> Add Custom Model
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-[var(--radius-sm)] border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-[11px] text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}
      {models.length ? (
        <div className="grid gap-3">
          {models.map((model) => {
            const selector = `${model.providerId}/${model.modelId}`;
            return (
              <div
                key={selector}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-[var(--color-ink-1)]">
                      {model.name}
                    </div>
                    <div className="mt-1 truncate text-[10.5px] text-[var(--color-ink-7)]">
                      {model.providerName} · {selector}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(model)}
                    aria-label={`Edit ${model.name}`}
                    className="titlebar-button"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(model)}
                    disabled={deleting !== null}
                    aria-label={`Delete ${model.name}`}
                    className="titlebar-button text-[var(--color-danger)] disabled:opacity-50"
                  >
                    {deleting === selector ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="OMP use cases">
                  {modelRoles.map((role) => {
                    const assigned = roles[role.id] === selector;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        aria-pressed={assigned}
                        disabled={busyRole !== null}
                        onClick={() => onAssign(role.id, assigned ? null : selector)}
                        className={`rounded-full border px-2 py-1 text-[9.5px] transition-colors disabled:opacity-50 ${
                          assigned
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                            : "border-[var(--color-border-2)] text-[var(--color-ink-7)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-3)]"
                        }`}
                      >
                        {busyRole === role.id && (
                          <Loader2 size={9} className="mr-1 inline animate-spin" />
                        )}
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
          <SlidersHorizontal size={24} className="mx-auto text-[var(--color-ink-9)]" />
          <p className="mt-3 text-[12px] text-[var(--color-ink-5)]">
            No custom models configured.
          </p>
          <p className="mt-1 text-[10.5px] text-[var(--color-ink-9)]">
            Add Portkey or another OMP-compatible endpoint.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-[10.5px] font-medium text-[var(--color-ink-5)]">
      <span>
        {label}
        {hint && (
          <span className="ml-2 font-normal text-[var(--color-ink-9)]">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}
