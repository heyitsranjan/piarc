import { useEffect, useMemo, useRef, useState } from "react";

import { CornerDownLeft, File, Loader2, Square, TerminalSquare } from "lucide-react";

import { type Tab, useTerminalStore } from "@/store/terminal";

import { isAgentWorking } from "@/lib/agent-activity";
import {
  type OmpCommand,
  type OmpPathSuggestion,
  listOmpCommands,
  listOmpPaths,
  writePty,
} from "@/lib/ipc";

import TerminalBottomBar from "./TerminalBottomBar";

interface CompletionContext {
  kind: "command" | "subcommand" | "path";
  start: number;
  query: string;
  command?: OmpCommand;
}

interface RichInputProps {
  tab: Tab;
}

interface CompletionItem {
  key: string;
  label: string;
  description?: string | null;
  kind: CompletionContext["kind"];
  value: string;
  isDirectory?: boolean;
}

const commandCache = new Map<string, OmpCommand[]>();
const commandRequests = new Map<string, Promise<OmpCommand[]>>();

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  if (target === query) return 1_000;
  if (target.startsWith(query)) return 900;
  if (target.includes(query)) return 700;

  let queryIndex = 0;
  let gaps = 0;
  let previous = -1;
  for (let index = 0; index < target.length && queryIndex < query.length; index += 1) {
    if (target[index] !== query[queryIndex]) continue;
    if (previous >= 0 && index > previous + 1) gaps += 1;
    previous = index;
    queryIndex += 1;
  }
  return queryIndex === query.length ? 400 - gaps * 5 : 0;
}

