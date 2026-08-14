/**
 * @module App
 * Root component. Responsibilities:
 * 1. Apply theme via `useTheme()` (dark/light/system).
 * 2. Trigger initial session load on mount.
 * 3. Subscribe to `sessions_updated` Tauri FS-watcher event for live refresh.
 * 4. Render `<Layout>`.
 */
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import Layout from "@/components/Layout";
import { useTheme } from "@/hooks/useTheme";
import { EVENT_SESSIONS_UPDATED } from "@/lib/constants";
import { useSessionStore } from "@/store/sessions";

export default function App() {
  const loadSessions = useSessionStore((s) => s.loadSessions);

  // Apply dark/light/system theme to <html>
  useTheme();

  useEffect(() => {
    loadSessions();

    // Live refresh whenever the Rust FS watcher fires
    const unlisten = listen(EVENT_SESSIONS_UPDATED, () => loadSessions());
    return () => { unlisten.then((fn) => fn()); };
  }, [loadSessions]);

  return <Layout />;
}
