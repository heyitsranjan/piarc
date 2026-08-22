/**
 * @module store/terminal
 * Zustand slice for terminal tab state.
 *
 * Tab lifecycle states:
 * - `isLoading` — PTY is being spawned
 * - `error`     — PTY spawn failed (non-null string = error message)
 * - neither     — PTY is live and interactive
 *
 * Agent taxonomy:
 * - kind: "terminal" + agent: AgentType — AI-backed terminal (omp / codex / claude)
 * - kind: "terminal" + agent: null      — plain login shell
 * - kind: "note"                        — plain-text scratchpad, no PTY
 *
 * Single source of truth:
 * `loadSessions()` in the session store upserts on-disk OmpSessions → Tab[].
 * The sidebar and all UI read exclusively from Tab[].
 *
 * Closing a tab kills its PTY via `killPty` IPC.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  AGENT_REGISTRY,
  AGENT_START_CMD,
  agentDeleteCmd,
  agentRenameCmd,
  agentResumeCmd,
} from "@/store/agent";
import type { EnvVar } from "@/store/env";

import type { AgentActivity } from "@/lib/agent-activity";
import { killPty } from "@/lib/ipc";
import { shortId } from "@/lib/utils";

// ─── Taxonomy ──────────────────────────────────────────────────────────────

/** Terminal-backed tab or plain-text note scratchpad. */
export type TabKind = "terminal" | "note";

/**
 * AI agent running inside a terminal tab.
 * Extend this union when adding a new agent type;
 * TypeScript will surface every callsite that needs updating.
 */
export type AgentType = "omp" | "codex" | "claude";

// Re-export agent command helpers for backward compat.
export { AGENT_START_CMD, agentResumeCmd, agentRenameCmd, agentDeleteCmd };

// ─── Tab type hierarchy ──────────────────────────────────────────────────────

/**
 * Fields shared by every tab variant.
 * Never use `BaseTab` directly — use the specific variant or `Tab` union.
 */
interface BaseTab {
  /** Unique tab ID — also the PTY cache key in Rust `AppState`. */
  id: string;
  /** Agent session UUID, or synthetic `__terminal__xxx` / `__new__xxx` placeholder. */
  sessionId: string;
  /** Human-readable label shown in the sidebar row. */
  title: string;
  /** Working directory; passed to `createPty`. Notes leave this empty. */
  cwd: string;
  /** Floats this tab to the Pinned section in the sidebar. */
  isPinned: boolean;
  /** `true` when the user manually renamed this tab. */
  userRenamed: boolean;
  /** User-written sticky note attached to any tab. */
  note: string;
  /** Per-session environment variables. Merged with global env; tab wins on same key. */
  envVars: EnvVar[];
  /** `true` while the PTY is still spawning. */
  isLoading: boolean;
  /** Non-null when the PTY failed to spawn — message shown to the user. */
  error: string | null;
  /** `true` when the shell is at a prompt (no command running). Notes are always idle. */
  isIdle: boolean;
  /** Creation timestamp (epoch seconds). */
  createdAt: number;
  /** Last meaningful activity: agent event, note edit, or terminal I/O (epoch seconds). */
  modifiedAt: number;
}

/** Plain-text scratchpad — no PTY, no agent. */
export interface NoteTab extends BaseTab {
  kind: "note";
  agent: null;
  /** Plain-text body. */
  content: string;
}

/** Plain login-shell terminal — no agent. */
export interface TerminalTab extends BaseTab {
  kind: "terminal";
  agent: null;
}

/**
 * AI-agent-backed terminal tab (omp / codex / claude).
 * Extend with a specific variant (OmpTab, CodexTab, ClaudeTab) for
 * agent-specific fields.
 */
export interface AgentTab extends BaseTab {
  kind: "terminal";
  agent: AgentType;
  /** Shell command to start a fresh agent session. */
  startCmd: string;
  /** Shell command to resume the persisted session. `null` for brand-new sessions. */
  resumeCmd: string | null;
  /** Semantic lifecycle state emitted by the agent's status OSC extension. */
  activity: AgentActivity;
  /**
   * `true` when an agent completed but the user hasn't viewed the result yet.
   * Cleared when the user selects the tab. Not persisted across restarts.
   */
  hasUnreadCompletion: boolean;
}

/**
 * OMP-specific agent tab.
 * Has `path` (JSONL session file on disk) and `firstMessage` — absent on
 * Codex and Claude tabs because those agents don't write session files.
 */
export interface OmpTab extends AgentTab {
  agent: "omp";
  /**
   * Absolute path to the OMP JSONL session file.
   * Used for rename / delete operations via Rust IPC.
   * Empty string until synced by `loadSessions()`.
   */
  path: string;
  /**
   * First user message text — shown as subtitle in the sidebar.
   * Empty until synced from disk via `loadSessions()`.
   */
  firstMessage: string;
}