function findCompletionContext(
  value: string,
  cursor: number,
  commands: OmpCommand[]
): CompletionContext | null {
  const beforeCursor = value.slice(0, cursor);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const previousLines = beforeCursor.slice(0, lineStart);
  const currentLine = beforeCursor.slice(lineStart);

  if (!previousLines.trim()) {
    const commandMatch = /^\s*\/([^\s/]*)$/.exec(currentLine);
    if (commandMatch) {
      return {
        kind: "command",
        start: lineStart + currentLine.indexOf("/"),
        query: commandMatch[1] ?? "",
      };
    }

    const argumentMatch = /^\s*\/([^\s/]+)\s+([^\s]*)$/.exec(currentLine);
    if (argumentMatch) {
      const name = argumentMatch[1] ?? "";
      const command = commands.find(
        (candidate) => candidate.name === name || candidate.aliases.includes(name)
      );
      if (command?.subcommands.length) {
        const query = argumentMatch[2] ?? "";
        return {
          kind: "subcommand",
          start: cursor - query.length,
          query,
          command,
        };
      }
    }
  }

  const mentionMatch = /(?:^|[\s"'=])(@(?:"[^"]*|[^\s@]*))$/.exec(beforeCursor);
  if (!mentionMatch) return null;
  const token = mentionMatch[1] ?? "";
  return {
    kind: "path",
    start: cursor - token.length,
    query: token.startsWith('@"') ? token.slice(2) : token.slice(1),
  };
}

function commandItems(
  commands: OmpCommand[],
  context: CompletionContext
): CompletionItem[] {
  const query = context.query.toLowerCase();
  if (context.kind === "subcommand") {
    return (context.command?.subcommands ?? [])
      .map((subcommand) => ({
        item: {
          key: `subcommand:${context.command?.name}:${subcommand.name}`,
          label: subcommand.name,
          description: subcommand.description,
          kind: "subcommand" as const,
          value: subcommand.name,
        },
        score: fuzzyScore(
          query,
          `${subcommand.name} ${subcommand.description ?? ""}`.toLowerCase()
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  return commands
    .map((command) => {
      const searchable = [command.name, ...command.aliases, command.description ?? ""]
        .join(" ")
        .toLowerCase();
      return {
        item: {
          key: `command:${command.name}`,
          label: `/${command.name}`,
          description: [command.description, command.input?.hint]
            .filter(Boolean)
            .join(" · "),
          kind: "command" as const,
          value: command.name,
        },
        score: Math.max(
          fuzzyScore(query, command.name.toLowerCase()),
          ...command.aliases.map((alias) => fuzzyScore(query, alias.toLowerCase())),
          fuzzyScore(query, searchable)
        ),
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function pathItems(paths: OmpPathSuggestion[]): CompletionItem[] {
  return paths.map((entry) => ({
    key: `path:${entry.path}:${entry.isDirectory}`,
    label: `${entry.path.split("/").pop() ?? entry.path}${entry.isDirectory ? "/" : ""}`,
    description: entry.path,
    kind: "path",
    value: entry.path,
    isDirectory: entry.isDirectory,
  }));
}

function needsTerminalInteraction(value: string, commands: OmpCommand[]): boolean {
  const match = /^\s*\/([^\s/]+)(?:\s+([\s\S]*))?$/.exec(value);
  if (!match) return false;

  const name = match[1] ?? "";
  const argument = match[2]?.trim() ?? "";
  const command = commands.find(
    (candidate) => candidate.name === name || candidate.aliases.includes(name)
  );

  // RPC omits TUI-only commands. Unknown slash commands get the safe handoff,
  // allowing current and future selectors such as /settings to remain usable.
  if (!command) return true;
  if (command.source && command.source !== "builtin") return false;

  // A structured argument bypasses the selector for parameterized built-ins.
  if (
    argument &&
    (command.input?.hint ||
      command.subcommands.some(
        (subcommand) => subcommand.name === argument.split(/\s+/, 1)[0]
      ))
  ) {
    return false;
  }
  return true;
}

export default function RichInput({ tab }: RichInputProps) {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commands, setCommands] = useState<OmpCommand[]>(
    () => commandCache.get(tab.cwd) ?? []
  );
  const [paths, setPaths] = useState<OmpPathSuggestion[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(false);
  const [loadingPaths, setLoadingPaths] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const enableTerminalInteraction = useTerminalStore(
    (state) => state.enableTerminalInteraction
  );
  const disableTerminalInteraction = useTerminalStore(
    (state) => state.disableTerminalInteraction
  );
  const terminalInteractionEnabled = useTerminalStore(
    (state) => state.interactiveTabId === tab.id
  );
  const wasTerminalInteractionEnabled = useRef(false);

  useEffect(() => {
    if (wasTerminalInteractionEnabled.current && !terminalInteractionEnabled) {
      window.requestAnimationFrame(() =>
        inputRef.current?.focus({ preventScroll: true })
      );
    }
    wasTerminalInteractionEnabled.current = terminalInteractionEnabled;
  }, [terminalInteractionEnabled]);

  useEffect(() => {
    if (commandCache.has(tab.cwd)) return;

    let cancelled = false;
    let timer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        setLoadingCommands(true);
        setCompletionError(false);
        let request = commandRequests.get(tab.cwd);
        if (!request) {
          request = listOmpCommands(tab.cwd).then((items) => {
            commandCache.set(tab.cwd, items);
            return items;
          });
          commandRequests.set(tab.cwd, request);
          void request.then(
            () => commandRequests.delete(tab.cwd),
            () => commandRequests.delete(tab.cwd)
          );
        }
        void request
          .then((items) => {
            if (!cancelled) setCommands(items);
          })
          .catch(() => {
            if (!cancelled) {
              setCommands([]);
              setCompletionError(true);
            }
          })
          .finally(() => {
            if (!cancelled) setLoadingCommands(false);
          });
      }, 0);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [tab.cwd]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [value]);

  const context = useMemo(
    () => findCompletionContext(value, cursor, commands),
    [commands, cursor, value]
  );

  useEffect(() => {
    if (context?.kind !== "path") {
      setPaths([]);
      setLoadingPaths(false);
      return;
    }

    let cancelled = false;
    setLoadingPaths(true);
    const timer = window.setTimeout(() => {
      void listOmpPaths(tab.cwd, context.query)
        .then((items) => {
          if (!cancelled) {
            setPaths(items);
            setCompletionError(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPaths([]);
            setCompletionError(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingPaths(false);
        });
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [context?.kind, context?.query, tab.cwd]);

  const completions = useMemo(() => {
    if (!context) return [];
    return context.kind === "path"
      ? pathItems(paths).slice(0, 10)
      : commandItems(commands, context).slice(0, 10);
  }, [commands, context, paths]);

  const completionKey = `${value}:${cursor}`;
  const completionOpen =
    context !== null &&
    dismissedAt !== completionKey &&
    (completions.length > 0 || loadingPaths);

  useEffect(() => {
    setSelectedIndex(0);
  }, [context?.kind, context?.query]);

  useEffect(() => {
    if (selectedIndex >= completions.length) setSelectedIndex(0);
  }, [completions.length, selectedIndex]);

  const updateCursor = (input: HTMLTextAreaElement) => {
    setCursor(input.selectionStart);
    setDismissedAt(null);
  };

  const applyCompletion = (item: CompletionItem) => {
    if (!context) return;
    let insert: string;
    if (item.kind === "command") {
      insert = `/${item.value} `;
    } else if (item.kind === "subcommand") {
      insert = `${item.value} `;
    } else {
      const path = `${item.value}${item.isDirectory ? "/" : ""}`;
      insert = path.includes(" ")
        ? `@"${path}${item.isDirectory ? "" : '"'}`
        : `@${path}`;
      if (!item.isDirectory) insert += " ";
    }

    const next = value.slice(0, context.start) + insert + value.slice(cursor);
    const nextCursor = context.start + insert.length;
    setValue(next);
    setCursor(nextCursor);
    setPaths([]);
    setDismissedAt(`${next}:${nextCursor}`);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const submit = async () => {
    if (!value || sending || tab.isLoading || tab.error) return;
    const handOffToTerminal = needsTerminalInteraction(value, commands);
    if (handOffToTerminal) enableTerminalInteraction(tab.id);
    setSending(true);
    try {
      await writePty(tab.id, `${value}\r`);
      setValue("");
      setCursor(0);
      setError(null);
      setDismissedAt(null);
      if (!handOffToTerminal) inputRef.current?.focus({ preventScroll: true });
    } catch (cause) {
      if (handOffToTerminal) disableTerminalInteraction(tab.id);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  };

  const interrupt = async () => {
    try {
      await writePty(tab.id, "\x1b");
      inputRef.current?.focus({ preventScroll: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const disabled = sending || tab.isLoading || tab.error !== null;

  return (
    <>
      <div className="relative shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
        {completionOpen && (
          <div
            role="listbox"
            aria-label="OMP completions"
            className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-60 overflow-y-auto rounded-[var(--radius-sm)]
            border border-[var(--color-border)] bg-[var(--color-bg-elev)] py-1 shadow-[0_-12px_32px_rgba(0,0,0,0.32)]"
          >
            {loadingPaths && completions.length === 0 ? (
              <div className="flex h-9 items-center gap-2 px-3 text-[11px] text-[var(--color-ink-7)]">
                <Loader2 size={12} className="animate-spin" /> Finding files…
              </div>
            ) : (
              completions.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyCompletion(item);
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left outline-none focus:outline-none
                  focus-visible:outline-none ${
                    index === selectedIndex ? "bg-[var(--color-bg-hover)]" : ""
                  }`}
                >
                  {item.kind === "path" ? (
                    <File size={12} className="shrink-0 text-[var(--color-ink-7)]" />
                  ) : (
                    <TerminalSquare
                      size={12}
                      className="shrink-0 text-[var(--color-accent)]"
                    />
                  )}
                  <span className="shrink-0 font-mono text-[11px] text-[var(--color-ink-1)]">
                    {item.label}
                  </span>
                  {item.description && item.description !== item.label && (
                    <span className="min-w-0 truncate text-[10px] text-[var(--color-ink-7)]">
                      {item.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-input)]">
          <div className="flex items-end gap-1.5 p-1.5">
            <textarea
              ref={inputRef}
              autoFocus
              rows={1}
              value={value}
              disabled={disabled}
              aria-label="Rich terminal input"
              placeholder={
                tab.isLoading ? "Terminal is starting…" : "Send input to terminal…"
              }
              onFocus={() => disableTerminalInteraction(tab.id)}
              onChange={(event) => {
                setValue(event.target.value);
                updateCursor(event.target);
              }}
              onClick={(event) => updateCursor(event.currentTarget)}
              onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
              onKeyDown={(event) => {
                if (
                  completionOpen &&
                  completions.length > 0 &&
                  !event.shiftKey &&
                  !event.metaKey
                ) {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    setSelectedIndex(
                      (selectedIndex + direction + completions.length) %
                        completions.length
                    );
                    return;
                  }
                  if (
                    event.key === "Tab" ||
                    (event.key === "Enter" && !event.ctrlKey && !event.altKey)
                  ) {
                    event.preventDefault();
                    applyCompletion(completions[selectedIndex]);
                    return;
                  }
                }
                if (event.key === "Escape" && completionOpen) {
                  event.preventDefault();
                  setDismissedAt(completionKey);
                  return;
                }
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  !event.metaKey
                ) {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="rich-input-control min-h-8 max-h-[120px] min-w-0 flex-1 resize-none overflow-y-auto
              bg-transparent px-1.5 py-1 font-mono text-[12px] leading-5 text-[var(--color-ink-1)]
              placeholder:text-[var(--color-ink-9)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isAgentWorking(tab.activity) && (
              <button
                type="button"
                onClick={() => void interrupt()}
                title="Stop agent (Esc Esc)"
                aria-label="Stop agent"
                className="rich-input-control flex h-8 w-8 shrink-0 items-center justify-center
                rounded-[var(--radius-sm)] bg-[var(--color-danger)] text-white transition-opacity
                hover:opacity-90"
              >
                <Square size={12} fill="currentColor" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={disabled || !value}
              title="Send to terminal"
              aria-label="Send to terminal"
              className="rich-input-control flex h-8 w-8 shrink-0 items-center justify-center
              rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-bg)] transition-opacity
              hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CornerDownLeft size={14} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>
      <TerminalBottomBar
        left={error ?? (completionError ? "Completion unavailable" : "Ready")}
        right={
          <span>
            {loadingCommands
              ? "Reading active OMP commands…"
              : "OMP completions · ↑↓ choose · Tab accept"}
          </span>
        }
      />
    </>
  );
}
