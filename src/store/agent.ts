/**
 * @module store/agent
 *
 * Per-agent capability registry. Each entry describes the CLI binary, which
 * optional operations the agent supports, and how to build the shell commands
 * for those operations.
 *
 * Backward-compat wrappers for the old free-function API are re-exported at
 * the bottom so existing callers don't need to change.
 */
import type { AgentType } from "@/store/terminal";

// ─── Capabilities interface ───────────────────────────────────────────────────

export interface AgentCapabilities {
  /** The AgentType key this entry represents. */
  readonly type: AgentType;
  /** Top-level CLI binary name (no args). */
  readonly binary: string;
  /** Whether the agent supports `rename` on an existing session. */
  readonly supportsRename: boolean;
  /** Whether the agent supports `delete` on an existing session. */
  readonly supportsDelete: boolean;
  /**
   * Whether the agent writes JSONL session files to disk that the harness
   * can read (currently OMP-only).
   */
  readonly supportsSessionFiles: boolean;
  /** Shell command to start a new session. */
  startCmd(): string;
  /** Shell command to resume a persisted session by id. */
  resumeCmd(sessionId: string): string;
  /**
   * Shell command to rename a session, or `null` when unsupported.
   * The title is POSIX-shell single-quote escaped.
   */
  renameCmd(sessionId: string, title: string): string | null;
  /** Shell command to delete a session, or `null` when unsupported. */
  deleteCmd(sessionId: string): string | null;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const AGENT_REGISTRY: Record<AgentType, AgentCapabilities> = {
  omp: {
    type: "omp",
    binary: "omp",
    supportsRename: true,
    supportsDelete: true,
    supportsSessionFiles: true,
    startCmd: () => "omp",
    resumeCmd: (sessionId) => `omp --resume ${sessionId}`,
    renameCmd: (sessionId, title) => {
      const escaped = `'${title.replace(/'/g, "'\\''")}'`;
      return `omp rename ${sessionId} ${escaped}`;
    },
    deleteCmd: (sessionId) => `omp delete ${sessionId}`,
  },

  codex: {
    type: "codex",
    binary: "codex",
    supportsRename: false,
    supportsDelete: false,
    supportsSessionFiles: false,
    startCmd: () => "codex",
    resumeCmd: (sessionId) => `codex --resume ${sessionId}`,
    renameCmd: () => null,
    deleteCmd: () => null,
  },

  claude: {
    type: "claude",
    binary: "claude",
    supportsRename: false,
    supportsDelete: false,
    supportsSessionFiles: false,
    startCmd: () => "claude",
    resumeCmd: (sessionId) => `claude --resume ${sessionId}`,
    renameCmd: () => null,
    deleteCmd: () => null,
  },
};

// ─── Backward-compat re-exports ───────────────────────────────────────────────
// These preserve the original free-function API so existing callers need no
// changes. Each wrapper delegates to AGENT_REGISTRY.
/** Launch command string keyed by agent; delegates to {@link AGENT_REGISTRY}. */
export const AGENT_START_CMD: Record<AgentType, string> = {
  omp: AGENT_REGISTRY.omp.binary,
  codex: AGENT_REGISTRY.codex.binary,
  claude: AGENT_REGISTRY.claude.binary,
};

/** Builds the resume command for an agent session; delegates to {@link AGENT_REGISTRY}. */
export function agentResumeCmd(agent: AgentType, sessionId: string): string {
  return AGENT_REGISTRY[agent].resumeCmd(sessionId);
}

/** Builds the rename command for an agent session; delegates to {@link AGENT_REGISTRY}. */
export function agentRenameCmd(
  agent: AgentType,
  sessionId: string,
  title: string
): string {
  return AGENT_REGISTRY[agent].renameCmd(sessionId, title) ?? "";
}

/** Builds the delete command for an agent session; delegates to {@link AGENT_REGISTRY}. */
export function agentDeleteCmd(agent: AgentType, sessionId: string): string {
  return AGENT_REGISTRY[agent].deleteCmd(sessionId) ?? "";
}
