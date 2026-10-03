"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Toaster } from "@/components/ui/sonner";

import { validMeasurementDate } from "./domain/training-workflow";
import { reschedulePlannedWorkout } from "./domain/plan-review";
import { HyroxSetup, HyroxWorkout } from "./views/hyrox-ui";
import { makeHyroxWorkout } from "./domain/hyrox";

import { buildCoachPrompt } from "./interchange/coach-export";

import { parseFitlog } from "./interchange/fitlog";

import { useLocalEditorLease } from "./pwa/use-local-editor-lease";

import { performedReps, performedWeight, performedDuration, performedDistance } from "./domain/training-metrics";

import { localDate, makeCardio, makeWorkout, uid, type CardioEntry, type Unit, type WorkoutSession } from "./domain/training-types";

import { normalizedBlockOrder } from "./domain/block-order";
import { downloadText, formatDate, AppMark, navItems, type MainView } from "./views/shared";
import { ImportWorkoutDialog, SkipWorkoutDialog, CoachDialog, TodayView } from "./views/today-view";
import { WorkoutEditor } from "./views/workout-editor";
import { HistoryView } from "./views/history-view";
import { CoachView } from "./views/coach-view";
import { ProgressView } from "./views/progress-view";
import { SettingsView } from "./views/settings-view";
import { FirstSteps, sampleWorkout } from "./views/first-steps";
import { useOfflineStatus } from "./pwa/use-offline-status";
import { useTrainingPersistence } from "./persistence/use-training-persistence";

class ViewErrorBoundary extends Component<{ label: string; resetKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (this.state.failed) {
      return <main className="page-stack"><section className="settings-panel"><h1 className="text-xl font-black">{this.props.label} could not load</h1><p className="mt-2 text-sm leading-6 text-white/55">Your training data is still saved locally. Try this view again, or reload Coach Loop.</p><Button className="mt-4" onClick={() => this.setState({ failed: false })}>Try again</Button></section></main>;
    }
    return this.props.children;
  }
}

type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      execute: (input: unknown) => unknown | Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

export default function EditorGate() {
  const lease = useLocalEditorLease();
  if (lease === "checking") return <main className="grid min-h-dvh place-items-center bg-[#10120f] text-white">Opening your log…</main>;
  if (lease === "busy") return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white"><div><p>Your log is open in another window.</p><p className="mt-2 max-w-sm text-sm leading-6 text-white/60">Finish your edits there, then close that Safari tab or Home Screen app. This window will open automatically when the log is available.</p><details className="mt-4 max-w-sm text-sm text-white/60"><summary className="cursor-pointer py-3">Still waiting?</summary><p>Close the other Coach Loop windows, including Safari and the installed app, then return here. You do not need to clear your training data.</p></details></div></main>;
  if (lease === "unsupported") return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white">This browser cannot safely coordinate multiple editors.</main>;
  return <WorkoutApp />;
}

