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

// ─── Agent commands ─────────────────────────────────────────────────────────

/**
 * Canonical CLI launch command for each agent.
 * Single source of truth — never scatter `"omp"` / `"codex"` / `"claude"` strings.
 *
 * @example
 * const cmd = AGENT_START_CMD["omp"]; // "omp"
 */
export const AGENT_START_CMD: Record<AgentType, string> = {
  omp: "omp",
  codex: "codex",
  claude: "claude",
} as const;

/**
 * Builds the shell command to resume a persisted agent session.
 *
 * @example
 * agentResumeCmd("omp", "abc-123"); // "omp --resume abc-123"
 */
export function agentResumeCmd(agent: AgentType, sessionId: string): string {
  return `${AGENT_START_CMD[agent]} --resume ${sessionId}`;
}

/**
 * Builds the shell command to rename an agent session.
 *
 * @example
 * agentRenameCmd("omp", "abc-123", "My session"); // "omp rename abc-123 'My session'"
 */
export function agentRenameCmd(
  agent: AgentType,
  sessionId: string,
  title: string
): string {
  const escaped = `'${title.replace(/'/g, "'\\''")}'`;
  return `${AGENT_START_CMD[agent]} rename ${sessionId} ${escaped}`;
}

/**
 * Builds the shell command to delete an agent session.
 *
 * @example
 * agentDeleteCmd("omp", "abc-123"); // "omp delete abc-123"
 */
export function agentDeleteCmd(agent: AgentType, sessionId: string): string {
  return `${AGENT_START_CMD[agent]} delete ${sessionId}`;
}

// ─── Tab interface ───────────────────────────────────────────────────────────

export interface Tab {
  // ── Identity ────────────────────────────────────────────────────────────
  /** Unique tab ID — also the PTY cache key in Rust `AppState`. */
  id: string;
  /** Agent session UUID (omp/codex/claude), or synthetic ID for plain terminals and notes. */
  sessionId: string;
  /** terminal → PTY-backed tab; note → scratchpad with no PTY. */
  kind: TabKind;
  /**
   * Which agent runs in this terminal.
   * `null` → plain login shell. Always `null` for `kind: "note"`.
   */
  agent: AgentType | null;
  /** Human-readable label shown in the sidebar row. */
  title: string;
  /** Working directory; passed to `createPty`. Notes leave this empty. */
  cwd: string;

  // ── Agent commands (agent !== null only) ────────────────────────────────
  /**
   * Shell command to start a fresh agent session.
   * Derived from {@link AGENT_START_CMD}. `null` for plain terminals and notes.
   */
  startCmd: string | null;
  /**
   * Shell command to resume the persisted session ({@link Tab.sessionId}).
   * Built by {@link agentResumeCmd}. `null` for plain terminals and notes.
   * `null` also for brand-new sessions that have no persisted ID yet.
   */
  resumeCmd: string | null;

  // ── Session metadata (agent !== null only) ───────────────────────────────
  /**
   * Absolute path to the agent's session file on disk.
   * Used for rename / delete operations. Empty for plain terminals and notes.
   * Populated when the session is upserted from `loadSessions()`.
   */
  path: string;
  /**
   * First user message — shown as subtitle in the sidebar row.
   * Empty until synced from disk via `loadSessions()`.
   */
  firstMessage: string;

  // ── Lifecycle ────────────────────────────────────────────────────────────
  /** Creation timestamp (epoch seconds). */
  createdAt: number;
  /** Last meaningful activity: agent event, note edit, or terminal I/O (epoch seconds). */
  modifiedAt: number;
  /** `true` while the PTY is still spawning. */
  isLoading: boolean;
  /** Non-null when the PTY failed to spawn — message shown to the user. */
  error: string | null;
  /**
   * `true` when the shell is at a prompt (no command running).
   * Notes are always idle.
   */
  isIdle: boolean;

