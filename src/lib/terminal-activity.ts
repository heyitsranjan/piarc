/**
 * @module lib/terminal-activity
 * Generic terminal idle/busy detection based on shell prompt lines.
 *
 * Strategy:
 * 1. Strip ANSI escape sequences from each PTY chunk.
 * 2. Split into lines and look at the last non-empty line.
 * 3. If the line ends with a common prompt character, the shell is idle.
 *
 * This works for bash/zsh/fish and most custom prompts (starship, oh-my-zsh,
 * powerline) because the prompt character (`$`, `❯`, `➜`, etc.) appears at the
 * end of the prompt line.
 */

const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

const PROMPT_RE = /(?:^|\s)(?:[$#%>>~❯➜λ])(?:\s|$)/;

/** Remove ANSI escape sequences from raw terminal output. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Return true if the chunk ends with a shell prompt line. */
export function isPromptLine(chunk: string): boolean {
  const clean = stripAnsi(chunk);
  const lines = clean.split(/\r?\n/);
  const last = lines.reverse().find((line) => line.trim().length > 0);
  if (!last) return false;
  return PROMPT_RE.test(last.trimEnd());
}