/** Codex agent tab — no disk-backed session file. */
export interface CodexTab extends AgentTab {
  agent: "codex";
}

/** Claude agent tab — no disk-backed session file. */
export interface ClaudeTab extends AgentTab {
  agent: "claude";
}

/** Discriminated union of all tab variants. The `kind` + `agent` pair is the discriminant. */
export type Tab = NoteTab | TerminalTab | OmpTab | CodexTab | ClaudeTab;

// ─── Type guards ─────────────────────────────────────────────────────────────

/** Narrows Tab → NoteTab. */
export function isNoteTab(tab: Tab): tab is NoteTab {
  return tab.kind === "note";
}

/** Narrows Tab → TerminalTab (plain login shell, no agent). */
export function isPlainTerminal(tab: Tab): tab is TerminalTab {
  return tab.kind === "terminal" && tab.agent === null;
}

/**
 * Narrows Tab → AgentTab variant (omp | codex | claude).
 * Use when `startCmd`, `resumeCmd`, or `activity` must be accessed without null-checks.
 */
export function isAgentTab(tab: Tab): tab is OmpTab | CodexTab | ClaudeTab {
  return tab.kind === "terminal" && tab.agent !== null;
}

/** Narrows Tab → OmpTab (has `path` and `firstMessage`). */
export function isOmpTab(tab: Tab): tab is OmpTab {
  return tab.kind === "terminal" && tab.agent === "omp";
}

// ─── Store params ─────────────────────────────────────────────────────────────

/**
 * Input shape for {@link TerminalState.openTab}.
 * Callers supply identity + agent metadata; the store fills in lifecycle defaults.
 */
export interface OpenTabParams {
  id?: string;
  kind: TabKind;
  agent: AgentType | null;
  sessionId: string;
  title: string;
  cwd: string;
  /** OMP only — JSONL session file path. */
  path?: string;
  /** OMP only — first user message text. */
  firstMessage?: string;
  startCmd?: string | null;
  resumeCmd?: string | null;
  inactive?: boolean;
  content?: string;
}

/**
 * Patch shape for {@link TerminalState.syncTabFromSession}.
 * Only OmpTab fields that change when a session is refreshed from disk.
 */
export interface SessionPatch {
  title: string;
  cwd: string;
  path: string;
  firstMessage: string;
  modifiedAt: number;
}

// ─── State interface ──────────────────────────────────────────────────────────

interface TerminalState {
  tabs: Tab[];
  activeTabId: string | null;
  /** Tab temporarily accepting direct keyboard input for an OMP terminal UI. */
  interactiveTabId: string | null;

  openTab: (params: OpenTabParams) => string;
  closeTab: (tabId: string) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  enableTerminalInteraction: (tabId: string) => void;
  disableTerminalInteraction: (tabId: string) => void;

