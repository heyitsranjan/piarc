/**
 * @module components/Terminal/TerminalTab
 * A single terminal pane backed by a Rust PTY process.
 *
 * Handles four explicit states:
 * - loading — PTY is being spawned, shows animated spinner
 * - error   — PTY spawn failed, shows error message + retry button
 * - live    — xterm.js terminal is active and interactive
 * - exited  — process exited naturally, shows exit code + re-open hint
 *
 * PTY output events stream in via `pty_output:<tabId>` Tauri events.
 * Keyboard input is forwarded via `writePty` IPC.
 * Resize synced via `ResizeObserver` → `resizePty` IPC.
 */
import "@xterm/xterm/css/xterm.css";

import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { useTerminal } from "@/hooks/useTerminal";
import { EVENT_PTY_EXIT_PREFIX, EVENT_PTY_OUTPUT_PREFIX } from "@/lib/constants";
import { resizePty, writePty } from "@/lib/ipc";
import type { Tab } from "@/store/terminal";

import { TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS } from "./constants";

interface TerminalTabProps {
  tab: Tab;
  isVisible: boolean;
}

/** xterm.js theme — aligned to omp.sh dark palette. */
const XTERM_THEME = {
  background: "#0f0a14",
  foreground: "#d4cfe8",
  cursor: "#8b7fcf",
  cursorAccent: "#0f0a14",
  selectionBackground: "#3d3464",
  black: "#100e18",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#abb2bf",
  brightBlack: "#5c6370",
  brightRed: "#e06c75",
  brightGreen: "#98c379",
  brightYellow: "#e5c07b",
  brightBlue: "#61afef",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "#ffffff",
};

/** Tracks whether a PTY process has exited naturally (distinct from an error). */
interface ExitInfo {
  code: number;
}

export default function TerminalTab({ tab, isVisible }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [exited, setExited] = useState<ExitInfo | null>(null);
  const { retryTab, closeTab } = useTerminal();

  // ── Mount xterm.js when tab is live (not loading, not error) ─────────────
  useEffect(() => {
    if (tab.isLoading || tab.error !== null) return;

    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: XTERM_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace",
      fontSize:    11.5,
      lineHeight: 1.4,
      cursorStyle: "bar",
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(container);

    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // Canvas fallback — WebGL not available (e.g. CI / headless)
    }

    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    // PTY output → xterm
    const outputKey = `${EVENT_PTY_OUTPUT_PREFIX}:${tab.id}`;
    const exitKey = `${EVENT_PTY_EXIT_PREFIX}:${tab.id}`;

    const unlistenOutput = listen<string>(outputKey, (ev) => {
      // Decode base64 → Uint8Array so xterm.js processes raw bytes,
      // not a binary string where each char is a latin-1 code point.
      // Passing a string causes multi-byte UTF-8 sequences (e.g. ╭ = 0xE2 0x95 0xAD)
      // to be misinterpreted as individual characters, producing â­ garbling.
      const binary = atob(ev.payload);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      term.write(bytes);
    });

    const unlistenExit = listen<number>(exitKey, (ev) => {
      setExited({ code: ev.payload });
      term.write(`\r\n\x1b[2m[process exited with code ${ev.payload}]\x1b[0m\r\n`);
    });

    // xterm input → PTY
    const onDataDispose = term.onData((data) => {
      writePty(tab.id, data).catch(() => {});
    });

    // Container resize → PTY
    const ro = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      const { cols, rows } = termRef.current;
      resizePty(tab.id, cols, rows).catch(() => {});
    });
    ro.observe(container);

    return () => {
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      onDataDispose.dispose();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [tab.id, tab.isLoading, tab.error]);

  // Refit + focus when tab becomes visible
  useEffect(() => {
    if (!isVisible) return;
    setTimeout(() => {
      fitRef.current?.fit();
      termRef.current?.focus();
    }, 0);
  }, [isVisible]);

  return (
    <div
      className="w-full h-full relative"
      style={{ display: isVisible ? "flex" : "none", flexDirection: "column" }}
    >
      {/* ── Loading state ──────────────────────────────────────────────── */}
      {tab.isLoading && (
        <StateOverlay>
          <svg
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-spin text-[var(--color-accent)]"
          >
            <circle cx="8" cy="8" r="6" strokeOpacity="0.2" />
            <path d="M14 8a6 6 0 0 0-6-6" />
          </svg>
          <span className="text-xs text-[var(--color-ink-5)]">Starting terminal…</span>
        </StateOverlay>
      )}

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {!tab.isLoading && tab.error !== null && (
        <StateOverlay>
          <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
            <div className="w-8 h-8 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M8 5v4M8 11v.5" />
                <path d="M6.5 2.5 1 13h14L9.5 2.5a1.7 1.7 0 0 0-3 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-1)] mb-1">
                Terminal failed to start
              </p>
              <p className="text-xs text-[var(--color-ink-7)] font-mono break-all leading-relaxed">
                {tab.error}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  retryTab(tab.id, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS)
                }
                className="px-3 py-1.5 text-xs rounded-[var(--radius-sm)]
                  bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
              <button
                onClick={() => closeTab(tab.id)}
                className="px-3 py-1.5 text-xs rounded-[var(--radius-sm)]
                  text-[var(--color-ink-5)] hover:text-[var(--color-ink-1)]
                  border border-[var(--color-border)] transition-colors"
              >
                Close tab
              </button>
            </div>
          </div>
        </StateOverlay>
      )}

      {/* ── Live terminal ───────────────────────────────────────────────── */}
      {!tab.isLoading && tab.error === null && (
        // flex-col: terminal fills all space; 8px spacer below keeps the last
        // line off the window edge without adding top/bottom padding.
        <div className="flex-1 w-full flex flex-col bg-[#0f0a14] overflow-hidden min-h-0">
          <div ref={containerRef} className="flex-1 w-full min-h-0" />
          <div className="h-2 shrink-0 bg-[#0f0a14]" />
        </div>
      )}

      {/* ── Exited banner (overlaid on terminal, non-blocking) ─────────── */}
      {exited !== null && !tab.isLoading && tab.error === null && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between
          px-4 py-2 bg-[var(--color-bg-elev)]/90 backdrop-blur-sm
          border-t border-[var(--color-border-2)] text-xs"
        >
          <span className="text-[var(--color-ink-7)]">
            Process exited with code{" "}
            <span
              className={
                exited.code === 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }
            >
              {exited.code}
            </span>
          </span>
          <button
            onClick={() => closeTab(tab.id)}
            className="text-[var(--color-ink-5)] hover:text-[var(--color-ink-1)] transition-colors"
          >
            Close tab
          </button>
        </div>
      )}
    </div>
  );
}

/** Centred overlay for loading and error states. */
function StateOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center
      gap-3 bg-[#0f0a14]"
    >
      {children}
    </div>
  );
}
