"use client";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { toast } from "sonner";
import { defaultState, type TrainingState } from "../domain/training-types";
import { recoverDeleted } from "./backup-tools";
import { prepareLoadedState } from "./migrations";
import { mergeRestoredState } from "./cloud-sync";
import { resolveFieldConflict } from "./field-conflicts";
import { validateLocalState, validateSyncedState } from "./training-validation";
import { loadTrainingState, resetTrainingData, saveSnapshot, saveTrainingState } from "./training-storage";

/** GitHub Pages edition: local IndexedDB only. Backups are exported in Settings. */
export function useTrainingPersistence() {
  const [state, setReactState] = useState<TrainingState>(defaultState);
  const latestStateRef = useRef(state);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [localSaveRetry, setLocalSaveRetry] = useState(0);

  const setState = useCallback((update: SetStateAction<TrainingState>) => {
    if (operation.current) { toast.error("Wait for recovery to finish"); return; }
    let next = typeof update === "function" ? update(latestStateRef.current) : update;
    try { next = validateSyncedState(next); }
    catch { toast.error("This change is invalid; your saved log was kept"); return; }
    latestStateRef.current = next;
    setLocalSaveStatus("saving");
    setReactState(next);
  }, []);

  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
    let disposed = false;
    void loadTrainingState().then(async (stored) => {
      if (stored && stored.evidenceVersion !== 2) {
        validateLocalState(stored);
        await saveSnapshot(stored, "before-evidence-migration");
      }
      const next = prepareLoadedState(stored ?? defaultState());
      if (disposed) return;
      latestStateRef.current = next;
      setReactState(next);
      setReady(true);
    }).catch(() => { if (!disposed) setLoadError(true); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    // IndexedDB status follows the start and completion of an external save.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalSaveStatus("saving");
    void Promise.resolve().then(() => saveTrainingState(state)).then(
      () => { if (current) setLocalSaveStatus("saved"); },
      () => { if (current) setLocalSaveStatus("error"); },
    );
    return () => { current = false; };
  }, [state, ready, localSaveRetry]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => { void saveTrainingState(latestStateRef.current).catch(() => setLocalSaveStatus("error")); };
    const whenHidden = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", whenHidden);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", whenHidden); window.removeEventListener("pagehide", flush); };
  }, [ready]);

  useEffect(() => {
    if (!ready || localSaveStatus !== "error") return;
    const retry = () => { if (document.visibilityState === "visible") setLocalSaveRetry((value) => value + 1); };
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    return () => { window.removeEventListener("focus", retry); document.removeEventListener("visibilitychange", retry); };
  }, [ready, localSaveStatus]);

  const resetAll = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    const cleared = defaultState();
    try {
      await resetTrainingData(cleared);
      latestStateRef.current = cleared; setReactState(cleared); setLocalSaveStatus("saved");
      toast.success("This device's log and recovery copies erased");
    } catch { toast.error("Reset failed; your local log was retained"); }
    finally { operation.current = false; setBusy(false); }
  };
  const flushLatest = async () => {
    if (operation.current) throw new Error("Recovery is still running");
    let candidate: TrainingState;
    do { candidate = latestStateRef.current; await saveTrainingState(candidate); } while (candidate !== latestStateRef.current);
    setLocalSaveStatus("saved");
  };
  const restoreBackup = async (backup: TrainingState, recover = false) => {
    if (operation.current) throw new Error("Recovery is already running");
    operation.current = true; setBusy(true);
    try {
      validateSyncedState(backup);
      await saveTrainingState(latestStateRef.current);
      await saveSnapshot(latestStateRef.current, "before-restore");
      const candidate = recover ? recoverDeleted(latestStateRef.current, backup) : backup;
      const next = validateSyncedState(mergeRestoredState(latestStateRef.current, candidate));
      await saveTrainingState(next);
      latestStateRef.current = next;
      setReactState(next);
      setLocalSaveStatus("saved");
    } finally { operation.current = false; setBusy(false); }
  };
  const saveRecoveryCopy = (snapshot: TrainingState, reason: string) =>
    void saveSnapshot(snapshot, reason).catch(() => toast.error("Recovery copy could not be saved"));
  const resolveConflict = async (id: string, value: unknown) => {
    setState((current) => resolveFieldConflict(current, id, value));
  };

  return {
    state, setState, busy, flushLatest, displayedState: state, applyProjectedUpdate: setState,
    resolveConflict, restoreBackup, saveRecoveryCopy,
    loadError, ready, syncFailure: null, localSaveStatus, setLocalSaveRetry,
    syncStatus: "synced" as const, lastSyncedAt: null, resetMismatch: false,
    latestStateRef, retrySync: () => undefined, resetAll, openResetLog: async () => undefined,
  };
}
