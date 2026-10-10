/** Local (on-device) notifications for the workout flow.
 *
 * No server is involved: these fire from the running page. iOS shows them
 * only when the app is installed to the Home Screen (16.4+) and permission
 * was granted from a user gesture. Notifications are silent by design — no
 * sound or vibration — matching the app's quiet-controls preference.
 *
 * Tapping a notification is handled by the service worker's
 * `notificationclick` listener (see scripts/build-pwa.mjs), which focuses the
 * open app or opens it.
 */

export type LocalNotificationState = NotificationPermission | "unsupported";

const REST_TAG = "coach-loop-rest";

/** Current permission without prompting. Never throws. */
export function notificationPermissionState(): LocalNotificationState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Ask the user for permission. Must be called from a user gesture on iOS. Never throws. */
export async function requestNotificationPermission(): Promise<LocalNotificationState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission ?? "denied";
  }
}

interface NotificationShowOptions {
  body?: string;
  tag?: string;
  silent?: boolean;
}

type NotificationCtor = new (title: string, options?: NotificationShowOptions) => Notification;

/** Show a silent rest-complete notification, but only when the app isn't in
 * front of the user — while visible, the on-screen timer already says it.
 * Prefers the service worker registration so taps focus the app; falls back
 * to a page notification where no worker is active. Returns true when a
 * notification was actually shown. Never throws. */
export async function notifyRestComplete(nextLabel: string): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return false;
  const body = nextLabel ? `Next: ${nextLabel}` : "Time for your next set";
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Rest over", { body, tag: REST_TAG, silent: true });
    } else {
      new (Notification as NotificationCtor)("Rest over", { body, tag: REST_TAG, silent: true });
    }
    return true;
  } catch {
    return false;
  }
}
