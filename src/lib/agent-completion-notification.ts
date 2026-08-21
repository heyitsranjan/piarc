import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import { playCompletionSound } from "@/lib/sound";

/**
 * Notify the user when an agent session completes.
 *
 * - Always plays a chime (even when the window is focused) so the user
 *   can look away without missing the completion.
 * - Sends a native macOS notification only when the window is unfocused,
 *   so the focused user isn't spammed with Notification Center banners.
 *
 * @param title   Tab title for the notification body.
 * @param isActiveTab  Whether the completing tab is the currently visible tab.
 */
export async function notifyAgentCompletion(
  title: string,
  isActiveTab: boolean
): Promise<void> {
  const focused = await getCurrentWindow().isFocused();

  // Chime when the user isn't watching: different tab, or app unfocused.
  if (!isActiveTab || !focused) playCompletionSound();

  // Native notification only when the window is unfocused.
  if (focused) return;

  let permitted = await isPermissionGranted();
  if (!permitted) permitted = (await requestPermission()) === "granted";
  if (permitted) sendNotification({ title: "PiArc — agent finished", body: title });
}
