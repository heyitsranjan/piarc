export interface TerminalKeyEvent {
  type: string;
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** True for a plain Shift+Enter chord, on either browser key event phase. */
export function isShiftedEnter(event: TerminalKeyEvent): boolean {
  return (
    event.key === "Enter" &&
    event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

/** xterm modifyOtherKeys encoding understood by OMP's fallback key parser. */
export function shiftedEnterSequence(event: TerminalKeyEvent): string | null {
  return event.type === "keydown" && isShiftedEnter(event) ? "\x1b[27;2;13~" : null;
}