  // ── Agent state (agent !== null only) ───────────────────────────────────
  /** Semantic lifecycle state emitted by the agent's status OSC extension. */
  activity: AgentActivity;

  // ── Display / sort ───────────────────────────────────────────────────────
  /** Floats this tab to the Pinned section in the sidebar. */
  isPinned: boolean;
  /**
   * `true` when the user manually renamed this tab.
   * Prevents automatic title sync from session data reloads.
   */
  userRenamed: boolean;
  /**
   * `true` when an agent completed but the user hasn't viewed the result yet.
   * Set on completion when the tab isn't active or the window isn't focused.
   * Cleared when the user selects the tab. Not persisted across restarts.
   */
  hasUnreadCompletion: boolean;

  // ── Content ─────────────────────────────────────────────────────────────
  /** Plain-text body — `kind: "note"` only. */
  content: string;
  /** User-written sticky note attached to any tab. Renders the StickyNote badge. */
  note: string;
  /** Per-session environment variables. Merged with global env; same key overrides global. */
  envVars: EnvVar[];
}

// ─── Narrowed types & guards ─────────────────────────────────────────────────

/**
 * Narrowed variant of {@link Tab} for agent-backed terminals.
 * `agent`, `startCmd`, and `resumeCmd` are guaranteed non-null.
 * Obtain via {@link isAgentTab}.
 */
export type AgentTab = Tab & {
  agent: AgentType;
  startCmd: string;
  resumeCmd: string;
};

/**
 * Type guard: narrows {@link Tab} → {@link AgentTab}.
 *
 * `true` for `omp`, `codex`, and `claude` terminal tabs.
 * Use wherever `startCmd` or `resumeCmd` must be accessed without null-checks.
 *
 * @example
 * if (isAgentTab(tab)) {
 *   console.log(tab.startCmd); // string, not null
 * }
 */
export function isAgentTab(tab: Tab): tab is AgentTab {
  return tab.agent !== null;
}

/**
 * `true` for plain login-shell terminals (`kind: "terminal"`, `agent: null`).
 *
 * Use instead of `tab.kind === "terminal"` when plain-shell-specific logic is
 * intended — OMP / codex / claude tabs share `kind: "terminal"` but are not plain.
 *
 * @example
 * const plainShells = tabs.filter(isPlainTerminal);
 */
export function isPlainTerminal(tab: Tab): boolean {
  return tab.kind === "terminal" && tab.agent === null;
}

// ─── Store params ────────────────────────────────────────────────────────────

/**
 * Input shape for {@link TerminalState.openTab}.
 * Callers supply identity + agent metadata; the store fills in lifecycle defaults.
 */
export type OpenTabParams = Pick<
  Tab,
  | "sessionId"
  | "title"
  | "cwd"
  | "kind"
  | "agent"
  | "startCmd"
  | "resumeCmd"
  | "path"
  | "firstMessage"
> & {
  /** Override the auto-generated tab ID. Use when the caller controls the stable key. */
  id?: string;
  /**
   * Open the tab pre-disconnected — no PTY is expected to spawn immediately.
   * Use for tabs restored from disk (sync) that the user hasn't clicked yet.
   * Default: `false` (tab starts in `isLoading / starting` state).
   */
  inactive?: boolean;
};

/**
 * Patch shape for {@link TerminalState.syncTabFromSession}.
 * Only the fields that change when a session is refreshed from disk.
 */
export interface SessionPatch {
  title: string;
  cwd: string;
  path: string;
  firstMessage: string;
  modifiedAt: number;
}

// ─── State interface ─────────────────────────────────────────────────────────

interface TerminalState {
  tabs: Tab[];
  activeTabId: string | null;
  /** Tab temporarily accepting direct keyboard input for an OMP terminal UI. */
  interactiveTabId: string | null;

  /**
   * Open a new terminal tab. Always succeeds — the Rust PTY cache (LRU cap 12)
   * evicts the LRU process when full; the evicted tab's reader thread emits
   * `pty_exit` so the frontend marks it disconnected for reconnect on click.
   */
  openTab: (params: OpenTabParams) => string;

