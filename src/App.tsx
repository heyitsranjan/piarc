/**
 * @module App
 * Root component. Responsibilities:
 * 1. Apply dark/light/system theme via `useTheme()`.
 * 2. Load sessions on mount; re-load on `sessions_updated` FS-watcher event.
 * 3. Pre-warm top-3 session PTYs after first load so the first sidebar click
 *    is instant (PTY process already running, just needs to be wired to xterm).
 * 4. Render `<Layout>`.
 */
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import Layout from "@/components/Layout";
import { useTheme } from "@/hooks/useTheme";
import { EVENT_SESSIONS_UPDATED, PREWARM_COUNT } from "@/lib/constants";
import { prewarmPty } from "@/lib/ipc";
import { log } from "@/lib/logger";
import { useSessionStore } from "@/store/sessions";

export default function App() {
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const sessions     = useSessionStore((s) => s.sessions);

  useTheme();

  // Initial load + FS-watcher live refresh
  useEffect(() => {
    loadSessions();
    const unlisten = listen(EVENT_SESSIONS_UPDATED, () => {
      log.debug("sessions_updated event received — reloading");
      loadSessions();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadSessions]);

  // Pre-warm top PREWARM_COUNT sessions after first load
  useEffect(() => {
    if (sessions.length === 0) return;
    const toWarm = sessions.slice(0, PREWARM_COUNT);
    log.debug(`pre-warming ${toWarm.length} sessions`);
    toWarm.forEach((s) => {
      prewarmPty(s.id, s.cwd).catch((err) => {
        log.warn("prewarm failed", { sessionId: s.id, err: String(err) });
      });
    });
  // Run once when sessions first populates (length goes 0 → N)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length > 0]);

  return <Layout />;
}
