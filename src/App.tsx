/**
 * Root component: applies theme, loads sessions, and subscribes to filesystem updates.
 */
import { useEffect } from "react";

import { listen } from "@tauri-apps/api/event";

import Layout from "@/components/Layout";

import { useTheme } from "@/hooks/useTheme";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";

import { EVENT_SESSIONS_UPDATED } from "@/lib/constants";
import { log } from "@/lib/logger";

const OMP_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export default function App() {
  const sessions = useSessionStore((state) => state.sessions);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const setActiveSession = useSessionStore((state) => state.setActive);
  const activeSessionId = useTerminalStore((state) => {
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    return activeTab?.kind === "omp" ? activeTab.sessionId : null;
  });
  const checkForUpdate = useOmpStore((state) => state.checkForUpdate);
  const refreshOmp = useOmpStore((state) => state.refresh);

  useTheme();

  useEffect(() => {
    const refreshAndCheck = async () => {
      await refreshOmp();
      if (useOmpStore.getState().status?.installed) await checkForUpdate();
    };
    void refreshAndCheck();
    const timer = window.setInterval(() => {
      if (useOmpStore.getState().status?.installed) void checkForUpdate();
    }, OMP_UPDATE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [checkForUpdate, refreshOmp]);

  // The visible PTY is authoritative; sidebar selection follows its OMP session ID.
  useEffect(() => {
    setActiveSession(sessions.find((session) => session.id === activeSessionId) ?? null);
  }, [activeSessionId, sessions, setActiveSession]);

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
