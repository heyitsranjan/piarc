/**
 * @module lib/terminal-completion-notification
 * Notify the user when a plain terminal tab finishes a command.
 */
import { sendNotification } from "@tauri-apps/plugin-notification";

const notifiedTabs = new Set<string>();

/**
 * Notify when a terminal tab becomes idle after being busy.
 * Skips the currently active tab and avoids duplicate notifications.
 */
export function notifyTerminalCompletion(
  tabId: string,
  title: string,
  cwd: string,
  activeTabId: string | null
): void {
  if (tabId === activeTabId) return;
  if (notifiedTabs.has(tabId)) return;

  notifiedTabs.add(tabId);
  void sendNotification({
    title: "Terminal finished",
    body: title || cwd || "Command completed",
  });
}

/** Reset notification dedupe for a tab when it becomes busy again. */
export function resetTerminalCompletionNotification(tabId: string): void {
  notifiedTabs.delete(tabId);
}
