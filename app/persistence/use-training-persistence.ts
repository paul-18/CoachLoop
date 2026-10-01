"use client";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { toast } from "sonner";
import { defaultState, type TrainingState } from "../domain/training-types";
import { prepareLoadedState } from "./migrations";
import { mergeRestoredState } from "./cloud-sync";
import { resolveFieldConflict } from "./field-conflicts";
import { loadTrainingState, resetTrainingData, saveSnapshot, saveTrainingState } from "./training-storage";

/** GitHub Pages edition: local IndexedDB only. Backups are exported in Settings. */
export function useTrainingPersistence(_onOpenResetLog: () => void) {
  const [state, setReactState] = useState<TrainingState>(defaultState);
  const latestStateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [localSaveRetry, setLocalSaveRetry] = useState(0);

  const setState = (update: SetStateAction<TrainingState>) => {
    const next = typeof update === "function" ? update(latestStateRef.current) : update;
    latestStateRef.current = next;
    setReactState(next);
  };

  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
    void loadTrainingState().then((stored) => {
      const next = prepareLoadedState(stored ?? defaultState());
      latestStateRef.current = next;
      setReactState(next);
      setReady(true);
    }).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    setLocalSaveStatus("saving");
    void saveTrainingState(state).then(
      () => { if (current) setLocalSaveStatus("saved"); },
      () => { if (current) setLocalSaveStatus("error"); },
    );
    return () => { current = false; };
  }, [state, ready, localSaveRetry]);

  const resetAll = async () => {
    const cleared = defaultState();
    await resetTrainingData(cleared);
    setState(cleared);
    toast.success("This device's log erased");
  };
  const restoreBackup = async (backup: TrainingState) => {
    await saveSnapshot(latestStateRef.current, "before-restore");
    setState((current) => mergeRestoredState(current, backup));
  };
  const saveRecoveryCopy = (snapshot: TrainingState, reason: string) =>
    void saveSnapshot(snapshot, reason).catch(() => toast.error("Recovery copy could not be saved"));
  const resolveConflict = async (id: string, value: unknown) => {
    setState((current) => resolveFieldConflict(current, id, value));
  };

  return {
    state, setState, displayedState: state, applyProjectedUpdate: setState,
    resolveConflict, restoreBackup, saveRecoveryCopy,
    loadError, ready, syncFailure: null, localSaveStatus, setLocalSaveRetry,
    syncStatus: "synced" as const, lastSyncedAt: null, resetMismatch: false,
    latestStateRef, retrySync: () => undefined, resetAll, openResetLog: async () => undefined,
  };
}
