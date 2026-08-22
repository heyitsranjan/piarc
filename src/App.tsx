/**
 * Root component: applies theme, loads sessions, and subscribes to filesystem updates.
 *
 * activeSession is derived from the active Tab — no separate session lookup needed.
 * Tab[] is the single source of truth; OmpSession is only the wire format from Rust.
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
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const setActiveSession = useSessionStore((state) => state.setActive);
  const checkForUpdate = useOmpStore((state) => state.checkForUpdate);
  const refreshOmp = useOmpStore((state) => state.refresh);

  // Derive activeSession from the active Tab — Tab[] is the source of truth.
  // No sessions[] lookup needed; path/title/cwd/firstMessage are all on Tab.
  const activeTab = useTerminalStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId)
  );

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

  // Sync activeSession from the active omp Tab — shape matches OmpSession.
  useEffect(() => {
    if (activeTab?.agent === "omp") {
      setActiveSession({
        id: activeTab.sessionId,
        path: activeTab.path,
        title: activeTab.title,
        cwd: activeTab.cwd,
        modified: Math.floor(activeTab.modifiedAt),
        firstMessage: activeTab.firstMessage,
      });
    } else {
      setActiveSession(null);
    }
  }, [activeTab, setActiveSession]);

  // Initial load + FS-watcher live refresh.
  // loadSessions() auto-upserts on-disk sessions into Tab[].
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
