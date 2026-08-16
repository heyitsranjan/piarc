import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function notifyAgentCompletion(title: string): Promise<void> {
  if (await getCurrentWindow().isFocused()) return;

  let permitted = await isPermissionGranted();
  if (!permitted) permitted = (await requestPermission()) === "granted";
  if (permitted) sendNotification({ title: "PiArc — agent finished", body: title });
}
