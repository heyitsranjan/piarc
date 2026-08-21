/**
 * @module components/shared/ItemIcon
 * Unified icon for any sidebar or palette row.
 *
 * - Sessions with agent → {@link AgentIcon} brand mark (e.g. OMP π)
 * - Sessions without agent → `MessageSquare` fallback
 * - Notes    → `FileText`
 * - Agent terminals (omp / codex / claude) → {@link AgentIcon} brand mark
 * - Plain terminals → `TerminalSquare`
 */
import { FileText, MessageSquare, TerminalSquare } from "lucide-react";

import type { AgentType } from "@/store/terminal";

import { AgentIcon } from "./AgentIcon";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Sidebar row category — distinct from {@link AgentType} and `TabKind`. */
export type ItemKind = "session" | "terminal" | "note";

interface ItemIconProps {
  /** Row category — determines the base icon family. */
  kind: ItemKind;
  /**
   * Agent associated with this row.
   * - For `terminal` rows: the agent running in the tab.
   * - For `session` rows: the agent that owns the session.
   * When set, renders the agent's brand icon instead of the generic fallback.
   * Ignored for `note` kind.
   */
  agent?: AgentType | null;
  /** Icon size in pixels. Defaults to `13`. */
  size?: number;
  /** Additional CSS classes — typically a `text-*` color utility. */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders the appropriate icon for a sidebar or palette row.
 *
 * @example
 * // OMP session row — renders the π brand icon
 * <ItemIcon kind="session" agent="omp" size={13} className="text-[var(--color-ink-7)]" />
 *
 * // OMP agent terminal — renders the π brand icon
 * <ItemIcon kind="terminal" agent="omp" size={13} className="text-[var(--color-ink-7)]" />
 *
 * // Plain terminal — renders TerminalSquare
 * <ItemIcon kind="terminal" size={13} className="text-[var(--color-ink-7)]" />
 */
export function ItemIcon({ kind, agent, size = 13, className }: ItemIconProps) {
  if (kind === "note") {
    return <FileText size={size} strokeWidth={1.7} className={className} />;
  }
  if (agent) {
    return <AgentIcon agent={agent} size={size} className={className} />;
  }
  // session without a known agent → generic chat icon; plain terminal → terminal icon
  if (kind === "session") {
    return <MessageSquare size={size} strokeWidth={1.7} className={className} />;
  }
  return <TerminalSquare size={size} strokeWidth={1.7} className={className} />;
}
