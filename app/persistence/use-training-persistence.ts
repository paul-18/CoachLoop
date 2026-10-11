"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { toast } from "sonner";
import { defaultState, type TrainingState } from "../domain/training-types";
import { buildDemoState, projectDemoUpdate } from "../domain/demo-session";
import { restoredState, type RestoreMode } from "./backup-tools";
import type { ReviewedRestore } from "./backup-review";
import { prepareLoadedState } from "./migrations";
import { resolveFieldConflict } from "./field-conflicts";
import { validateLocalState, validateSyncedState, validatedState, validateStateEdit, type ValidatedState } from "./training-validation";
import { loadTrainingState, resetTrainingData, saveSnapshot, saveValidatedState } from "./training-storage";

/** GitHub Pages edition: local IndexedDB only. Backups are exported in Settings. */
export function useTrainingPersistence() {
  const [state, setReactState] = useState<ValidatedState>(() => validatedState(defaultState()));
  const latestStateRef = useRef(state);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const operation = useRef(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<"saving" | "saved" | "error">("saving");
  const [localSaveRetry, setLocalSaveRetry] = useState(0);
  const demoRef = useRef<ValidatedState | null>(null);
  const [demoState, setDemoState] = useState<ValidatedState | null>(null);
  const liveStateRef = useMemo(() => ({ get current() { return demoRef.current ?? latestStateRef.current; } }), []);

  const rememberDemo = (next: TrainingState) => {
    const checked = validatedState(next);
    demoRef.current = checked;
    setDemoState(checked);
    return checked;
  };
  const enterDemo = useCallback(() => {
    try { rememberDemo(buildDemoState()); }
    catch { toast.error("Demo could not be opened"); }
  }, []);
  const exitDemo = useCallback(() => {
    demoRef.current = null;
    setDemoState(null);
  }, []);

  const setState = useCallback((update: SetStateAction<TrainingState>) => {
    if (operation.current) { toast.error("Wait for the current save or recovery to finish"); return; }
    let checked: ValidatedState;
    try {
      const next = typeof update === "function" ? update(latestStateRef.current) : update;
      checked = validateStateEdit(latestStateRef.current, next);
    }
    catch { toast.error("This change is invalid; your saved log was kept"); return; }
    latestStateRef.current = checked;
    setLocalSaveStatus("saving");
    setReactState(checked);
  }, []);
  const applyProjectedUpdate = useCallback((update: SetStateAction<TrainingState>) => {
    if (demoRef.current) {
      try { rememberDemo(projectDemoUpdate(latestStateRef.current, demoRef.current, update).demo!); }
      catch { toast.error("This change is invalid; the demo was kept"); }
      return;
    }
    setState(update);
  }, [setState]);

  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
    let disposed = false;
    void loadTrainingState().then(async (stored) => {
      if (stored && stored.evidenceVersion !== 2) {
        validateLocalState(stored);
        await saveSnapshot(stored, "before-evidence-migration");
      }
      const next = validatedState(prepareLoadedState(stored ?? defaultState()));
      if (disposed) return;
      latestStateRef.current = next;
      setReactState(next);
      setReady(true);
    }).catch(() => { if (!disposed) setLoadError(true); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!ready || operation.current || demoRef.current) return;
    let current = true;
    // IndexedDB status follows the start and completion of an external save.
    setLocalSaveStatus("saving");
    void Promise.resolve().then(() => saveValidatedState(state)).then(
      () => { if (current && !operation.current) setLocalSaveStatus("saved"); },
      () => { if (current && !operation.current) setLocalSaveStatus("error"); },
    );
    return () => { current = false; };
  }, [state, ready, localSaveRetry]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => { if (demoRef.current || operation.current) return; void saveValidatedState(latestStateRef.current).catch(() => setLocalSaveStatus("error")); };
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
    if (demoRef.current) { toast.error("Exit demo before erasing the log"); return; }
    if (operation.current) return;
    operation.current = true; setBusy(true);
    const cleared = validatedState(defaultState());
    try {
      await resetTrainingData(cleared, undefined, latestStateRef.current);
      latestStateRef.current = cleared; setReactState(cleared); setLocalSaveStatus("saved");
      toast.success("This device's log was erased. One recovery copy of the previous log was kept");
    } catch { toast.error("Reset failed; your local log was retained"); }
    finally { operation.current = false; setBusy(false); }
  };
  const flushLatest = async () => {
    if (operation.current) throw new Error("Recovery is still running");
    try {
      let candidate: ValidatedState;
      do { candidate = latestStateRef.current; await saveValidatedState(candidate); } while (candidate !== latestStateRef.current);
      setLocalSaveStatus("saved");
    } catch (error) { setLocalSaveStatus("error"); throw error; }
  };
  /** Final confirmations publish success only after the transaction commits.
   * Keep the editable draft in memory on failure; prevent old lifecycle saves
   * from overtaking the final write while this operation is locked. */
  const commitState = async (update: SetStateAction<TrainingState>) => {
    if (demoRef.current) {
      const next = rememberDemo(projectDemoUpdate(latestStateRef.current, demoRef.current, update).demo!);
      return next;
    }
    if (operation.current) throw new Error("A save or recovery operation is already running");
    operation.current = true; setCommitting(true); setLocalSaveStatus("saving");
    try {
      const next = validatedState(typeof update === "function" ? update(latestStateRef.current) : update);
      await saveValidatedState(next);
      latestStateRef.current = next; setReactState(next); setLocalSaveStatus("saved");
      return next;
    } catch (error) { setLocalSaveStatus("error"); throw error; }
    finally { operation.current = false; setCommitting(false); }
  };
  const restoreBackup = async (backup: TrainingState, recover = false, mode: RestoreMode = "merge", reviewed?: ReviewedRestore) => {
    if (demoRef.current) throw new Error("Exit demo before restoring a backup");
    if (operation.current) throw new Error("Recovery is already running");
    operation.current = true; setBusy(true);
    try {
      validateSyncedState(backup);
      if (reviewed && JSON.stringify(reviewed.base) !== JSON.stringify(latestStateRef.current)) throw new Error("Your log changed after preview. Review the restore again before applying it.");
      await saveValidatedState(latestStateRef.current);
      await saveSnapshot(latestStateRef.current, "before-restore");
      const next = validatedState(reviewed ? reviewed.next : restoredState(latestStateRef.current, backup, mode, recover));
      await saveValidatedState(next);
      latestStateRef.current = next;
      setReactState(next);
      setLocalSaveStatus("saved");
    } finally { operation.current = false; setBusy(false); }
  };
  const saveRecoveryCopy = (snapshot: TrainingState, reason: string) => {
    if (demoRef.current) return;
    void saveSnapshot(snapshot, reason).catch(() => toast.error("Recovery copy could not be saved"));
  };
  const resolveConflict = async (id: string, value: unknown) => {
    if (demoRef.current) { toast.error("Exit demo before resolving a conflict"); return; }
    setState((current) => resolveFieldConflict(current, id, value));
  };

  return {
    state, setState: applyProjectedUpdate, busy, committing, commitState, flushLatest, displayedState: demoState ?? state, applyProjectedUpdate,
    demoActive: demoState !== null, enterDemo, exitDemo, liveStateRef,
    resolveConflict, restoreBackup, saveRecoveryCopy,
    loadError, ready, syncFailure: null, localSaveStatus, setLocalSaveRetry,
    syncStatus: "synced" as const, lastSyncedAt: null, resetMismatch: false,
    latestStateRef, retrySync: () => undefined, resetAll, openResetLog: async () => undefined,
  };
}