  /**
   * Kill the PTY and remove the tab.
   * Falls back gracefully if the PTY is already dead.
   */
  closeTab: (tabId: string) => Promise<void>;

  /** Switch the visible terminal to `tabId`. */
  setActiveTab: (tabId: string) => void;
  /** Enable direct xterm input while an agent command owns an interactive terminal UI. */
  enableTerminalInteraction: (tabId: string) => void;
  /** Return xterm to passive output-only mode. */
  disableTerminalInteraction: (tabId: string) => void;

  /**
   * Replace a temporary new-session identifier with the ID reported by the agent.
   * If `title` is provided and the tab hasn't been user-renamed, also syncs the title.
   */
  bindTabSession: (tabId: string, sessionId: string, title?: string) => void;

  /**
   * Upsert session metadata onto an existing agent tab from `loadSessions()`.
   * Skips title if the user has manually renamed the tab (`userRenamed: true`).
   * Called by the session store — not by UI components directly.
   */
  syncTabFromSession: (tabId: string, patch: SessionPatch) => void;

  /** Mark a tab's PTY as ready (`isLoading = false`, `error = null`). */
  setTabReady: (tabId: string) => void;
  /**
   * Record a PTY spawn failure.
   * Sets `isLoading = false` and `error = message`.
   */
  setTabError: (tabId: string, message: string) => void;

  /** Update the tab's display title and mark it as user-renamed. */
  updateTabTitle: (tabId: string, title: string) => void;
  /**
   * Sync a tab title from session data — skipped when the user renamed it.
   * Called from the sessions store after `loadSessions` resolves.
   */
  syncTabTitle: (tabId: string, title: string) => void;

  /** Toggle whether a tab floats to the Pinned section in the sidebar. */
  toggleTabPin: (tabId: string) => void;

  /** Reset a failed tab to `isLoading = true` so the caller can re-spawn its PTY. */
  retryTab: (tabId: string) => void;
  /** Apply a structured lifecycle update emitted by the agent's status OSC extension. */
  setTabActivity: (tabId: string, activity: AgentActivity) => void;
  /** Persist plain-text content for a note tab. */
  updateTabContent: (tabId: string, content: string) => void;
  /** Update the user-written note attached to any tab. */
  updateTabNote: (tabId: string, note: string) => void;
  /** Set per-session environment variables for a tab. */
  setTabEnvVars: (tabId: string, vars: EnvVar[]) => void;
  /** Clear unread completion indicator for a tab. */
  markTabRead: (tabId: string) => void;
  /** Set unread completion indicator for a tab. */
  markTabUnread: (tabId: string) => void;
  /** Mark a terminal tab as idle (prompt visible) or busy (command running). */
  setTabIdle: (tabId: string, isIdle: boolean) => void;
}

// ─── Migration helper ────────────────────────────────────────────────────────

/**
 * Upgrades a single persisted tab to the current schema.
 * Handles the `kind: "omp"` → `kind: "terminal", agent: "omp"` migration and
 * backfills all fields added after initial release.
 */
