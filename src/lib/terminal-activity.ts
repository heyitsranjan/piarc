/**
 * @module lib/terminal-activity
 * Generic terminal idle/busy detection based on the xterm.js buffer.
 *
 * Strategy:
 * 1. Inspect the current cursor line in the normal screen buffer.
 * 2. Strip ANSI escape sequences.
 * 3. If the line looks like a shell prompt, the terminal is idle.
 *
 * This works for bash/zsh/fish and most custom prompts (starship, oh-my-zsh,
 * powerline) because the prompt character (`$`, `❯`, `➜`, etc.) appears at the
 * end of the prompt line.
 */
import type { Terminal } from "@xterm/xterm";

/* eslint-disable no-control-regex, no-useless-escape */
const ANSI_RE =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

// Bare prompt at the start of the line (e.g. codex "› ").
// Only matches a prompt char followed by optional whitespace — not echoed
// input like "› tell me a joke" which would false-positive.
const PROMPT_START_RE = /^\s*(?:[$#%›❯➜λ]|[>~]+)\s*$/;
// Prompt at the end of the line (e.g. "~/dir $ ").
const PROMPT_END_RE = /(?:\s|^)(?:[$#%›❯➜λ]|[>~]+)\s*$/;
/* eslint-enable no-control-regex, no-useless-escape */

/** Remove ANSI escape sequences from raw terminal output. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Return the text of the line where the xterm cursor currently sits. */
export function getCursorLine(term: Terminal): string {
  const buffer = term.buffer.active;
  const line = buffer.getLine(buffer.baseY + buffer.cursorY);
  return line ? stripAnsi(line.translateToString(true)) : "";
}

/** Return true if the current cursor line looks like a shell prompt. */
export function isPromptLine(term: Terminal): boolean {
  // Full-screen apps (codex TUI, vim, less) use the alternate buffer.
  // While in alternate buffer, the shell is not at a prompt.
  if (term.buffer.active === term.buffer.alternate) return false;
  const text = getCursorLine(term).trimEnd();
  if (text.length === 0) return false;
  return PROMPT_START_RE.test(text) || PROMPT_END_RE.test(text);
}
