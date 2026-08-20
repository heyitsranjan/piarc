/**
 * @module components/shared/ItemIcon
 * Shared icon for sessions and terminals — used by sidebar rows and command palette.
 */
import { FileText, MessageSquare, TerminalSquare } from "lucide-react";

export type ItemKind = "session" | "terminal" | "note";

interface ItemIconProps {
  kind: ItemKind;
  /** Pixel size; defaults to 13. */
  size?: number;
  className?: string;
}

/** Icon for a session, terminal, or note row. */
export function ItemIcon({ kind, size = 13, className }: ItemIconProps) {
  if (kind === "session") {
    return <MessageSquare size={size} strokeWidth={1.7} className={className} />;
  }
  if (kind === "note") {
    return <FileText size={size} strokeWidth={1.7} className={className} />;
  }
  return <TerminalSquare size={size} strokeWidth={1.7} className={className} />;
}
