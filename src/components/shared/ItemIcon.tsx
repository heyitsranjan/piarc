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

import type { AgentActivityState } from "@/lib/agent-activity";

import { AgentIcon } from "./AgentIcon";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Sidebar row category — distinct from {@link AgentType} and `TabKind`. */
export type ItemKind = "session" | "terminal" | "note";

interface ItemIconProps {
  kind: ItemKind;
  agent?: AgentType | null;
  size?: number;
  className?: string;
  /** Agent activity state — passed to AgentIcon to show working ring. */
  activityState?: AgentActivityState;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ItemIcon({
  kind,
  agent,
  size = 13,
  className,
  activityState,
}: ItemIconProps) {
  if (kind === "note") {
    return <FileText size={size} strokeWidth={1.7} className={className} />;
  }
  if (agent) {
    return (
      <AgentIcon
        agent={agent}
        size={size}
        className={className}
        activityState={activityState}
      />
    );
  }
  if (kind === "session") {
    return <MessageSquare size={size} strokeWidth={1.7} className={className} />;
  }
  return <TerminalSquare size={size} strokeWidth={1.7} className={className} />;
}
