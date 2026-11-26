import { useRef, useState } from "react";
import { toast } from "sonner";
import { validMeasurementDate } from "../domain/training-workflow";
import { reschedulePlannedWorkout } from "../domain/plan-review";
import { selectedActiveWorkout, startWorkoutState, resumeWorkoutState, finishWorkoutState, discardWorkoutState, skipPlannedWorkoutState } from "../domain/workout-transitions";
import { repeatWorkoutDraft, replanWorkoutDraft, templateWorkoutDraft } from "../domain/workout-copy";
import { makeHyroxWorkout } from "../domain/hyrox";
import { makeCardio, makeWorkout, type CardioEntry, type WorkoutSession } from "../domain/training-types";
import { formatDate, type MainView } from "../views/shared";
import type { useTrainingPersistence } from "../persistence/use-training-persistence";

export function useWorkoutController(persistence: ReturnType<typeof useTrainingPersistence>, navigateTab: (value: MainView) => void) {
  const { displayedState, setState, applyProjectedUpdate, saveRecoveryCopy, commitState, liveStateRef, demoActive } = persistence;
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const historyScrollRef = useRef<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importDraft, setImportDraft] = useState("");
  const [importListFirst, setImportListFirst] = useState(false);
  const [hyroxOpen, setHyroxOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [lastImportId, setLastImportId] = useState<string | null>(null);
  const [skipWorkoutId, setSkipWorkoutId] = useState<string | null>(null);
  const [quickLogActivityId, setQuickLogActivityId] = useState<string | null>(null);
  const skipWorkout = displayedState.workouts.find((workout) => workout.id === skipWorkoutId) ?? null;
  const activeWorkout = selectedActiveWorkout(displayedState);
  const activeChoices = displayedState.workouts.filter((workout) => workout.status === "active");
  const editingWorkout = displayedState.workouts.find((workout) => workout.id === editingWorkoutId && workout.status === "completed") ?? null;
  const displayedWorkout = editingWorkout ?? activeWorkout;

  const putWorkout = (workout: WorkoutSession) =>
    applyProjectedUpdate((current) => ({ ...current, workouts: current.workouts.map((item) => item.id === workout.id ? { ...workout, updatedAt: new Date().toISOString() } : item) }));

  const startWorkout = async (workout: WorkoutSession) => {
    const before = liveStateRef.current;
    await commitState(current => startWorkoutState(current, workout));
    navigateTab("today");
    setWorkoutOpen(true);
    saveRecoveryCopy(before, "before-start");
  };

  const savePlannedWorkout = async (workout: WorkoutSession) => {
    if (liveStateRef.current.workouts.some(w => w.id === workout.id)) return;
    const planned: WorkoutSession = {
      ...workout,
      status: "planned",
      startedAt: null,
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      updatedAt: new Date().toISOString(),
    };
    await commitState((current) => ({ ...current, workouts: [planned, ...current.workouts] }));
    if (workout.source === "fitlog") setLastImportId(workout.id);
    toast.success("Workout saved for later");
  };

  const startPlannedWorkout = (id: string) => {
    const workout = liveStateRef.current.workouts.find((item) => item.id === id && item.status === "planned");
    if (!workout) return;
    if (workout.isTemplate) {
      if (liveStateRef.current.activeWorkoutId) {
        toast.error("Finish the active workout first");
        return;
      }
      const copy = workout.hyrox
        ? makeHyroxWorkout(workout.hyrox.division, workout.hyrox.segments, workout.hyrox.setupLabel)
        : repeatWorkoutDraft(workout);
      void startWorkout(copy).catch(saveFailure);
      return;
    }
    void startWorkout(workout).catch(saveFailure);
  };

  const saveAsTemplate = (idOrWorkout: string | WorkoutSession) => {
    if (demoActive) { toast.error("Exit demo before saving a template"); return; }
    const source = typeof idOrWorkout === "string"
      ? liveStateRef.current.workouts.find((item) => item.id === idOrWorkout)
      : idOrWorkout;
    if (!source) return;
    const template = templateWorkoutDraft(source);
    void commitState((current) => ({ ...current, workouts: [template, ...current.workouts] }))
      .then(() => toast.success("Saved to workout templates"))
      .catch(saveFailure);
  };

  const reschedulePlan = (id: string, date: string) => {
    if (!validMeasurementDate(date)) return toast.error("Choose a valid plan date");
    applyProjectedUpdate((current) => ({ ...current, workouts: current.workouts.map((item) => item.id === id && item.status === "planned" ? reschedulePlannedWorkout(item, date, new Date().toISOString()) : item) }));
    toast.success(`Plan moved to ${formatDate(date)}`);
  };

  const skipPlannedWorkout = (id: string, reason: string, importReplacement: boolean) => {
    const skippedAt = new Date().toISOString();
    const beforeSkip = liveStateRef.current;
    if (!beforeSkip.workouts.some((workout) => workout.id === id && workout.status === "planned")) return;
    saveRecoveryCopy(beforeSkip, "before-skip");
    let didSkip = false;
    void commitState((current) => {
      const next = skipPlannedWorkoutState(current, id, reason, skippedAt);
      if (next === current) return current;
      didSkip = true;
      return next;
    }).then(() => {
      if (!didSkip) return;
      toast.success("Workout marked skipped");
      if (importReplacement) window.setTimeout(() => setImportOpen(true), 0);
    }).catch(saveFailure);
  };

  const saveFailure = (error: unknown) => toast.error(`${error instanceof Error ? error.message : "Could not save"}. Your draft is retained; retry when storage is available.`);
  const startBlank = () => { setQuickLogActivityId(null); const current = liveStateRef.current; void startWorkout(makeWorkout(current.settings.defaultUnit, current.settings.defaultRestSec)).catch(saveFailure); };
  const quickCardio = (type: CardioEntry["activityType"]) => {
    const current = liveStateRef.current;
    const workout = makeWorkout(current.settings.defaultUnit, current.settings.defaultRestSec, `${makeCardio(type).name} session`);
    const activity = makeCardio(type);
    workout.exercises = [];
    workout.cardio = [activity];
    workout.blockOrder = [{ type: "activity", id: activity.id }];
    setQuickLogActivityId(activity.id);
    void startWorkout(workout).catch(saveFailure);
  };

  const finishWorkout = async (updatedWorkout?: WorkoutSession) => {
    const finishingWorkout = updatedWorkout ?? selectedActiveWorkout(liveStateRef.current);
    if (!finishingWorkout) return;
    const next = await commitState(current => finishWorkoutState(current, finishingWorkout));
    saveRecoveryCopy(next, "workout-complete");
    setWorkoutOpen(false);
    setEditingWorkoutId(null);
    setQuickLogActivityId(null);
    navigateTab("history");
    toast.success(finishingWorkout.completedAt ? "History edit saved" : "Workout saved");
  };

  const discardWorkout = () => {
    // Resolve the target inside the updater so a stale render-closure id can
    // never discard the wrong session; leaveEditor() clears workoutOpen,
    // editingWorkoutId and quickLogActivityId (a quick-log id left behind
    // would leak into the next opened workout).
    void commitState(current => {
      const target = selectedActiveWorkout(current);
      if (!target) throw new Error("Only an unfinished workout can be discarded");
      return discardWorkoutState(current, target.id);
    }).then(() => {
      leaveEditor();
      toast.success("Workout discarded");
    }).catch(saveFailure);
  };

  const editWorkout = (id: string) => {
    if (!liveStateRef.current.workouts.some((item) => item.id === id && item.status === "completed")) return;
    historyScrollRef.current = window.scrollY;
    setEditingWorkoutId(id);
    setWorkoutOpen(true);
    navigateTab("today");
  };
  const leaveEditor = () => {
    const returningToHistory = Boolean(editingWorkoutId);
    const savedHistoryScroll = historyScrollRef.current;
    setEditingWorkoutId(null);
    setWorkoutOpen(false);
    setQuickLogActivityId(null);
    if (returningToHistory) {
      navigateTab("history");
      window.setTimeout(() => {
        const currentView = new URL(window.location.href).searchParams.get("view");
        if (currentView === "history" && savedHistoryScroll !== null) {
          window.scrollTo({ top: savedHistoryScroll, behavior: "instant" });
        }
        historyScrollRef.current = null;
      }, 80);
    }
  };
  const finishEditor = async (updated?: WorkoutSession) => {
    if (editingWorkoutId) {
      await commitState(current => updated ? { ...current, workouts: current.workouts.map(item => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item) } : current);
      leaveEditor();
      toast("History edit complete");
      return;
    }
    await finishWorkout(updated);
  };

  const repeatWorkout = (id: string) => {
    if (liveStateRef.current.activeWorkoutId) return toast.error("Finish the active workout first");
    const original = liveStateRef.current.workouts.find((workout) => workout.id === id);
    if (!original) return;
    if (original.hyrox) {
      const fresh = makeHyroxWorkout(original.hyrox.division, original.hyrox.segments, original.hyrox.setupLabel);
      void startWorkout(fresh).catch(saveFailure);
      return;
    }
    const repeated = repeatWorkoutDraft(original);
    void startWorkout(repeated).catch(saveFailure);
  };

  const replan = async (id: string) => {
    const original = liveStateRef.current.workouts.find((workout) => workout.id === id && workout.status === "skipped");
    if (!original) return;
    if (original.hyrox) {
      await savePlannedWorkout(makeHyroxWorkout(original.hyrox.division, original.hyrox.segments, original.hyrox.setupLabel));
      navigateTab("today");
      return;
    }
    const replanned = replanWorkoutDraft(original);
    await commitState((current) => ({ ...current, workouts: [replanned, ...current.workouts] }));
    navigateTab("today");
    toast.success("Workout returned to your planned queue");
  };

  const replanWorkout = (id: string) => { void replan(id).catch(saveFailure); };

  const deleteWorkout = (id: string) => {
    if (demoActive) { toast.error("Exit demo before deleting a workout"); return; }
    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== id),
      deletedWorkoutIds: [...new Set([...current.deletedWorkoutIds, id])],
      activeWorkoutId: current.activeWorkoutId === id ? null : current.activeWorkoutId,
    }));
  };




  const resumeWorkout = (id: string) => { void commitState(current => resumeWorkoutState(current, id)).then(() => { navigateTab("today"); setWorkoutOpen(true); }).catch(saveFailure); };
  return { workoutOpen, setWorkoutOpen, editingWorkoutId, quickLogActivityId, importOpen, setImportOpen, importDraft, setImportDraft, importListFirst, setImportListFirst, hyroxOpen, setHyroxOpen, coachOpen, setCoachOpen, lastImportId, setLastImportId, skipWorkout, setSkipWorkoutId, activeWorkout, activeChoices, displayedWorkout, putWorkout, startWorkout, savePlannedWorkout, startPlannedWorkout, saveAsTemplate, reschedulePlan, skipPlannedWorkout, startBlank, quickCardio, finishEditor, discardWorkout, editWorkout, leaveEditor, repeatWorkout, replanWorkout, deleteWorkout, resumeWorkout };
}
