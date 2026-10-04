import { useEffect, useState } from "react";
import { useTrainingPersistence } from "../persistence/use-training-persistence";
import { useOfflineStatus } from "../pwa/use-offline-status";
import { useShellNavigation } from "./use-shell-navigation";
import { useWorkoutController } from "./use-workout-controller";
import { useProgressActions } from "./use-progress-actions";

/** Single owner for the durable log; controllers only use its existing write boundary. */
export function useShellModel() {
  const persistence = useTrainingPersistence();
  const navigation = useShellNavigation();
  const workouts = useWorkoutController(persistence, navigation.setView);
  const progress = useProgressActions(persistence);
  const offline = useOfflineStatus();
  const [updating, setUpdating] = useState(false);
  const { ready, state, flushLatest } = persistence;
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.coachTheme = state.settings.colorTheme ?? "lime";
    return () => { delete document.documentElement.dataset.coachTheme; };
  }, [ready, state.settings.colorTheme]);
  const restart = async () => { await flushLatest(); window.location.reload(); };
  const onApplyUpdate = async () => {
    setUpdating(true);
    try { await offline.applyUpdate(flushLatest); }
    catch (error) { setUpdating(false); throw error; }
  };
  return { persistence, navigation, workouts, progress, offline, updating, restart, onApplyUpdate };
}
export type ShellModel = ReturnType<typeof useShellModel>;
