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
import type { ReactNode } from "react";
import { memo, useEffect, useRef, useState } from "react";

import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";

import { ArrowDownToLine } from "lucide-react";

import { useTerminal } from "@/hooks/useTerminal";

import { useSessionStore } from "@/store/sessions";
import type { Tab } from "@/store/terminal";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import {
  AGENT_ACTIVITY_OSC,
  isAgentCompletion,
  parseAgentActivity,
} from "@/lib/agent-activity";
import { notifyAgentCompletion } from "@/lib/agent-completion-notification";
import { EVENT_PTY_EXIT_PREFIX, EVENT_PTY_OUTPUT_PREFIX } from "@/lib/constants";
import { FEATURE_RICH_INPUT } from "@/lib/features";
import { resizePty, writePty } from "@/lib/ipc";
import { isPromptLine } from "@/lib/terminal-activity";
import {
  notifyTerminalCompletion,
  resetTerminalCompletionNotification,
} from "@/lib/terminal-completion-notification";
import { isShiftedEnter } from "@/lib/terminal-keys";
import {
  SCROLL_TO_BOTTOM_WHEEL_THRESHOLD_PX,
  animateTerminalToBottom,
  shouldShowScrollToBottom,
} from "@/lib/terminal-scroll";

import { TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS } from "./constants";

interface TerminalTabProps {
  tab: Tab;
  isVisible: boolean;
}

/** xterm.js theme — ANSI palette from Warp dark + HackerRank Pair. */
const XTERM_THEME = {
  background: "#090a0c", // canvas matches the application body
  foreground: "#f0f1f5", // primary text
  cursor: "#3ddc84", // accent green cursor
  cursorAccent: "#090a0c",
  selectionBackground: "#2a2d36",
  black: "#1e2028",
  red: "#f15b5b",
  green: "#3ddc84",
  yellow: "#f2c94c",
  blue: "#4ea1ff",
  magenta: "#c792ea",
  cyan: "#89ddff",
  white: "#c8cdd8",
  brightBlack: "#636878",
  brightRed: "#ff8272",
  brightGreen: "#5ae898",
  brightYellow: "#fefdc2",
  brightBlue: "#82aaff",
  brightMagenta: "#e599f7",
  brightCyan: "#89ddff",
  brightWhite: "#f0f1f5",
};

const PASSIVE_XTERM_THEME = { ...XTERM_THEME, cursor: "transparent" };

const TERMINAL_NAVIGATION_INPUT: Readonly<Record<string, true>> = {
  "\r": true,
  "\t": true,
  "\x03": true, // Ctrl+C
  "\x1b": true,
  "\x1b[A": true,
  "\x1b[B": true,
  "\x1b[C": true,
  "\x1b[D": true,
  "\x1b[H": true,
  "\x1b[F": true,
  "\x1bOH": true,
  "\x1bOF": true,
  "\x1b[5~": true,
  "\x1b[6~": true,
  "\x1b[Z": true,
};
function isTerminalNavigationInput(data: string): boolean {
  return (
    TERMINAL_NAVIGATION_INPUT[data] === true ||
    (data.startsWith("\x1b[1;") && /^\d+[A-DHF]$/.test(data.slice(4)))
  );
}

/** Tracks whether a PTY process has exited naturally (distinct from an error). */
interface ExitInfo {
  code: number;
}

