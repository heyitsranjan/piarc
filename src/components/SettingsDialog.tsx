import { type ReactNode, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import {
  Bot,
  BotMessageSquare,
  BrainCircuit,
  Building2,
  CheckCircle2,
  CirclePlus,
  Database,
  KeyRound,
  Link,
  Loader2,
  PencilLine,
  Server,
  Tag,
  Trash2,
} from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import {
  type ConnectionReport,
  type CustomModel,
  type CustomModelApi,
  type CustomModelDraft,
  deleteCustomModel,
  listCustomModels,
  saveCustomModel,
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
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
};

export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CustomModel | null>(null);
  const [models, setModels] = useState<CustomModel[]>([]);
  const [draft, setDraft] = useState<CustomModelDraft>(emptyDraft);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listCustomModels()
      .then(setModels)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason))
      );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
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
      cost: model.cost,
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
    draft.maxTokens <= draft.contextWindow &&
    Object.values(draft.cost).every((price) => Number.isFinite(price) && price >= 0);

  return createPortal(
    <div
      className="arc-dialog-backdrop palette-backdrop fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal
        aria-labelledby="settings-title"
        className="arc-dialog-panel palette-panel mx-5 flex h-[min(76vh,680px)] w-[800px] max-w-[calc(100vw-40px)] overflow-hidden border"
      >
        <aside className="w-[260px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] p-[10px]">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-6 place-items-center border border-[var(--color-accent-border)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
              <BrainCircuit size={14} strokeWidth={1.8} />
            </span>
            <h2
              id="settings-title"
              className="arc-dialog-title text-[var(--color-ink-0)]"
            >
              Settings
            </h2>
          </div>
          <button
            type="button"
            className="arc-row-active arc-dialog-button relative flex h-[46px] w-full items-center gap-2 px-[9px] text-left"
          >
            <Server
              size={14}
              strokeWidth={1.8}
              className="shrink-0 text-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className="block font-mono text-[9px] text-[var(--color-ink-0)]">
                Custom Models
              </span>
              <span className="mt-1 block font-mono text-[7px] text-[var(--color-ink-7)]">
                Providers & credentials
              </span>
            </span>
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="arc-dialog-header flex items-center border-b border-[var(--color-border)]">
            <div className="min-w-0 flex-1">
              <h3 className="arc-dialog-title text-[var(--color-ink-0)]">
                Custom Models
              </h3>
              <p className="arc-dialog-subtitle">
                Connect model providers. Credentials stay in macOS Keychain.
              </p>
            </div>
            <kbd className="border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[8px] text-[var(--color-ink-9)]">
              esc
            </kbd>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-[14px]">
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
                deleting={deleting}
                error={error}
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
  busy: "test" | "save" | null;
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
        <div className="flex items-center gap-2">
          {editing ? (
            <PencilLine
              size={15}
              strokeWidth={1.8}
              className="text-[var(--color-accent)]"
            />
          ) : (
            <CirclePlus
              size={15}
              strokeWidth={1.8}
              className="text-[var(--color-accent)]"
            />
          )}
          <h4 className="font-mono text-[10px] font-semibold text-[var(--color-ink-0)]">
            {editing ? "Edit custom model" : "Add custom model"}
          </h4>
        </div>
        <p className="mt-2 font-mono text-[8px] leading-4 text-[var(--color-ink-7)]">
          Test sends a minimal request and may incur a small provider charge.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Display name">
          <Input
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Work Claude"
            leftIcon={<Tag size={13} />}
            autoFocus
          />
        </Field>
        <Field label="Provider name">
          <Input
            value={draft.providerName}
            onChange={(event) => update("providerName", event.target.value)}
            placeholder="Company Portkey"
            leftIcon={<Building2 size={13} />}
          />
        </Field>
      </div>

      <Field label="Protocol">
        <select
          value={draft.api}
          onChange={(event) => update("api", event.target.value as CustomModelApi)}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-2)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-xs text-[var(--color-ink-1)] focus:outline-none"
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
          leftIcon={<Link size={13} />}
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
          leftIcon={<KeyRound size={13} />}
        />
      </Field>
      <Field label="Model ID">
        <Input
          value={draft.modelId}
          onChange={(event) => update("modelId", event.target.value)}
          placeholder="@provider/model-name"
          leftIcon={<Bot size={13} />}
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

      <div>
        <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-7)]">
          Pricing
          <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-ink-9)]">
            USD per 1M tokens · optional
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          {(
            [
              ["input", "Input"],
              ["output", "Output"],
              ["cacheRead", "Cache read"],
              ["cacheWrite", "Cache write"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                min={0}
                step="any"
                value={draft.cost[key]}
                onChange={(event) =>
                  update("cost", { ...draft.cost, [key]: Number(event.target.value) })
                }
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 font-mono text-[8px] text-[var(--color-ink-5)]">
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
          className={`border p-3 font-mono text-[8px] leading-4 ${
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
        <Button
          type="button"
          onClick={onCancel}
          className="arc-dialog-button h-8 border border-[var(--color-border)] px-3.5"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onTest}
          disabled={!valid || busy !== null}
          className="arc-sidebar-create arc-dialog-action"
        >
          {busy === "test" && <Loader2 size={13} className="animate-spin" />}
          Test Connection
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={!report?.success || busy !== null}
          className="arc-sidebar-create arc-dialog-action"
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
  deleting,
  error,
  onEdit,
  onDelete,
  onAdd,
}: {
  models: CustomModel[];
  deleting: string | null;
  error: string | null;
  onEdit: (model: CustomModel) => void;
  onDelete: (model: CustomModel) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database
              size={15}
              strokeWidth={1.8}
              className="text-[var(--color-accent)]"
            />
            <h4 className="font-mono text-[10px] font-semibold text-[var(--color-ink-0)]">
              Saved models
            </h4>
          </div>
          <p className="mt-2 font-mono text-[8px] leading-4 text-[var(--color-ink-7)]">
            Select a saved provider from OMP&apos;s <code>/model</code> picker.
          </p>
        </div>
        <Button onClick={onAdd} className="arc-sidebar-create arc-dialog-action shrink-0">
          <CirclePlus size={14} strokeWidth={1.8} /> Add Model
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
                className="border border-[var(--color-border)] bg-[#101217] p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="grid size-7 shrink-0 place-items-center border border-[var(--color-accent-border)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
                    <BotMessageSquare size={14} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] font-semibold text-[var(--color-ink-1)]">
                      {model.name}
                    </div>
                    <div className="mt-1 truncate font-mono text-[8px] text-[var(--color-ink-7)]">
                      {model.providerName} · {selector}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(model)}
                    aria-label={`Edit ${model.name}`}
                    className="arc-dialog-button grid size-7 place-items-center border border-[var(--color-border)] text-[var(--color-ink-7)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-accent)]"
                  >
                    <PencilLine size={13} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(model)}
                    disabled={deleting !== null}
                    aria-label={`Delete ${model.name}`}
                    className="arc-dialog-button grid size-7 place-items-center border border-[var(--color-border)] text-[var(--color-danger)] hover:border-[var(--color-danger)] disabled:opacity-50"
                  >
                    {deleting === selector ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
                <div className="mt-2 font-mono text-[8px] text-[var(--color-ink-7)]">
                  {pricingSummary(model)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
          <span className="mx-auto grid size-10 place-items-center border border-[var(--color-accent-border)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
            <Bot size={20} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-mono text-[10px] text-[var(--color-ink-5)]">
            No custom models configured.
          </p>
          <p className="mt-2 font-mono text-[8px] text-[var(--color-ink-9)]">
            Add an OMP-compatible provider endpoint.
          </p>
        </div>
      )}
    </div>
  );
}

function pricingSummary(model: CustomModel) {
  if (Object.values(model.cost).every((price) => price === 0)) {
    return "Pricing not configured";
  }
  return `${formatPrice(model.cost.input)} input · ${formatPrice(model.cost.output)} output · ${formatPrice(model.cost.cacheRead)} cache read · ${formatPrice(model.cost.cacheWrite)} cache write / 1M`;
}

function formatPrice(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
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
    <label className="grid gap-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-7)]">
      <span>
        {label}
        {hint && (
          <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-ink-9)]">
            {hint}
          </span>
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