function WorkoutApp() {
  const [view, setView] = useState<MainView>("today");
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const historyScrollRef = useRef<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importDraft, setImportDraft] = useState("");
  const [hyroxOpen, setHyroxOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [bodyweightPromptOpen, setBodyweightPromptOpen] = useState(false);
  const [calendarRequest, setCalendarRequest] = useState(0);
  const consumeCalendarRequest = useCallback(() => setCalendarRequest(0), []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  const navigateTab = (value: MainView) => {
    setCalendarRequest(0);
    setView(value);
  };
  const returnTabToTop = (value: MainView) => {
    if (value !== view) return;
    setCalendarRequest(0);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const [skipWorkoutId, setSkipWorkoutId] = useState<string | null>(null);
  const { state, setState, displayedState, applyProjectedUpdate, resolveConflict, restoreBackup, saveRecoveryCopy, loadError, ready, syncFailure, localSaveStatus, setLocalSaveRetry, syncStatus, lastSyncedAt, resetMismatch, latestStateRef, retrySync, resetAll, openResetLog } = useTrainingPersistence(() => setWorkoutOpen(false));
  const { offlineReady, updateReady } = useOfflineStatus();

  useEffect(() => {
    if (!ready) return;
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<WebMcpContext["registerTool"]>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        // WebMCP is optional and unsupported browsers keep the full visual flow.
      }
    };

    register({
      name: "read_training_summary",
      title: "Read training summary",
      description: "Read the user's current Coach Loop goals, workout counts, and active-workout state without changing data.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        goals: state.goals,
        completedWorkouts: state.workouts.filter((item) => item.status === "completed").length,
        activeWorkout: state.workouts.find((item) => item.id === state.activeWorkoutId)?.name ?? null,
      }),
    });

    register({
      name: "prepare_coach_prompt",
      title: "Prepare coach prompt",
      description: "Prepare a copyable ChatGPT coaching prompt from recorded training history. This does not change workout data.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["new", "continue"] },
          days: { type: "number", enum: [0, 1, 7, 14, 30] },
          request: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => {
        const value = (input ?? {}) as { mode?: "new" | "continue"; days?: 0 | 1 | 7 | 14 | 30; request?: string };
        return {
          prompt: buildCoachPrompt(state, {
            mode: value.mode ?? "continue",
            days: value.days ?? 7,
            energy: "",
            sleep: "",
            soreness: "",
            timeAvailable: "",
            equipment: "",
            restrictions: "",
            schedule: state.settings.coachCheckIn.schedule,
            request: value.request ?? "Recommend my next workout based on my recent training and goals.",
          }),
        };
      },
    });

    register({
      name: "start_blank_workout",
      title: "Start blank workout",
      description: "Start one blank workout in Coach Loop and open the visible workout logger.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (state.activeWorkoutId) throw new Error("A workout is already active.");
        const value = (input ?? {}) as { name?: string };
        const workout = makeWorkout(
          state.settings.defaultUnit,
          state.settings.defaultRestSec,
          value.name?.trim() || "Training session",
        );
        setState((current) => ({
          ...current,
          workouts: [workout, ...current.workouts],
          activeWorkoutId: workout.id,
        }));
        setWorkoutOpen(true);
        return { workoutId: workout.id, status: "active", name: workout.name };
      },
    });

    register({
      name: "import_fitlog_workout",
      title: "Import FITLOG workout",
      description: "Validate a FITLOG v1 block and open the visible import review. Saving or starting requires confirmation.",
      inputSchema: {
        type: "object",
        properties: { fitlog: { type: "string", minLength: 20 } },
        required: ["fitlog"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        const value = input as { fitlog?: unknown };
        if (typeof value?.fitlog !== "string") throw new Error("fitlog must be text.");
        const preview = parseFitlog(
          value.fitlog,
          latestStateRef.current.settings.defaultUnit,
          latestStateRef.current.exerciseAliases,
        );
        setImportDraft(value.fitlog);
        setView("today");
        setImportOpen(true);
        return {
          status: "review_required",
          name: preview.name,
          warnings: preview.importWarnings ?? [],
        };
      },
    });

    return () => lifecycle.abort();
  }, [ready, state]);

  const activeWorkout = displayedState.workouts.find((workout) => workout.id === state.activeWorkoutId) ?? null;
  const activeChoices = displayedState.workouts.filter((workout) => workout.status === "active");
  const editingWorkout = displayedState.workouts.find((workout) => workout.id === editingWorkoutId && workout.status === "completed") ?? null;
  const displayedWorkout = editingWorkout ?? activeWorkout;
  const skipWorkout = state.workouts.find((workout) => workout.id === skipWorkoutId) ?? null;

  const putWorkout = (workout: WorkoutSession) =>
    applyProjectedUpdate((current) => ({ ...current, workouts: current.workouts.map((item) => item.id === workout.id ? { ...workout, updatedAt: new Date().toISOString() } : item) }));

  const startWorkout = (workout: WorkoutSession) => {
    if (state.workouts.some((item) => item.status === "active" && item.id !== workout.id)) {
      toast.error("Finish or discard the active workout first");
      return;
    }
    const active = {
      ...workout,
      date: workout.status === "planned" ? localDate() : workout.date,
      timezone: workout.status === "planned" ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") : workout.timezone,
      status: "active" as const,
      startedAt: workout.startedAt ?? new Date().toISOString(),
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      updatedAt: new Date().toISOString(),
    };
    setState((current) => {
      const alreadySaved = current.workouts.some((item) => item.id === active.id);
      return {
        ...current,
        workouts: alreadySaved
          ? current.workouts.map((item) => item.id === active.id ? active : item)
          : [active, ...current.workouts],
        activeWorkoutId: active.id,
      };
    });
    setWorkoutOpen(true);
    saveRecoveryCopy(state, "before-start");
  };

  const savePlannedWorkout = (workout: WorkoutSession) => {
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
    const completedAt = finishingWorkout.completedAt ?? new Date().toISOString();
    const completed: WorkoutSession = { ...finishingWorkout, status: "completed", completedAt, skippedAt: null, skipReason: "", updatedAt: new Date().toISOString() };
    const next = { ...state, workouts: state.workouts.map((item) => item.id === completed.id ? completed : item), activeWorkoutId: null };
    setState(next);
    saveRecoveryCopy(next, "workout-complete");
    setWorkoutOpen(false);
    setView("history");
    toast.success(finishingWorkout.completedAt ? "History edit complete" : "Workout completed");
  };

  const discardWorkout = () => {
    if (!activeWorkout) return;
    setState((current) => ({ ...current, workouts: current.workouts.filter((item) => item.id !== activeWorkout.id), deletedWorkoutIds: [...new Set([...current.deletedWorkoutIds, activeWorkout.id])], activeWorkoutId: null }));
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
    const exerciseIds = new Map(original.exercises.map((exercise) => [exercise.id, uid("exercise")]));
    const activityIds = new Map(original.cardio.map((activity) => [activity.id, uid("cardio")]));
    const repeated: WorkoutSession = {
      ...structuredClone(original),
      id: uid("workout"),
      name: original.name,
      originKey: undefined,
      importFingerprint: undefined,
      importWarnings: undefined,
      date: localDate(),
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      status: "active",
      source: "repeat",
      notes: "",
      sessionRpe: "",
      updatedAt: new Date().toISOString(),
      exercises: original.exercises.map((exercise) => ({ ...structuredClone(exercise), id: exerciseIds.get(exercise.id)!, updatedAt: new Date().toISOString(), notes: "", sets: exercise.sets.map((set) => ({ ...set, id: uid("set"), plannedReps: set.completed ? performedReps(set) || set.plannedReps : set.plannedReps, plannedWeight: set.completed ? performedWeight(set) : set.plannedWeight, actualReps: "", actualWeight: null, rpe: "", rir: "", completed: false, skipped: false, completedAsPlanned: false, notes: "", updatedAt: new Date().toISOString() })) })),
      cardio: original.cardio.map((item) => ({ ...structuredClone(item), id: activityIds.get(item.id)!, plannedDurationMin: item.completed ? performedDuration(item) : item.plannedDurationMin, plannedDistanceKm: item.completed ? performedDistance(item) : item.plannedDistanceKm, efforts: (item.efforts ?? []).map((entry) => ({ ...entry, id: uid("effort"), plannedDistanceM: entry.completed ? entry.actualDistanceM : entry.plannedDistanceM, plannedDurationSec: entry.completed ? entry.actualDurationSec : entry.plannedDurationSec, plannedLoad: entry.completed ? entry.actualLoad : entry.plannedLoad, actualDistanceM: null, actualDurationSec: null, actualLoad: null, completed: false })), actualDurationMin: null, actualDistanceKm: null, averageHr: null, elevationM: null, pace: "", effort: "", completed: false, skipped: false, completedAsPlanned: false, notes: "", updatedAt: new Date().toISOString() })),
      blockOrder: normalizedBlockOrder(original).map((block) => ({ type: block.type, id: block.type === "exercise" ? exerciseIds.get(block.id)! : activityIds.get(block.id)! })),
    };
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
    const exerciseIds = new Map(original.exercises.map((exercise) => [exercise.id, uid("exercise")]));
    const activityIds = new Map(original.cardio.map((activity) => [activity.id, uid("cardio")]));
    const replanned: WorkoutSession = {
      ...structuredClone(original),
      id: uid("workout"),
      originKey: undefined,
      date: localDate(),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      status: "planned",
      source: "repeat",
      updatedAt: new Date().toISOString(),
      exercises: original.exercises.map((item) => ({
        ...structuredClone(item),
        id: exerciseIds.get(item.id)!,
        notes: "",
        sets: item.sets.map((set) => ({ ...set, id: uid("set"), actualReps: "", actualWeight: null, rpe: "", rir: "", completed: false, skipped: false, completedAsPlanned: false, notes: "" })),
      })),
      cardio: original.cardio.map((item) => ({ ...structuredClone(item), id: activityIds.get(item.id)!, efforts: (item.efforts ?? []).map((entry) => ({ ...entry, id: uid("effort"), actualDistanceM: null, actualDurationSec: null, actualLoad: null, completed: false })), actualDurationMin: null, actualDistanceKm: null, effort: "", completed: false, skipped: false, completedAsPlanned: false, notes: "" })),
      blockOrder: normalizedBlockOrder(original).map((block) => ({ type: block.type, id: block.type === "exercise" ? exerciseIds.get(block.id)! : activityIds.get(block.id)! })),
    };
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

  const resetNotice = resetMismatch && <div role="alert" className="m-3 rounded-xl border border-amber-300/30 bg-[#241e15] p-4 text-sm text-white"><p className="font-bold">This log was reset on another device</p><p className="mt-1 text-white/65">Sync is paused. Save this device’s old log before opening the reset log.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => downloadText(JSON.stringify(latestStateRef.current, null, 2), `coach-loop-old-log-${localDate()}.json`, "application/json")}>Download this device’s old log</Button><Button size="sm" onClick={() => void openResetLog()}>Open reset log</Button></div></div>;

  const logBodyweight = (weight: number, unit: Unit, date: string) => {
    if (!validMeasurementDate(date) || date > localDate()) return toast.error("Use a valid date that is not in the future");
    const updatedAt = new Date().toISOString();
    setState((current) => {
      const existing = current.bodyweightEntries.find((entry) => entry.date === date);
      const entry = { id: existing?.id ?? uid("bodyweight"), date, weight, unit, updatedAt };
      return {
        ...current,
        bodyweightEntries: existing
          ? current.bodyweightEntries.map((item) => item.id === existing.id ? entry : item)
          : [...current.bodyweightEntries, entry],
      };
    });
    toast.success(`Bodyweight logged for ${formatDate(date)}`);
  };

  if (!ready) {
    if (loadError) return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white"><div className="max-w-md space-y-4"><h1 className="text-xl font-black">Your local log could not be opened</h1><p className="text-sm leading-6 text-white/60">No data has been reset or uploaded. Close other Coach Loop tabs and try again. Don’t clear browser storage; use your other device or backup if this continues.</p><Button onClick={() => window.location.reload()}>Try again</Button></div></main>;
    return <main className="grid min-h-dvh place-items-center bg-[#10120f] text-white"><div className="flex items-center gap-4"><AppMark compact /><div><p className="font-black">Opening Coach Loop</p><p className="text-sm text-white/35">Loading your local training log…</p></div></div></main>;
  }

  if (workoutOpen && displayedWorkout) {
    return (
      <>
        {resetNotice}
        {localSaveStatus === "error" && <div role="alert" className="fixed inset-x-3 top-2 z-[100] rounded-xl border border-red-300/30 bg-[#371f20] p-3 text-sm text-white">Latest changes are not saved on this device. <Button size="sm" onClick={() => setLocalSaveRetry((value) => value + 1)}>Retry save</Button></div>}
        <ViewErrorBoundary label="This workout" resetKey={displayedWorkout.id}>
          {displayedWorkout.hyrox ? <HyroxWorkout history={displayedState.workouts} key={displayedWorkout.id} workout={displayedWorkout} unit={displayedState.settings.defaultUnit} onUpdate={putWorkout} onFinish={finishEditor} onDiscard={discardWorkout} onBack={leaveEditor} /> : <WorkoutEditor workout={displayedWorkout} state={displayedState} onIncrement={(key,value)=>applyProjectedUpdate(current=>({...current,loadIncrements:{...current.loadIncrements,[key]:{value,updatedAt:new Date().toISOString()}}}))} onUpdate={putWorkout} onFinish={() => finishEditor()} onDiscard={editingWorkoutId ? undefined : discardWorkout} onBack={leaveEditor} />}
        </ViewErrorBoundary>
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <>
      <Tabs value={view} onValueChange={(value) => navigateTab(value as MainView)} className="min-h-dvh bg-[#10120f] text-white">
        <aside className="desktop-rail">
          <div className="rail-brand"><AppMark /></div>
          <TabsList className="rail-nav h-auto w-full flex-col gap-1 bg-transparent p-0">
            {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} onClick={() => returnTabToTop(value)} className="rail-tab"><Icon />{label}</TabsTrigger>)}
          </TabsList>
        </aside>

        <div className="app-main">
          {view !== "settings" && !displayedState.activeWorkoutId && <FirstSteps state={displayedState} view={view} onSetup={(section) => { setView("settings"); requestAnimationFrame(() => { const target = document.getElementById(section); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: "smooth", block: "start" }); }); }} onCoach={() => setCoachOpen(true)} onSample={() => { setImportDraft(sampleWorkout(displayedState.settings.defaultUnit)); setImportOpen(true); }} />}
          {resetNotice}
          {activeChoices.length > 1 && <div role="status" className="m-3 rounded-xl border border-amber-300/25 p-3 text-sm"><p className="font-bold">Choose the workout to resume</p><div className="mt-2 flex flex-wrap gap-2">{activeChoices.map((choice) => <Button key={choice.id} size="sm" variant="outline" onClick={() => { setState((current) => ({ ...current, activeWorkoutId: choice.id })); setWorkoutOpen(true); }}>{choice.name} · {choice.date}</Button>)}</div></div>}
          {localSaveStatus === "error" && <div role="alert" className="m-3 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm">Latest changes are not saved on this device. <Button size="sm" onClick={() => setLocalSaveRetry((value) => value + 1)}>Retry save</Button></div>}
          <TabsContent value="today"><ViewErrorBoundary label="Today" resetKey={view}><TodayView state={displayedState} onHyrox={() => setHyroxOpen(true)} onStartBlank={startBlank} onQuickCardio={quickCardio} onImport={() => setImportOpen(true)} onCoach={() => setCoachOpen(true)} onResume={() => setWorkoutOpen(true)} onStartPlan={startPlannedWorkout} onReschedulePlan={reschedulePlan} onSkipPlan={setSkipWorkoutId} onHistory={() => setView("history")} onTrainingCalendar={() => { setCalendarRequest((value) => value + 1); setView("progress"); }} onBodyweightLog={() => { setBodyweightPromptOpen(true); setView("progress"); }} syncStatus={syncStatus} /></ViewErrorBoundary></TabsContent>
          <TabsContent value="history"><ViewErrorBoundary label="History" resetKey={view}><HistoryView state={displayedState} onEdit={editWorkout} onRepeat={repeatWorkout} onReplan={replanWorkout} onDelete={deleteWorkout} /></ViewErrorBoundary></TabsContent>
          <TabsContent value="coach"><ViewErrorBoundary label="Coach" resetKey={view}><CoachView state={state} onEditGoals={() => { setView("settings"); requestAnimationFrame(() => { const target = document.getElementById("training-goals"); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: "smooth", block: "start" }); }); }} onBuild={() => setCoachOpen(true)} onImport={() => setImportOpen(true)} /></ViewErrorBoundary></TabsContent>
          <TabsContent value="progress"><ViewErrorBoundary label="Progress" resetKey={view}><ProgressView state={displayedState} calendarRequest={calendarRequest} onCalendarOpened={consumeCalendarRequest} onChangeActivityType={(workoutId, activityId, type) => applyProjectedUpdate(current => ({ ...current, workouts: current.workouts.map(workout => workout.id === workoutId && workout.status === "completed" ? { ...workout, updatedAt: new Date().toISOString(), cardio: workout.cardio.map(activity => activity.id === activityId ? { ...activity, activityType: type, updatedAt: new Date().toISOString() } : activity) } : workout) }))} onLogBodyweight={logBodyweight} bodyweightPromptOpen={bodyweightPromptOpen} onBodyweightPromptChange={setBodyweightPromptOpen} onSaveWaist={entry=>applyProjectedUpdate(current=>({...current,waistEntries:[...(current.waistEntries??[]).filter(e=>e.date!==entry.date),entry]}))} /></ViewErrorBoundary></TabsContent>
          <TabsContent value="settings"><ViewErrorBoundary label="Settings" resetKey={view}><SettingsView state={displayedState} canonicalState={state} setState={applyProjectedUpdate} onResolveConflict={resolveConflict} onRestoreBackup={restoreBackup} onReset={resetAll} syncStatus={syncStatus} syncFailure={syncFailure} onRetrySync={retrySync} lastSyncedAt={lastSyncedAt} offlineReady={offlineReady} updateReady={updateReady} /></ViewErrorBoundary></TabsContent>
        </div>

        <TabsList className="mobile-nav">
          {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} onClick={() => returnTabToTop(value)} className="mobile-tab"><Icon /><span>{label}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>

      <HyroxSetup open={hyroxOpen} onOpenChange={setHyroxOpen} onStart={startWorkout} onSave={savePlannedWorkout} active={Boolean(activeWorkout)} unit={state.settings.defaultUnit} />
      <ImportWorkoutDialog open={importOpen} onOpenChange={setImportOpen} text={importDraft} onTextChange={setImportDraft} state={displayedState} onStart={startWorkout} onSave={savePlannedWorkout} />
      <SkipWorkoutDialog workout={skipWorkout} open={Boolean(skipWorkout)} onOpenChange={(open) => { if (!open) setSkipWorkoutId(null); }} onSkip={skipPlannedWorkout} />
      <CoachDialog open={coachOpen} onOpenChange={setCoachOpen} state={displayedState} onRemember={(coachCheckIn) => applyProjectedUpdate((current) => ({ ...current, settings: { ...current.settings, coachCheckIn }, settingsUpdatedAt: new Date().toISOString() }))} onMarkSent={() => applyProjectedUpdate((current) => ({ ...current, settings: { ...current.settings, lastCoachBriefAt: new Date().toISOString() }, settingsUpdatedAt: new Date().toISOString() }))} />
      <Toaster position="top-center" />
    </>
  );
}