function migratePersistedTab(raw: Tab): Tab {
  const rawKind = (raw as unknown as Record<string, unknown>).kind as string;
  const isLegacyOmp = rawKind === "omp";

  const kind: TabKind = isLegacyOmp ? "terminal" : (rawKind as TabKind);
  const agent: AgentType | null = isLegacyOmp
    ? "omp"
    : (((raw as unknown as Record<string, unknown>).agent as AgentType | null) ?? null);

  // Stale persisted data from before the refactor stored session UUID as tab.id.
  // Regenerate a fresh UUID so tab.id ≠ sessionId (prevents React duplicate keys).
  const id = raw.id === raw.sessionId ? crypto.randomUUID() : raw.id;

  return {
    ...raw,
    id,
    kind,
    agent,
    startCmd: raw.startCmd ?? (agent !== null ? AGENT_START_CMD[agent] : null),
    resumeCmd:
      raw.resumeCmd ?? (agent !== null ? agentResumeCmd(agent, raw.sessionId) : null),
    path: raw.path ?? "",
    firstMessage: raw.firstMessage ?? "",
    content: raw.content ?? "",
    note: raw.note ?? "",
    envVars: raw.envVars ?? [],
    modifiedAt: raw.modifiedAt ?? raw.createdAt,
    isIdle: true,
    hasUnreadCompletion: false,
    activity: { state: "disconnected" },
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

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
        const tab: Tab = {
          id,
          isLoading: isNote || isInactive ? false : true,
          error: isInactive ? "Disconnected — select to reconnect" : null,
          activity: {
            state: isNote ? "waiting_input" : isInactive ? "disconnected" : "starting",
          },
          createdAt: Date.now() / 1000,
          modifiedAt: Date.now() / 1000,
          isPinned: false,
          userRenamed: false,
          kind: params.kind,
          agent: params.agent,
          startCmd: params.startCmd,
          resumeCmd: params.resumeCmd,
          sessionId: params.sessionId,
          path: params.path,
          firstMessage: params.firstMessage,
          note: "",
          envVars: [],
          title: params.title,
          cwd: params.cwd,
          content: "",
          isIdle: true,
          hasUnreadCompletion: false,
        };
        // Idempotent for agent sessions — concurrent loadSessions() calls must not
        // create duplicate tabs for the same sessionId.
        set((s) => {
          if (
            params.agent !== null &&
            s.tabs.some(
              (t) => t.sessionId === params.sessionId && t.agent === params.agent
            )
          ) {
            return s; // already exists — no-op
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
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  isLoading: false,
                  error: null,
                  activity: { state: "waiting_input" },
                }
              : t
          ),
        })),

      setTabError: (tabId, message) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, isLoading: false, error: message, activity: { state: "error" } }
              : t
          ),
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
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  title: t.userRenamed ? t.title : patch.title,
                  cwd: patch.cwd,
                  path: patch.path,
                  firstMessage: patch.firstMessage,
                  modifiedAt: patch.modifiedAt,
                }
              : t
          ),
        })),

      toggleTabPin: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
        })),

      retryTab: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, isLoading: true, error: null, activity: { state: "starting" } }
              : t
          ),
        })),

      bindTabSession: (tabId, sessionId, title) =>
        set((s) => ({
          tabs: s.tabs.map((tab) => {
            if (tab.id !== tabId || tab.agent === null) return tab;
            const agent = tab.agent;
            return {
              ...tab,
              sessionId,
              resumeCmd: agentResumeCmd(agent, sessionId),
              modifiedAt: Date.now() / 1000,
              ...(title && !tab.userRenamed ? { title } : {}),
            };
          }),
        })),

      setTabActivity: (tabId, activity) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, activity, modifiedAt: Date.now() / 1000 } : t
          ),
        })),

      updateTabContent: (tabId, content) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, content, modifiedAt: Date.now() / 1000 } : t
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
          tabs: s.tabs.map((t) =>
            t.id === tabId && t.hasUnreadCompletion
              ? { ...t, hasUnreadCompletion: false }
              : t
          ),
        })),

      markTabUnread: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId && !t.hasUnreadCompletion
              ? { ...t, hasUnreadCompletion: true }
              : t
          ),
        })),
    }),
    {
      name: "piarc-terminal-tabs",
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          isLoading: false,
          isIdle: true,
          hasUnreadCompletion: false,
          activity: { state: "disconnected" },
          error: "Disconnected — select to reconnect",
        })),
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<TerminalState>;
        // Migrate then deduplicate by id — guards against stale persisted data
        // where multiple tabs shared the same session UUID as their id.
        const migrated = (saved.tabs ?? []).map(migratePersistedTab);
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
