import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { validMeasurementDate } from "../domain/training-workflow";
import { reschedulePlannedWorkout } from "../domain/plan-review";
import { selectedActiveWorkout, startWorkoutState, resumeWorkoutState, finishWorkoutState, discardWorkoutState } from "../domain/workout-transitions";
import { repeatWorkoutDraft, replanWorkoutDraft } from "../domain/workout-copy";
import { makeHyroxWorkout } from "../domain/hyrox";
import { makeCardio, makeWorkout, type CardioEntry, type WorkoutSession } from "../domain/training-types";
import { formatDate, type MainView } from "../views/shared";
import type { useTrainingPersistence } from "../persistence/use-training-persistence";

export function useWorkoutController(persistence: ReturnType<typeof useTrainingPersistence>, setView: Dispatch<SetStateAction<MainView>>) {
  const { state, displayedState, setState, applyProjectedUpdate, saveRecoveryCopy } = persistence;
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const historyScrollRef = useRef<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importDraft, setImportDraft] = useState("");
  const [hyroxOpen, setHyroxOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [lastImportId, setLastImportId] = useState<string | null>(null);
  const [skipWorkoutId, setSkipWorkoutId] = useState<string | null>(null);
  const skipWorkout = state.workouts.find((workout) => workout.id === skipWorkoutId) ?? null;
  const activeWorkout = selectedActiveWorkout(displayedState);
  const activeChoices = displayedState.workouts.filter((workout) => workout.status === "active");
  const editingWorkout = displayedState.workouts.find((workout) => workout.id === editingWorkoutId && workout.status === "completed") ?? null;
  const displayedWorkout = editingWorkout ?? activeWorkout;

  const putWorkout = (workout: WorkoutSession) =>
    applyProjectedUpdate((current) => ({ ...current, workouts: current.workouts.map((item) => item.id === workout.id ? { ...workout, updatedAt: new Date().toISOString() } : item) }));

  const startWorkout = (workout: WorkoutSession) => {
    let next;
    try { next = startWorkoutState(state, workout); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not start this workout"); return; }
    setState(next);
    setWorkoutOpen(true);
    saveRecoveryCopy(state, "before-start");
  };

  const savePlannedWorkout = (workout: WorkoutSession) => {
    if (state.workouts.some(w => w.id === workout.id)) return;
    if (workout.source === "fitlog") setLastImportId(workout.id);
    const planned: WorkoutSession = {
      ...workout,
      status: "planned",
      startedAt: null,
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      updatedAt: new Date().toISOString(),
    };
    setState((current) => ({ ...current, workouts: [planned, ...current.workouts] }));
    toast.success("Workout saved for later");
  };

  const startPlannedWorkout = (id: string) => {
    const workout = state.workouts.find((item) => item.id === id && item.status === "planned");
    if (workout) startWorkout(workout);
  };

  const reschedulePlan = (id: string, date: string) => {
    if (!validMeasurementDate(date)) return toast.error("Choose a valid plan date");
    applyProjectedUpdate((current) => ({ ...current, workouts: current.workouts.map((item) => item.id === id && item.status === "planned" ? reschedulePlannedWorkout(item, date, new Date().toISOString()) : item) }));
    toast.success(`Plan moved to ${formatDate(date)}`);
  };

  const skipPlannedWorkout = (id: string, reason: string, importReplacement: boolean) => {
    const skippedAt = new Date().toISOString();
    const next = {
      ...state,
      workouts: state.workouts.map((workout) => workout.id === id
        ? { ...workout, status: "skipped" as const, skippedAt, skipReason: reason, startedAt: null, completedAt: null, updatedAt: skippedAt }
        : workout),
    };
    saveRecoveryCopy(state, "before-skip");
    setState(next);
    toast.success("Workout marked skipped");
    if (importReplacement) window.setTimeout(() => setImportOpen(true), 0);
  };

  const startBlank = () => startWorkout(makeWorkout(state.settings.defaultUnit, state.settings.defaultRestSec));
  const quickCardio = (type: CardioEntry["activityType"]) => {
    const workout = makeWorkout(state.settings.defaultUnit, state.settings.defaultRestSec, `${makeCardio(type).name} session`);
    const activity = makeCardio(type);
    workout.exercises = [];
    workout.cardio = [activity];
    workout.blockOrder = [{ type: "activity", id: activity.id }];
    startWorkout(workout);
  };

  const finishWorkout = (updatedWorkout?: WorkoutSession) => {
    const finishingWorkout = updatedWorkout ?? activeWorkout;
    if (!finishingWorkout) return;
    const next = finishWorkoutState(state, finishingWorkout);
    setState(next);
    saveRecoveryCopy(next, "workout-complete");
    setWorkoutOpen(false);
    setView("history");
    toast.success(finishingWorkout.completedAt ? "History edit complete" : "Workout completed");
  };

  const discardWorkout = () => {
    if (!activeWorkout) return;
    setState((current) => discardWorkoutState(current, activeWorkout.id));
    setWorkoutOpen(false);
    toast.success("Workout discarded");
  };

  const editWorkout = (id: string) => {
    if (!state.workouts.some((item) => item.id === id && item.status === "completed")) return;
    historyScrollRef.current = window.scrollY;
    setEditingWorkoutId(id);
    setWorkoutOpen(true);
  };
  const leaveEditor = () => {
    const returningToHistory = Boolean(editingWorkoutId);
    setEditingWorkoutId(null);
    setWorkoutOpen(false);
    if (returningToHistory) requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (historyScrollRef.current !== null) window.scrollTo({ top: historyScrollRef.current, behavior: "instant" });
        historyScrollRef.current = null;
      });
    });
  };
  const finishEditor = (updated?: WorkoutSession) => {
    if (editingWorkoutId) {
      if (updated) putWorkout(updated);
      leaveEditor();
      setView("history");
      toast("History edit complete");
      return;
    }
    finishWorkout(updated);
  };

  const repeatWorkout = (id: string) => {
    if (state.activeWorkoutId) return toast.error("Finish the active workout first");
    const original = state.workouts.find((workout) => workout.id === id);
    if (!original) return;
    if (original.hyrox) {
      const fresh = makeHyroxWorkout(original.hyrox.division, original.hyrox.segments, original.hyrox.setupLabel);
      startWorkout(fresh);
      return;
    }
    const repeated = repeatWorkoutDraft(original);
    startWorkout(repeated);
  };

  const replanWorkout = (id: string) => {
    const original = state.workouts.find((workout) => workout.id === id && workout.status === "skipped");
    if (!original) return;
    if (original.hyrox) {
      savePlannedWorkout(makeHyroxWorkout(original.hyrox.division, original.hyrox.segments, original.hyrox.setupLabel));
      setView("today");
      return;
    }
    const replanned = replanWorkoutDraft(original);
    setState((current) => ({ ...current, workouts: [replanned, ...current.workouts] }));
    setView("today");
    toast.success("Workout returned to your planned queue");
  };

  const deleteWorkout = (id: string) => {
    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== id),
      deletedWorkoutIds: [...new Set([...current.deletedWorkoutIds, id])],
      activeWorkoutId: current.activeWorkoutId === id ? null : current.activeWorkoutId,
    }));
  };




  const resumeWorkout = (id: string) => { setState(current => resumeWorkoutState(current, id)); setWorkoutOpen(true); };
  return { workoutOpen, setWorkoutOpen, editingWorkoutId, importOpen, setImportOpen, importDraft, setImportDraft, hyroxOpen, setHyroxOpen, coachOpen, setCoachOpen, lastImportId, setLastImportId, skipWorkout, setSkipWorkoutId, activeWorkout, activeChoices, displayedWorkout, putWorkout, startWorkout, savePlannedWorkout, startPlannedWorkout, reschedulePlan, skipPlannedWorkout, startBlank, quickCardio, finishEditor, discardWorkout, editWorkout, leaveEditor, repeatWorkout, replanWorkout, deleteWorkout, resumeWorkout };
}
