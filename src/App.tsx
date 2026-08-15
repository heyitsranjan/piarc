/**
 * Root component: applies theme, loads sessions, and subscribes to filesystem updates.
 */
import { useEffect } from "react";

import { listen } from "@tauri-apps/api/event";

import Layout from "@/components/Layout";

import { useTheme } from "@/hooks/useTheme";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";

import { EVENT_SESSIONS_UPDATED } from "@/lib/constants";
import { log } from "@/lib/logger";

export default function App() {
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const refreshOmp = useOmpStore((state) => state.refresh);

  useTheme();

  useEffect(() => {
    void refreshOmp();
  }, [refreshOmp]);

  // Initial load + FS-watcher live refresh
  useEffect(() => {
    loadSessions();
    const unlisten = listen(EVENT_SESSIONS_UPDATED, () => {
      log.debug("sessions_updated event received — reloading");
      loadSessions();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadSessions]);

  return <Layout />;
}