const TerminalTab = memo(function TerminalTab({ tab, isVisible }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const richInputPreference = useUiStore((state) => state.richInputEnabled);
  const richInputEnabled =
    FEATURE_RICH_INPUT && richInputPreference && tab.agent !== null;
  const richInputEnabledRef = useRef(richInputEnabled);
  const [exited, setExited] = useState<ExitInfo | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const isScrolledUpRef = useRef(false);
  const cancelScrollAnimationRef = useRef<(() => void) | null>(null);
  const activityRef = useRef(tab.activity);
  const tabTitleRef = useRef(tab.title);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const { retryTab, closeTab } = useTerminal();
  const setTabActivity = useTerminalStore((s) => s.setTabActivity);
  const bindTabSession = useTerminalStore((s) => s.bindTabSession);
  const setTabIdle = useTerminalStore((s) => s.setTabIdle);
  const markTabUnread = useTerminalStore((s) => s.markTabUnread);
  const disableTerminalInteraction = useTerminalStore(
    (s) => s.disableTerminalInteraction
  );
  const interactiveCommandEnabled = useTerminalStore(
    (s) => s.interactiveTabId === tab.id
  );
  const terminalInputEnabled =
    isVisible && (!richInputEnabled || interactiveCommandEnabled);

  useEffect(() => {
    activityRef.current = tab.activity;
    tabTitleRef.current = tab.title;
  }, [tab.activity, tab.title]);

  useEffect(() => {
    richInputEnabledRef.current = richInputEnabled;
  }, [richInputEnabled]);

  // ── Mount xterm.js when tab is live (not loading, not error) ─────────────
  useEffect(() => {
    if (tab.isLoading || tab.error !== null) return;

    const container = containerRef.current;
    if (!container) return;
    isScrolledUpRef.current = false;
    setIsScrolledUp(false);

    const term = new Terminal({
      theme: PASSIVE_XTERM_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace",
      fontSize: 11,
      lineHeight: 1.4,
      cursorStyle: "bar",
      cursorBlink: false,
      cursorInactiveStyle: "none",
      disableStdin: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon((_event, uri) => {
      open(uri).catch(() => {});
    });
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(container);

    term.attachCustomKeyEventHandler((event) => {
      if (!isShiftedEnter(event)) return true;
      // Only handle the keydown phase; the keypress phase would double-fire.
      if (event.type !== "keydown") return false;
      // In rich mode, send OMP's modifyOtherKeys sequence so OMP inserts a
      // newline in its TUI.  In direct mode, send a line feed (\n) so the
      // shell inserts a newline without submitting the command.
      if (richInputEnabledRef.current) {
        writePty(tab.id, "\x1b[27;2;13~").catch(() => {});
      } else {
        writePty(tab.id, "\n").catch(() => {});
      }
      return false;
    });

    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const statusDispose = term.parser.registerOscHandler(AGENT_ACTIVITY_OSC, (data) => {
      if (tab.agent === null) return false;
      const activity = parseAgentActivity(data);
      if (!activity) return false;
      const previousActivity = activityRef.current;
      const nextActivity = { state: activity.state, detail: activity.detail };
      activityRef.current = nextActivity;
      if (activity.sessionId) {
        // Only bind when the sessionId belongs to a known on-disk session.
        // Subagent sessions (depth-3 JSONL) are excluded by list_sessions,
        // so binding their ID would orphan the tab as a "pending session"
        // in the sidebar. Keep the tab bound to its main session.
        const sess = useSessionStore
          .getState()
          .sessions.find((s) => s.id === activity.sessionId);
        if (sess) {
          bindTabSession(tab.id, activity.sessionId, sess.title);
        }
      }
      if (isAgentCompletion(previousActivity, nextActivity)) {
        const isActiveTab = activeTabIdRef.current === tab.id;
        notifyAgentCompletion(tabTitleRef.current, isActiveTab).catch(() => {});
        if (!isActiveTab) markTabUnread(tab.id);
      }
      return true;
    });

    // OSC 133 (FinalTerm) shell-integration markers — emitted by the shell
    // integration script injected at PTY spawn.  `A` = prompt visible (idle),
    // `C` = command output started (busy), `D` = command finished (idle).
    // Only applies to plain terminals; OMP sessions use the agent-activity OSC.
    const shellIntegDispose = term.parser.registerOscHandler(133, (data) => {
      if (tab.agent !== null) return false;
      const mark = data.charAt(0);
      if (mark === "A" || mark === "D") {
        setTabIdle(tab.id, true);
        notifyTerminalCompletion(
          tab.id,
          tab.title,
          tab.cwd,
          useTerminalStore.getState().activeTabId
        );
      } else if (mark === "C") {
        setTabIdle(tab.id, false);
        resetTerminalCompletionNotification(tab.id);
      }
      return true;
    });

    let upwardWheelDistance = 0;
    const setScrollControlVisible = (visible: boolean) => {
      if (visible === isScrolledUpRef.current) return;
      isScrolledUpRef.current = visible;
      setIsScrolledUp(visible);
    };

    const scrollDispose = term.onScroll((viewportY) => {
      const shouldShow = shouldShowScrollToBottom(viewportY, term.buffer.active.baseY);
      if (!shouldShow) upwardWheelDistance = 0;
      setScrollControlVisible(shouldShow);
    });

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      if (
        shouldShowScrollToBottom(term.buffer.active.viewportY, term.buffer.active.baseY)
      ) {
        setScrollControlVisible(true);
        return;
      }
      if (event.deltaY > 0) {
        upwardWheelDistance = 0;
        setScrollControlVisible(false);
        return;
      }
      upwardWheelDistance += -event.deltaY;
      setScrollControlVisible(upwardWheelDistance >= SCROLL_TO_BOTTOM_WHEEL_THRESHOLD_PX);
    };
    container.addEventListener("wheel", onWheel, { passive: true });

    // PTY output → xterm
    const outputKey = `${EVENT_PTY_OUTPUT_PREFIX}:${tab.id}`;
    const exitKey = `${EVENT_PTY_EXIT_PREFIX}:${tab.id}`;
    const checkIdle = () => {
      if (isPromptLine(term)) {
        setTabIdle(tab.id, true);
        notifyTerminalCompletion(
          tab.id,
          tab.title,
          tab.cwd,
          useTerminalStore.getState().activeTabId
        );
      }
    };

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const unlistenOutput = listen<string>(outputKey, (ev) => {
      const binary = atob(ev.payload);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      term.write(bytes);
      // Detect shell prompt return after the terminal has rendered.
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(checkIdle, 50);
    });

    let wasAltBuffer = false;
    // When a full-screen app (codex, vim, less, htop…) exits the alternate
    // buffer, xterm restores the normal buffer at its pre-existing scroll
    // position — often the top of scrollback.  Snap to bottom on alt→normal
    // and re-check whether the shell prompt is now visible.
    const bufferDispose = term.buffer.onBufferChange((buffer) => {
      const isAlt = buffer === term.buffer.alternate;
      if (wasAltBuffer && !isAlt) {
        term.scrollToBottom();
        checkIdle();
      }
      wasAltBuffer = isAlt;
    });

    const unlistenExit = listen<number>(exitKey, (ev) => {
      setExited({ code: ev.payload });
      term.write(`\r\n\x1b[2m[process exited with code ${ev.payload}]\x1b[0m\r\n`);
      setTabActivity(tab.id, {
        state: ev.payload === 0 ? "done" : "error",
        detail: `Process exited with code ${ev.payload}`,
      });
    });

    // Direct mode forwards all input. Rich mode limits xterm to OMP menu controls.
    const onDataDispose = term.onData((data) => {
      if (richInputEnabledRef.current && !isTerminalNavigationInput(data)) return;
      writePty(tab.id, data).catch(() => {});
      // Enter in a plain terminal likely submitted a command.
      if (data === "\r" && tab.agent === null) {
        setTabIdle(tab.id, false);
        resetTerminalCompletionNotification(tab.id);
      }
      if (richInputEnabledRef.current && data === "\x1b") {
        disableTerminalInteraction(tab.id);
      }
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
      bufferDispose.dispose();
      onDataDispose.dispose();
      shellIntegDispose.dispose();
      statusDispose.dispose();
      cancelScrollAnimationRef.current?.();
      cancelScrollAnimationRef.current = null;
      scrollDispose.dispose();
      container.removeEventListener("wheel", onWheel);
      ro.disconnect();
      if (idleTimer) clearTimeout(idleTimer);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [
    bindTabSession,
    disableTerminalInteraction,
    setTabActivity,
    setTabIdle,
    tab.id,
    tab.isLoading,
    tab.error,
    tab.agent,
    tab.title,
    tab.cwd,
  ]);

  // Direct mode gives the visible terminal normal stdin. Rich mode enables
  // xterm only while an OMP command owns an interactive terminal menu.
  // NOTE: We intentionally do NOT swap `term.options.theme` here. Reassigning
  // the theme object mid-stream (especially during alt-buffer transitions in
  // full-screen TUIs like codex) forces xterm.js to re-evaluate every
  // rendered cell, producing a blank/wrong-color flash. The only visual
  // difference between XTERM_THEME and PASSIVE_XTERM_THEME is the cursor
  // color, which we handle via cursorBlink/cursorInactiveStyle instead.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.disableStdin = !terminalInputEnabled;
    term.options.cursorBlink = terminalInputEnabled;
    if (terminalInputEnabled) {
      window.requestAnimationFrame(() => term.focus());
    } else {
      term.blur();
    }
  }, [terminalInputEnabled, tab.isLoading, tab.error]);

  return (
    <div
      className="terminal-pane relative flex h-full w-full flex-col"
      data-terminal-interactive={terminalInputEnabled}
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
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--color-bg)] p-2">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div ref={containerRef} className="min-h-0 w-full flex-1" />
          </div>
        </div>
      )}

      {isScrolledUp && !tab.isLoading && tab.error === null && (
        <button
          type="button"
          onClick={() => {
            const term = termRef.current;
            if (!term) return;
            isScrolledUpRef.current = false;
            setIsScrolledUp(false);
            cancelScrollAnimationRef.current?.();
            cancelScrollAnimationRef.current = animateTerminalToBottom(term);
          }}
          className="absolute bottom-5 right-5 z-10 grid size-8 place-items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] text-[var(--color-ink-3)] shadow-lg transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          title="Scroll terminal to bottom"
          aria-label="Scroll terminal to bottom"
        >
          <ArrowDownToLine size={14} strokeWidth={1.8} aria-hidden />
        </button>
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
});

export default TerminalTab;

/** Centred overlay for loading and error states. */
function StateOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center
      gap-3 bg-[var(--color-bg)]"
    >
      {children}
    </div>
  );
}