  bindTabSession: (tabId: string, sessionId: string, title?: string) => void;
  syncTabFromSession: (tabId: string, patch: SessionPatch) => void;
  setTabReady: (tabId: string) => void;
  setTabError: (tabId: string, message: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  syncTabTitle: (tabId: string, title: string) => void;
  toggleTabPin: (tabId: string) => void;
  retryTab: (tabId: string) => void;
  setTabActivity: (tabId: string, activity: AgentActivity) => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateTabNote: (tabId: string, note: string) => void;
  setTabEnvVars: (tabId: string, vars: EnvVar[]) => void;
  markTabRead: (tabId: string) => void;
  markTabUnread: (tabId: string) => void;
  setTabIdle: (tabId: string, isIdle: boolean) => void;
  /**
   * Convert a plain terminal tab to an agent tab in-place.
   * Same `tab.id` → same React key → zero sidebar remount.
   * Only acts on `TerminalTab` (agent: null) — no-op for other variants.
   */
  promoteToAgent: (tabId: string, agent: AgentType) => void;
}

// ─── Migration helper ─────────────────────────────────────────────────────────

/**
 * Upgrades a single persisted tab to the current schema.
 * Handles legacy `kind: "omp"` → `kind: "terminal", agent: "omp"` and
 * builds the correct discriminated-union variant.
 */
function migratePersistedTab(raw: Record<string, unknown>): Tab {
  const rawKind = raw.kind as string;
  const isLegacyOmp = rawKind === "omp";

  const kind: TabKind = isLegacyOmp ? "terminal" : (rawKind as TabKind);
  const agent = (isLegacyOmp ? "omp" : (raw.agent as AgentType | null)) ?? null;

  // Stale data stored session UUID as tab.id — regenerate to prevent React key collisions.
  const rawId = raw.id as string | undefined;
  const rawSessionId = raw.sessionId as string | undefined;
  const id =
    rawId && rawSessionId && rawId === rawSessionId
      ? crypto.randomUUID()
      : (rawId ?? crypto.randomUUID());

  const base: BaseTab = {
    id,
    sessionId: (raw.sessionId as string) ?? "",
    title: (raw.title as string) ?? "Untitled",
    cwd: (raw.cwd as string) ?? "",
    isPinned: (raw.isPinned as boolean) ?? false,
    userRenamed: (raw.userRenamed as boolean) ?? false,
    note: (raw.note as string) ?? "",
    envVars: (raw.envVars as EnvVar[]) ?? [],
    isLoading: false,
    error: "Disconnected — select to reconnect",
    isIdle: true,
    createdAt: (raw.createdAt as number) ?? Date.now() / 1000,
    modifiedAt:
      (raw.modifiedAt as number) ?? (raw.createdAt as number) ?? Date.now() / 1000,
  };

  if (kind === "note") {
    return { ...base, kind: "note", agent: null, content: (raw.content as string) ?? "" };
  }

  if (agent === null) {
    return { ...base, kind: "terminal", agent: null };
  }

  // Agent tab — build the right variant
  const agentBase: AgentTab = {
    ...base,
    kind: "terminal",
    agent,
    startCmd: (raw.startCmd as string) ?? AGENT_REGISTRY[agent].startCmd(),
    resumeCmd:
      (raw.resumeCmd as string | null) ??
      (base.sessionId && !base.sessionId.startsWith("__")
        ? AGENT_REGISTRY[agent].resumeCmd(base.sessionId)
        : null),
    activity: { state: "disconnected" },
    hasUnreadCompletion: false,
  };

  if (agent === "omp") {
    return {
      ...agentBase,
      agent: "omp",
      path: (raw.path as string) ?? "",
      firstMessage: (raw.firstMessage as string) ?? "",
    };
  }
  if (agent === "codex") return { ...agentBase, agent: "codex" };
  // claude (default)
  return { ...agentBase, agent: "claude" };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      interactiveTabId: null,

      openTab: (params) => {
        const id = params.id ?? `tab-${shortId()}`;
        const isNote = params.kind === "note";
        const isInactive = params.inactive ?? false;

        const base: BaseTab = {
          id,
          sessionId: params.sessionId,
          title: params.title,
          cwd: params.cwd,
          isPinned: false,
          userRenamed: false,
          note: "",
          envVars: [],
          isLoading: isNote || isInactive ? false : true,
          error: isInactive ? "Disconnected — select to reconnect" : null,
          isIdle: true,
          createdAt: Date.now() / 1000,
          modifiedAt: Date.now() / 1000,
        };

        let tab: Tab;

        if (isNote) {
          tab = { ...base, kind: "note", agent: null, content: params.content ?? "" };
        } else if (params.agent === null) {
          tab = { ...base, kind: "terminal", agent: null };
        } else {
          const agent = params.agent;
          const agentBase: AgentTab = {
            ...base,
            kind: "terminal",
            agent,
            startCmd: params.startCmd ?? AGENT_REGISTRY[agent].startCmd(),
            resumeCmd: params.resumeCmd ?? null,
            activity: {
              state: isInactive ? "disconnected" : "starting",
            },
            hasUnreadCompletion: false,
          };

          if (agent === "omp") {
            tab = {
              ...agentBase,
              agent: "omp",
              path: params.path ?? "",
              firstMessage: params.firstMessage ?? "",
            };
          } else if (agent === "codex") {
            tab = { ...agentBase, agent: "codex" };
          } else {
            tab = { ...agentBase, agent: "claude" };
          }
        }

        // Idempotent for agent sessions — concurrent loadSessions() calls must not
        // create duplicate tabs for the same sessionId.
        set((s) => {
          if (
            params.agent !== null &&
            s.tabs.some(
              (t) => t.sessionId === params.sessionId && t.agent === params.agent
            )
          ) {
            return s;
          }
          return { tabs: [...s.tabs, tab], activeTabId: id };
        });

        return id;
      },

      closeTab: async (tabId) => {
        try {
          await killPty(tabId);
        } catch {
          // PTY may already be dead — not fatal
        }
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== tabId);
          const activeTabId = s.activeTabId === tabId ? null : s.activeTabId;
          const interactiveTabId =
            s.interactiveTabId === tabId ? null : s.interactiveTabId;
          return { tabs, activeTabId, interactiveTabId };
        });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId, interactiveTabId: null }),

      enableTerminalInteraction: (tabId) => set({ interactiveTabId: tabId }),

      disableTerminalInteraction: (tabId) =>
        set((s) => ({
          interactiveTabId: s.interactiveTabId === tabId ? null : s.interactiveTabId,
        })),

      setTabReady: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            if (isAgentTab(t)) {
              return {
                ...t,
                isLoading: false,
                error: null,
                activity: { state: "waiting_input" as const },
              };
            }
            return { ...t, isLoading: false, error: null };
          }),
        })),

      setTabError: (tabId, message) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            if (isAgentTab(t)) {
              return {
                ...t,
                isLoading: false,
                error: message,
                activity: { state: "error" as const },
              };
            }
            return { ...t, isLoading: false, error: message };
          }),
        })),

      updateTabTitle: (tabId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, title, userRenamed: true } : t
          ),
        })),

      syncTabTitle: (tabId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId && !t.userRenamed ? { ...t, title } : t
          ),
        })),

      syncTabFromSession: (tabId, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || !isOmpTab(t)) return t;
            return {
              ...t,
              title: t.userRenamed ? t.title : patch.title,
              cwd: patch.cwd,
              path: patch.path,
              firstMessage: patch.firstMessage,
              modifiedAt: patch.modifiedAt,
            };
          }),
        })),

      toggleTabPin: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
        })),

      retryTab: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            if (isAgentTab(t)) {
              return {
                ...t,
                isLoading: true,
                error: null,
                activity: { state: "starting" as const },
              };
            }
            return { ...t, isLoading: true, error: null };
          }),
        })),

      bindTabSession: (tabId, sessionId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || !isAgentTab(t)) return t;
            const agent = t.agent;
            return {
              ...t,
              sessionId,
              resumeCmd: AGENT_REGISTRY[agent].resumeCmd(sessionId),
              modifiedAt: Date.now() / 1000,
              ...(title && !t.userRenamed ? { title } : {}),
            };
          }),
        })),

      setTabActivity: (tabId, activity) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || !isAgentTab(t)) return t;
            return { ...t, activity, modifiedAt: Date.now() / 1000 };
          }),
        })),

      updateTabContent: (tabId, content) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId && isNoteTab(t)
              ? { ...t, content, modifiedAt: Date.now() / 1000 }
              : t
          ),
        })),

      updateTabNote: (tabId, note) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, note, modifiedAt: Date.now() / 1000 } : t
          ),
        })),

      setTabEnvVars: (tabId, vars) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, envVars: vars } : t)),
        })),

      setTabIdle: (tabId, isIdle) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId && t.kind !== "note"
              ? { ...t, isIdle, modifiedAt: Date.now() / 1000 }
              : t
          ),
        })),

      markTabRead: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || !isAgentTab(t)) return t;
            return t.hasUnreadCompletion ? { ...t, hasUnreadCompletion: false } : t;
          }),
        })),

      markTabUnread: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || !isAgentTab(t)) return t;
            return !t.hasUnreadCompletion ? { ...t, hasUnreadCompletion: true } : t;
          }),
        })),

      promoteToAgent: (tabId, agent) =>
        set((s) => ({
          tabs: s.tabs.map((t): Tab => {
            if (t.id !== tabId || !isPlainTerminal(t)) return t;
            const agentBase = {
              ...t,
              agent,
              startCmd: AGENT_REGISTRY[agent].startCmd(),
              resumeCmd: null,
              activity: { state: "waiting_input" as const },
              hasUnreadCompletion: false,
            };
            if (agent === "omp") {
              return { ...agentBase, agent: "omp" as const, path: "", firstMessage: "" };
            }
            if (agent === "codex") return { ...agentBase, agent: "codex" as const };
            return { ...agentBase, agent: "claude" as const };
          }),
        })),
    }),
    {
      name: "piarc-terminal-tabs",
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => {
          const base = {
            ...tab,
            isLoading: false,
            isIdle: true,
            error: "Disconnected — select to reconnect",
          };
          if (isAgentTab(tab)) {
            return {
              ...base,
              activity: { state: "disconnected" as const },
              hasUnreadCompletion: false,
            };
          }
          return base;
        }),
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<TerminalState>;
        const migrated: Tab[] = [];
        for (const raw of (saved.tabs ?? []) as unknown[]) {
          try {
            migrated.push(migratePersistedTab(raw as Record<string, unknown>));
          } catch {
            // Skip corrupted tab — don't crash the whole store
          }
        }
        const seen = new Set<string>();
        const tabs = migrated.filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        return {
          ...current,
          ...saved,
          tabs,
          activeTabId: null,
          interactiveTabId: null,
        };
      },
    }
  )
);
