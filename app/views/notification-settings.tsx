import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TrainingState } from "../domain/training-types";
import {
  notificationPermissionState,
  requestNotificationPermission,
  type LocalNotificationState,
} from "../pwa/use-local-notifications";

type SettingsUpdate = (update: (settings: TrainingState["settings"]) => TrainingState["settings"]) => void;

/** Notifications opt-in panel for Settings. The permission request runs from
 * the Enable button's tap, which counts as the user gesture iOS requires. */
export function NotificationSettings({
  settings,
  onUpdate,
}: {
  settings: TrainingState["settings"];
  onUpdate: SettingsUpdate;
}) {
  const [permission, setPermission] = useState<LocalNotificationState>(() => notificationPermissionState());
  const enabled = settings.notificationsEnabled === true;

  const enable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      onUpdate(current => ({ ...current, notificationsEnabled: true }));
      toast.success("Rest notifications on");
    } else if (result === "denied") {
      toast.error("Notifications are blocked — allow them in the system settings, then try again");
    }
  };
  const disable = () => {
    onUpdate(current => ({ ...current, notificationsEnabled: false }));
    toast.success("Rest notifications off");
  };
  const recheck = () => setPermission(notificationPermissionState());

  let status: string;
  if (permission === "unsupported") {
    status = "Not available in this browser. On iPhone, install the app to the Home Screen first (needs iOS 16.4 or later).";
  } else if (permission === "denied") {
    status = "Blocked. Allow notifications for Coach Loop in the system settings, then check again.";
  } else if (!enabled) {
    status = "Off. Turn on to get a silent notification when a rest timer finishes.";
  } else {
    status = "On. You'll get a silent notification when a rest timer finishes while the app isn't in front of you.";
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/65">
        Silent rest-timer notifications. Everything stays on this device — no server, no account.
      </p>
      <p className="text-sm text-white/55" role="status">{status}</p>
      <div className="flex flex-wrap gap-2">
        {permission === "unsupported" ? null : permission === "denied" ? (
          <Button variant="outline" onClick={recheck}>Check again</Button>
        ) : enabled ? (
          <Button variant="outline" onClick={disable}>Turn off</Button>
        ) : (
          <Button variant="outline" onClick={() => void enable()}>Enable notifications</Button>
        )}
      </div>
    </div>
  );
}
