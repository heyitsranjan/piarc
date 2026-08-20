/**
 * @module components/shared/ItemIcon
 * Shared icon for sessions and terminals — used by sidebar rows and command palette.
 */
import { MessageSquare, TerminalSquare } from "lucide-react";

export type ItemKind = "session" | "terminal";

interface ItemIconProps {
  kind: ItemKind;
  /** Pixel size; defaults to 13. */
  size?: number;
  className?: string;
}

/** Icon for a session (MessageSquare) or terminal (TerminalSquare). */
export function ItemIcon({ kind, size = 13, className }: ItemIconProps) {
  return kind === "session" ? (
    <MessageSquare size={size} strokeWidth={1.7} className={className} />
  ) : (
    <TerminalSquare size={size} strokeWidth={1.7} className={className} />
  );
}
