/* External persistence, timers, and controlled-dialog hydration intentionally update state in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Activity, ArrowLeft, Check, ChevronDown, ChevronUp, CopyPlus, Dumbbell, Minus, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { Textarea } from "@/components/ui/textarea";

import { ExerciseSubstitution } from "./exercise-substitution";
import { moveBlock, moveBlockLater, substituteExercise, incrementKey, matchedPreviousSetValues } from "../domain/training-workflow";
import { activityEffortSummary, activityLoggingStyle, completeActivityEffort, makeActivityEffort } from "../domain/activity-logging";

import { completedSetValues, convertWeight, exerciseIdentity, formatLoad, performedReps, performedWeight, performedDuration, performedDistance, formatMeasure, displayedDistance, workoutLiftingVolume } from "../domain/training-metrics";

import { makeCardio, makeExercise, makeSet, uid, type CardioEntry, type ExerciseBlock, type LoadType, type TrainingSet, type TrainingState, type Unit, type WeightMode, type WorkoutSession } from "../domain/training-types";
import type { ActivitySegment } from "../domain/training-types";

import { DecimalInput, formatDate, formatDuration, orderedWorkoutBlocks } from "./shared";
import { insertExerciseSet } from "../domain/exercise-sets";
import { editedSet, setEvidenceError } from "../domain/completion";
import { normalizedBlockOrder } from "../domain/block-order";
import { WorkoutDateDialog } from "./workout-date-dialog";
import { activityStillOpen, exerciseProgressCopy, markTypedActivitiesComplete, nextOpenBlock, nextRestTarget, setDisplayNumbers, shouldPromptForUnconfirmedActuals, unconfirmedActualActivities, unconfirmedActualKey, workoutCompletionSummary, workoutProgressCopy } from "../domain/completion";
import { unusualActivityWarning, unusualSaveLabel, unusualWorkoutWarning } from "../domain/activity-plausibility";
import { planDifferences } from "../domain/plan-review";
import { RunPlan } from "./run-plan";
import { useWakeLock } from "../pwa/use-wake-lock";
import { appendSegmentGroupIteration, completeActivity, completeSegmentGroup, completeSegmentGroupIteration, resolveUnknownSegments, segmentCountLabel, segmentCounts, segmentGroupProgress, segmentLabelError, segmentMismatch, segmentPlanText, segmentUnits, type SegmentUnit } from "../domain/activity-segments";

function compactSetSummary(sets: TrainingSet[]) {
  const groups: Array<{ load: string; reps: string[] }> = [];
  for (const set of sets.filter((item) => item.completed && !item.warmup)) {
    const load = formatLoad(set.loadType, performedWeight(set), set.unit, set.weightMode);
    const last = groups.at(-1);
    if (last?.load === load) last.reps.push(performedReps(set) || "—");
    else groups.push({ load, reps: [performedReps(set) || "—"] });
  }
  return groups.map(({ load, reps }) => `${load.replace(/ total$/, "")} × ${reps.every((rep) => rep === reps[0]) ? `${reps[0]}${reps.length > 1 ? ` (${reps.length} sets)` : ""}` : reps.join("/")}`).join(" · ");
}

export function UnconfirmedActualsPrompt({ activities, onMarkAndFinish, onFinishIncomplete, onReturn }: {
  activities: Array<{ id: string; name: string }>;
  onMarkAndFinish: () => void;
  onFinishIncomplete: () => void;
  onReturn: () => void;
}) {
  return <div className="grid gap-3">
    <p>These activities have results entered, but they are not marked complete. The numbers stay either way.</p>
    <ul className="list-disc pl-5 text-sm text-white/75">{activities.map((activity) => <li key={activity.id}>{activity.name}</li>)}</ul>
    <p className="text-sm text-white/60">Marking them complete keeps those results in History. Finishing without that leaves the activities incomplete. Going back changes nothing.</p>
    <div className="grid gap-2">
      <Button type="button" onClick={onMarkAndFinish} className="bg-[var(--lime)] text-[#11140d]">Mark complete and finish</Button>
      <Button type="button" variant="outline" onClick={onFinishIncomplete}>Finish and leave them incomplete</Button>
      <Button type="button" variant="ghost" onClick={onReturn}>Back to the workout</Button>
    </div>
  </div>;
}

export function CoachCue({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return <div className={`coach-cue compact-coach-cue ${expanded ? "expanded" : ""}`}>
    <strong>Coach</strong><span>{text}</span>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Less" : "More"}</button>
  </div>;
}

function RestTimer({
  nextLabel,
  restUntil,
  onChange,
  measureRef,
}: {
  nextLabel: string;
  restUntil: number | null;
  onChange: (value: number | null) => void;
  measureRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!restUntil) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= restUntil) onChange(null);
    };
    tick();
    const whenVisible = () => { if (document.visibilityState === "visible") tick(); };
    const timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", whenVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", whenVisible); };
  }, [restUntil, onChange]);
  if (!restUntil) return null;
  const seconds = Math.ceil((restUntil - now) / 1000);
  if (seconds <= 0) return null;
  return (
    <div className="rest-timer" ref={measureRef}>
      <div className="rest-timer-copy">
        <p className="text-xs font-bold text-white/55">Rest <span className="font-mono text-xl font-black text-white" role="timer" aria-label="Rest remaining">{formatDuration(seconds)}</span></p>
        <p className="rest-next">{nextLabel ? `Next: ${nextLabel}` : "All work complete"}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Skip</Button>
    </div>
  );
}

const isBarbellExercise = (name: string) => {
  const value = name.toLowerCase();
  if (/dumbbell|machine|smith|kettlebell|cable/.test(value)) return false;
  return /barbell|bench press|deadlift|back squat|front squat|overhead press|military press/.test(value);
};

const isLegPress = (name: string) => /leg press/i.test(name);

function formatGroupedPlates(plates: number[]): string {
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);
  const parts: string[] = [];
  counts.forEach((count, plate) => {
    parts.push(count > 1 ? `${plate} × ${count}` : `${plate}`);
  });
  return parts.join(" + ");
}

const plateColors: Record<string, string> = {
  "45": "#4f83ff",
  "35": "#ffcf4a",
  "25": "#5bd58b",
  "20": "#4f83ff",
  "15": "#ffcf4a",
  "10": "#5bd58b",
  "5": "#f3f3ef",
  "2.5": "#ef5d63",
  "1.25": "#a9b0a3",
};

function PlateVisualizer({
  total,
  unit,
  barWeight,
  isLegPress = false,
}: {
  total: number | null;
  unit: Unit;
  barWeight: number;
  isLegPress?: boolean;
}) {
  if (total === null || !Number.isFinite(total) || total > 5000 || total <= 0 || !Number.isFinite(barWeight) || barWeight < 0 || (!isLegPress && total < barWeight)) return null;
  const available = unit === "lb" ? [45, 35, 25, 10, 5, 2.5, 1.25] : [25, 20, 15, 10, 5, 2.5, 1.25];

  if (isLegPress) {
    let remaining = total;
    const plateCounts: Array<{ plate: number; count: number }> = [];
    for (const plate of available) {
      const count = Math.floor((remaining + 0.001) / plate);
      if (count > 0) {
        plateCounts.push({ plate, count });
        remaining -= count * plate;
      }
    }

    return (
      <div className="plate-visualizer" aria-label={`Leg press plate loading for ${total} ${unit}`}>
        {plateCounts.map(({ plate, count }, idx) => (
          <span key={plate} className="inline-flex items-center gap-1.5">
            {idx > 0 && <span className="text-xs text-white/45">+</span>}
            <span
              className="plate-disc"
              style={{ backgroundColor: plateColors[String(plate)] ?? "#4f83ff" }}
            >
              {plate}
            </span>
            <span className="text-xs font-bold text-white/90">× {count}</span>
          </span>
        ))}
        <span className="plate-copy">
          {total} {unit} total
          {remaining > 0.01 ? ` · ${remaining.toFixed(2).replace(/\.00$/, "")} ${unit} unfilled` : ""}
        </span>
      </div>
    );
  }

  let remaining = Math.max(0, (total - barWeight) / 2);
  const plates: number[] = [];
  for (const plate of available) {
    const count = Math.min(24 - plates.length, Math.floor((remaining + 0.001) / plate));
    for (let i = 0; i < count; i++) plates.push(plate);
    remaining -= count * plate;
  }
  const grouped = formatGroupedPlates(plates);

  return (
    <div className="plate-visualizer" aria-label={`Barbell loading for ${total} ${unit}`}>
      <span className="plate-bar" />
      {plates.map((plate, index) => (
        <span
          key={`${plate}-${index}`}
          className="plate-disc"
          style={{ backgroundColor: plateColors[String(plate)] ?? "#888f82" }}
        >
          {plate}
        </span>
      ))}
      <span className="plate-copy">
        {plates.length ? `${grouped} ${unit} per side` : `Empty ${barWeight} ${unit} bar`}
        {remaining > 0.01 ? ` · ${remaining.toFixed(2).replace(/\.00$/, "")} ${unit} unfilled` : ""}
      </span>
    </div>
  );
}

function SetRow({
  exerciseName,
  isNext,
  numberLabel,
  numberShort,
  set,
  onChange,
  onToggle,
  onMatchPrevious,
  onToggleWarmup,
  onInsert,
  increment,
  onSkip,
  onRemove,
}: {
  exerciseName: string;
  isNext: boolean;
  numberLabel: string;
  numberShort: string;
  set: TrainingSet;
  onChange: (changes: Partial<TrainingSet>) => void;
  onToggle: () => void;
  onMatchPrevious?: () => void;
  onToggleWarmup: () => void;
  onInsert: (position: "before" | "after") => void;
  increment?: number;
  onSkip: () => void;
  onRemove: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  const context = `${exerciseName || "Unnamed exercise"}, ${numberLabel}`;
  const evidenceError = (set.completed || set.actualReps.trim() || set.rpe.trim() || set.rir.trim()) ? setEvidenceError(set) : null;
  const errorId = `evidence-${set.id}`;
  const targetEffort = set.plannedRpe ? `RPE ${set.plannedRpe}` : set.plannedRir ? `RIR ${set.plannedRir}` : "";
  return (
    <>
    <div className={`set-row compact-set-row ${set.completed ? "is-complete" : set.skipped ? "is-skipped" : ""} ${isNext ? "is-next" : ""}`} role="group" aria-label={`${context}${isNext ? ", next unfinished set" : ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button ref={optionsTrigger} variant="ghost" className="set-number" aria-label={`Options for ${context}${targetEffort ? `, target ${targetEffort}` : ""}${set.notes ? ", note recorded" : ""}`}><span>{numberShort}{set.notes ? "•" : ""}</span>{targetEffort ? <small className="set-target-effort" title={`Target ${targetEffort}`}>{set.plannedRpe ? `@${set.plannedRpe}` : `R${set.plannedRir}`}</small> : <MoreHorizontal className="size-3" />}</Button></DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} collisionPadding={{ top: 132, bottom: 16 }} className="border-white/10 bg-[#20231e] text-white">
          <DropdownMenuItem className="min-h-11" onSelect={() => onInsert("before")}><Plus /> Insert set before</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => onInsert("after")}><Plus /> Insert set after</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={onSkip}>{set.skipped ? "Unskip set" : "Skip this set"}</DropdownMenuItem>
          {!!increment && set.loadType !== "bodyweight" && <><DropdownMenuItem className="min-h-11" onSelect={() => onChange({actualWeight: Number(((set.actualWeight ?? set.plannedWeight ?? 0) + increment).toFixed(4)), loadType:"weighted"})}>+ {increment} {set.unit}</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({actualWeight: Number(Math.max(0,(set.actualWeight ?? set.plannedWeight ?? 0)-increment).toFixed(4)), loadType:"weighted"})}>− {increment} {set.unit}</DropdownMenuItem></>}
          {onMatchPrevious && <DropdownMenuItem className="min-h-11" onSelect={onMatchPrevious}><CopyPlus /> Match previous set</DropdownMenuItem>}
          <DropdownMenuItem className="min-h-11" onSelect={() => setNoteOpen(true)}>{set.notes ? "Edit set note" : "Add set note"}</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={onToggleWarmup}>{set.warmup ? "Mark as working set" : "Mark as warm-up"}</DropdownMenuItem>
          {set.completed && <><DropdownMenuItem className="min-h-11" onSelect={() => { const unit: Unit = set.unit === "lb" ? "kg" : "lb"; const convert = (weight: number | null) => weight === null ? null : Number(convertWeight(weight, set.unit, unit).toFixed(4)); onChange({ unit, actualWeight: convert(set.actualWeight), plannedWeight: convert(set.plannedWeight) }); }}>Convert this set to {set.unit === "lb" ? "kg" : "lb"}</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({ unit: set.unit === "lb" ? "kg" : "lb" })}>Correct unit label to {set.unit === "lb" ? "kg" : "lb"} · keep numbers</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({ loadType: "bodyweight", actualWeight: null, plannedWeight: null })}>Correct this set to bodyweight</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({ loadType: "weighted", weightMode: "added" })}>Correct this set to added load</DropdownMenuItem></>}
          <DropdownMenuItem className="min-h-11 text-red-300" onSelect={onRemove}><Trash2 /> Remove set</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="set-input">
        <span>Weight{set.completed && set.completedAsPlanned ? " · Suggested" : ""}</span>
        <DecimalInput
          min={0}
          max={5000}
          aria-label={`${context}, actual weight in ${set.unit === "lb" ? "pounds" : "kilograms"}${set.weightMode === "per_hand" ? " per hand" : set.weightMode === "added" ? " added" : " total"}${set.loadType === "bodyweight" ? ", bodyweight only" : ""}`}
          aria-describedby={evidenceError ? errorId : undefined}
          value={set.actualWeight}
          disabled={set.loadType === "bodyweight"}
          onValueChange={(actualWeight) => onChange({
            actualWeight,
            loadType: actualWeight === null ? set.loadType : "weighted",
          })}
          placeholder={set.loadType === "bodyweight" ? "BW" : set.plannedWeight === null ? "—" : String(set.plannedWeight)}
          className={set.actualWeight == null ? "is-target" : "has-actual"}
        />
      </label>
      <label className="set-input">
        <span>Reps</span>
        <Input
          id={`reps-${set.id}`}
          aria-label={`${context}, actual reps`}
          aria-invalid={Boolean(evidenceError && !/^[1-9]\d*$/.test(set.actualReps.trim()))}
          aria-describedby={evidenceError ? errorId : undefined}
          inputMode="numeric"
          value={set.actualReps}
          onChange={(event) => onChange({ actualReps: event.target.value })}
          placeholder={set.plannedReps || "0"}
          className={set.actualReps.trim() ? "has-actual" : "is-target"}
        />
      </label>
      <Button
        type="button"
        size="icon"
        onClick={onToggle}
        aria-label={set.completed ? `Mark ${context} incomplete` : set.skipped ? `Unskip ${context}` : `Complete ${context}`}
        aria-pressed={set.completed}
        className={set.completed ? "set-check complete" : set.skipped ? "set-check is-skipped" : "set-check"}
      >
        {set.skipped ? <span aria-label="Skipped">—</span> : <Check />}
      </Button>
    </div>
    {evidenceError && <p id={errorId} className="px-3 text-xs text-amber-100" role="status" aria-live="polite">{context}: {set.completed ? "Older result needs review; its original text is preserved. " : "Incomplete draft: "}{evidenceError}</p>}
    <Dialog open={noteOpen} onOpenChange={setNoteOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); optionsTrigger.current?.focus(); }} className="border-white/10 bg-[#151713] text-white sm:max-w-sm"><DialogHeader><DialogTitle>{context} note</DialogTitle><DialogDescription className="text-white/50">Only for this set. Included in History and the coach brief.</DialogDescription></DialogHeader><Textarea aria-label={`Note for ${context}`} value={set.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Technique, pain, or what changed…" className="min-h-20 border-white/10 bg-black/20" /><Button type="button" onClick={() => setNoteOpen(false)} className="bg-[var(--lime)] text-[#11140d]">Done</Button></DialogContent></Dialog>
    </>
  );
}

function ExerciseEditor({
  nextSetId,
  exercise,
  previous,
  recentHistory,
  defaultUnit,
  barWeightLb,
  barWeightKg,
  collapsed = false,
  onToggleCollapse,
  onCollapseOthers,
  onChange,
  onCompleteSet,
  onRemove,
  onLater,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onSubstitute,
  increment,
  onIncrement,
}: {
  nextSetId?: string;
  exercise: ExerciseBlock;
  previous: string | null;
  recentHistory: Array<{ date: string; sets: string[] }>;
  defaultUnit: Unit;
  barWeightLb: number;
  barWeightKg: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCollapseOthers?: () => void;
  onChange: (exercise: ExerciseBlock) => void;
  onCompleteSet: (setId: string, seconds: number) => void;
  onRemove: () => void;
  onLater: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSubstitute: (anchor: HTMLButtonElement | null) => void;
  increment: number;
  onIncrement: (value: number) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const exerciseOptionsRef = useRef<HTMLButtonElement>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const latestExercise = useRef(exercise);
  useLayoutEffect(() => { latestExercise.current = exercise; }, [exercise]);
  const handleNameChange = (name: string) => {
    const updatedAt = new Date().toISOString();
    const next = { ...latestExercise.current, name, updatedAt };
    latestExercise.current = next;
    onChange(next);
  };
  const handleNameBlur = () => {
    onChange({ ...latestExercise.current, updatedAt: new Date().toISOString() });
  };
  const updateSet = (setId: string, changes: Partial<TrainingSet>) => {
    const updatedAt = new Date().toISOString();
    const current = latestExercise.current;
    const next = {
      ...current,
      updatedAt,
      sets: current.sets.map((set) => set.id === setId ? editedSet(set, changes, updatedAt) : set),
    };
    latestExercise.current = next;
    const before = current.sets.find(s => s.id === setId), after = next.sets.find(s => s.id === setId);
    if (before?.completed && after && !after.completed && setEvidenceError(after)) toast.info("This set is now incomplete. Correct its actual values and mark it complete again.");
    onChange(next);
  };
  const removeSet = (setId: string) => {
    const removed = exercise.sets.find((set) => set.id === setId);
    if (!removed) return;
    const index = exercise.sets.findIndex((set) => set.id === setId);
    onChange({ ...exercise, updatedAt: new Date().toISOString(), deletedSetIds: [...(exercise.deletedSetIds ?? []), setId], sets: exercise.sets.filter((set) => set.id !== setId) });
    toast("Set removed", {
      action: { label: "Undo", onClick: () => {
        const current = latestExercise.current;
        const sets = [...current.sets];
        sets.splice(Math.min(index, sets.length), 0, { ...removed, id: uid("set"), updatedAt: new Date().toISOString() });
        onChange({ ...current, sets, updatedAt: new Date().toISOString() });
      } },
    });
  };
  const setNumbers = setDisplayNumbers(exercise.sets);
  const allDone = exercise.sets.length > 0 && exercise.sets.every((set) => set.completed || set.skipped);
  if (allDone && !showCompleted) {
    const summary = compactSetSummary(exercise.sets);
    return <button type="button" className="completed-block" onClick={() => setShowCompleted(true)} aria-label={`Review ${exercise.name}`}><span className="completed-block-icon">{exercise.sets.every(s=>s.completed) ? <Check /> : <span>—</span>}</span><span className="completed-block-copy"><strong>{exercise.name}</strong><small className="exercise-card-progress">{exerciseProgressCopy(exercise.sets)}{summary ? ` · ${summary}` : ""}</small></span><span className="completed-block-edit">Edit <ChevronDown /></span></button>;
  }
  if (collapsed && !allDone) {
    return <button type="button" className="completed-block activity-summary" onClick={onToggleCollapse} aria-label={`Expand ${exercise.name}`}><span className="completed-block-copy"><strong>{exercise.name}</strong><small className="exercise-card-progress">{exerciseProgressCopy(exercise.sets)}{previous ? ` · Last: ${previous}` : ""}</small></span><span className="completed-block-edit">Open <ChevronDown /></span></button>;
  }
  return (
    <Card className={`exercise-card gap-0 border-white/8 bg-[#171916] py-0 shadow-none ${allDone ? "is-complete" : ""}`}>
      <CardHeader className="gap-3 border-b border-white/7 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="exercise-title-line"><Input
            value={exercise.name}
            onChange={(event) => handleNameChange(event.target.value)}
            onBlur={handleNameBlur}
            aria-label="Exercise name"
            className="h-auto border-0 bg-transparent px-0 py-0 text-lg font-black tracking-[-0.035em] shadow-none focus-visible:ring-2"
          />
                    <details className="exercise-setup"><summary aria-label={`Rest interval and load settings; ${exercise.restSec} seconds`}><strong>{exercise.restSec}s</strong><small>rest</small><ChevronDown /></summary><div className="exercise-options-row">
          <label className="block text-xs font-bold text-white/55">
            Load for remaining sets
            <NativeSelect
              value={(() => { const remaining = exercise.sets.find((set) => !set.completed && !set.skipped) ?? exercise.sets[0]; return remaining?.loadType === "weighted" ? remaining.weightMode : remaining?.loadType ?? "unrecorded"; })()}
              onChange={(event) => {
                const value = event.target.value as LoadType | WeightMode;
                const updatedAt = new Date().toISOString();
                const loadType: LoadType = value === "bodyweight" || value === "unrecorded" ? value : "weighted";
                const weightMode: WeightMode = value === "total" || value === "per_hand" || value === "added" ? value : "total";
                onChange({
                  ...exercise,
                  updatedAt,
                  sets: exercise.sets.map((item) => item.completed || item.skipped ? item : ({ ...item, loadType, weightMode, actualWeight: loadType === "bodyweight" ? null : item.actualWeight, plannedWeight: loadType === "bodyweight" ? null : item.plannedWeight, updatedAt })),
                });
              }}
              className="mt-1 h-9 w-full border-white/8 bg-black/20 text-sm "
            >
              <NativeSelectOption value="total">Total load</NativeSelectOption>
              <NativeSelectOption value="per_hand">Per hand</NativeSelectOption>
              <NativeSelectOption value="added">Added weight</NativeSelectOption>
              <NativeSelectOption value="bodyweight">Bodyweight</NativeSelectOption>
              <NativeSelectOption value="unrecorded">Load not recorded</NativeSelectOption>
            </NativeSelect>
          </label>
          <label className="block text-xs font-bold text-white/55">
            Rest
            <DecimalInput
              min={0}
              max={3600}
              value={exercise.restSec}
              onValueChange={(restSec) => onChange({ ...exercise, restSec: restSec ?? 0, updatedAt: new Date().toISOString() })}
              className="mt-1 h-9 w-full border-white/8 bg-black/20 px-2 text-center text-xs"
            />
          </label>
          <label className="field-label">Weight step ({exercise.sets[0]?.unit ?? defaultUnit})<DecimalInput min={0} max={1000} value={increment || null} placeholder="Off" onValueChange={value => onIncrement(value && value > 0 ? value : 0)} /><small>Optional +/− in each set’s menu.</small></label>
          <label className="field-label">Units for remaining sets<NativeSelect value={exercise.sets.find((set) => !set.completed && !set.skipped)?.unit ?? exercise.sets[0]?.unit ?? defaultUnit} onChange={(event) => {
            const updatedAt = new Date().toISOString();
            const unit = event.target.value as Unit;
            onChange({ ...exercise, updatedAt, sets: exercise.sets.map((set) => {
              if (set.completed || set.skipped) return set;
              const convert = (weight: number | null) => weight === null ? null : Number(convertWeight(weight, set.unit, unit).toFixed(4));
              return { ...set, unit, plannedWeight: convert(set.plannedWeight), actualWeight: convert(set.actualWeight), updatedAt };
            }) });
          }} className="mt-1 w-full border-white/8 bg-black/20"><NativeSelectOption value="lb">lb</NativeSelectOption><NativeSelectOption value="kg">kg</NativeSelectOption></NativeSelect></label>
          </div></details></div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="exercise-card-progress rounded-md bg-white/6 px-2 py-0.5 text-xs font-semibold text-white/80">{exerciseProgressCopy(exercise.sets)}</span>
            {previous ? <p className="previous-result text-xs text-white/55">Last: {previous}</p> : recentHistory.length === 0 ? <p className="previous-result text-xs text-white/55">No previous result</p> : null}
            {recentHistory.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} className="min-h-11 shrink-0 px-3 text-xs text-[var(--lime)]/80">{recentHistory.length === 1 ? "Last session" : `Last ${recentHistory.length} sessions`}</Button>}
          </div>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[80dvh] overflow-y-auto border-white/10 bg-[#151713] text-white sm:max-w-md"><DialogHeader><DialogTitle>{exercise.name} history</DialogTitle><DialogDescription className="text-white/60">Recent completed results. Warm-ups are labelled.</DialogDescription></DialogHeader><div className="space-y-3">{recentHistory.map((entry) => <div key={entry.date} className="rounded-xl border border-white/8 bg-black/15 p-3"><p className="mb-1 text-xs font-bold text-white/60">{formatDate(entry.date)}</p>{entry.sets.map((set, index) => <p key={`${index}-${set}`} className="text-sm text-white/78">{set}</p>)}</div>)}</div></DialogContent></Dialog>

        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-white/65 hover:bg-white/8 hover:text-white" aria-label={`Collapse ${exercise.name}`} onClick={() => { if (allDone) setShowCompleted(false); else onToggleCollapse?.(); }}><ChevronUp /></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button ref={exerciseOptionsRef} variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Options for ${exercise.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={6} collisionPadding={16} className="border-white/10 bg-[#20231e] text-white">{onCollapseOthers && <DropdownMenuItem className="min-h-11" onSelect={onCollapseOthers}>Collapse other blocks</DropdownMenuItem>}<DropdownMenuItem className="min-h-11" disabled={!canMoveUp} onSelect={onMoveUp}>Move up</DropdownMenuItem><DropdownMenuItem className="min-h-11" disabled={!canMoveDown} onSelect={onMoveDown}>Move down</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={onLater}>Do later · move to bottom</DropdownMenuItem><DropdownMenuItem className="min-h-11" disabled={!exercise.sets.some(s=>!s.completed&&!s.skipped)} onSelect={() => onSubstitute(exerciseOptionsRef.current)}>Substitute remaining sets</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={()=>onChange({...exercise,updatedAt:new Date().toISOString(),sets:exercise.sets.map(s=>s.completed?s:{...s,skipped:true,updatedAt:new Date().toISOString()})})}>Finish exercise · skip remaining</DropdownMenuItem><DropdownMenuItem className="min-h-11 text-red-300" onSelect={onRemove}>Remove exercise</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 py-3 sm:px-4">
        {exercise.coachNotes && <CoachCue text={exercise.coachNotes} />}
        <div className="set-table-heading" aria-hidden="true"><span>Set</span><span>Weight</span><span>Reps</span><span>Done</span></div>
        {exercise.sets.map((set, index) => (
          <div key={set.id}>
            <SetRow
              exerciseName={exercise.name}
              isNext={set.id === nextSetId}
              numberLabel={setNumbers[index].label}
              numberShort={setNumbers[index].short}
              set={set}
              increment={set.unit === (exercise.sets[0]?.unit ?? defaultUnit) && set.weightMode === exercise.sets[0]?.weightMode ? increment : 0}
              onSkip={() => updateSet(set.id, {skipped:!set.skipped,completed:false,completedAsPlanned:false})}
              onChange={(changes) => updateSet(set.id, changes)}
              onToggleWarmup={() => updateSet(set.id, { warmup: !set.warmup })}
              onInsert={position => {
                const current = latestExercise.current;
                const anchor = current.sets.find(item => item.id === set.id);
                const next = insertExerciseSet(current, set.id, position);
                latestExercise.current = next;
                onChange(next);
                toast.success(`${anchor?.warmup ? "Warm-up" : "Set"} inserted ${position} set ${index + 1}`);
              }}
              onMatchPrevious={index > 0 ? () => {
                const current = latestExercise.current;
                const previousSet = current.sets[index - 1];
                const target = current.sets.find((item) => item.id === set.id) ?? set;
                updateSet(set.id, matchedPreviousSetValues(previousSet, target));
              } : undefined}
              onToggle={() => {
                // A focused weight field commits on blur just before this click.
                // Read its committed value, even when React has not rendered yet.
                const currentSet = latestExercise.current.sets.find((item) => item.id === set.id) ?? set;
                if (currentSet.skipped) {
                  updateSet(set.id, { skipped: false, completed: false, completedAsPlanned: false });
                  return;
                }
                const completing = !currentSet.completed;
                if (completing && !currentSet.actualReps.trim() && !currentSet.plannedReps.trim()) {
                  toast.error("Enter reps before completing this set");
                  return;
                }
                let values: ReturnType<typeof completedSetValues> | null = null;
                try { values = completing ? completedSetValues(currentSet) : null; }
                catch (error) {
                  toast.error(error instanceof Error ? error.message : "Enter the reps you performed");
                  document.getElementById(`reps-${set.id}`)?.focus();
                  return;
                }
                const clearingAcceptedPlan = !completing && currentSet.completedAsPlanned;
                updateSet(set.id, {
                  completed: completing,
                  skipped: false,
                  completedAsPlanned: values?.completedAsPlanned ?? false,
                  actualReps: values?.actualReps ?? (clearingAcceptedPlan ? "" : currentSet.actualReps),
                  actualWeight: values ? values.actualWeight : clearingAcceptedPlan ? null : currentSet.actualWeight,
                });
                if (completing && !currentSet.warmup && exercise.restSec) onCompleteSet(set.id, exercise.restSec);
                if (completing) {
                  // Do not move focus to the next set: on mobile this opens the keyboard
                  // after every Done tap. Only validation errors focus the current reps field.
                  setShowCompleted(false);
                }
              }}
              onRemove={() => removeSet(set.id)}
            />
            {set.id === nextSetId && set.loadType === "weighted" && set.weightMode === "total" && (isBarbellExercise(exercise.name) || isLegPress(exercise.name)) && (
              <PlateVisualizer
                total={set.completedAsPlanned ? set.plannedWeight : set.actualWeight ?? set.plannedWeight}
                unit={set.unit}
                barWeight={isLegPress(exercise.name) ? 0 : (set.unit === "lb" ? barWeightLb : barWeightKg)}
                isLegPress={isLegPress(exercise.name)}
              />
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const last = exercise.sets.at(-1);
              onChange({
                ...exercise,
                sets: [...exercise.sets, makeSet(last?.unit ?? defaultUnit, last ? {
                  plannedReps: last.plannedReps,
                  plannedWeight: last.plannedWeight,
                  loadType: last.loadType,
                  weightMode: last.weightMode,
                } : {})],
                updatedAt: new Date().toISOString(),
              });
            }}
            className="text-[var(--lime)] hover:bg-[var(--lime)]/8 hover:text-[var(--lime)]"
          >
            <Plus /> Add set
          </Button>
        </div>
        <details className="log-notes optional-effort"><summary>Effort · optional{exercise.sets.some((set) => set.rpe || set.rir) ? " · recorded" : ""}</summary><div className="optional-effort-sets">{exercise.sets.map((set, index) => { const rir = Boolean(set.rir) || (!set.rpe && !set.plannedRpe && Boolean(set.plannedRir)); return <label key={set.id} className="field-label">{setNumbers[index].label} · {rir ? "RIR" : "RPE"}<Input inputMode="decimal" value={rir ? set.rir : set.rpe} placeholder="—" onChange={(event) => updateSet(set.id, rir ? { rir: event.target.value, rpe: "" } : { rpe: event.target.value, rir: "" })} /></label>; })}</div></details>
        <details className="log-notes"><summary>{exercise.notes ? "Your notes" : "Add your notes"}</summary><Textarea
          value={exercise.notes}
          onChange={(event) => onChange({ ...exercise, notes: event.target.value, updatedAt: new Date().toISOString() })}
          placeholder="Your notes — what you changed or how it felt…"
          aria-label="Your exercise notes"
          className="min-h-14 border-white/7 bg-black/15 text-sm"
        /></details>
      </CardContent>
    </Card>
  );
}

/** v109 grouped stepper for circuit/swim WITH segments: one REPEAT iteration = one round (circuit) / one set (swim), in stored order; ungrouped segments are single-segment units. It mirrors ActivityStepper (tap-to-expand editing, Add/Repeat, group footers, Undo toasts). Circuit is prescription-and-completion only: no station-result fields exist, differences go in notes. */
/** v109 grouped stepper for circuit/swim WITH segments: one REPEAT iteration = one round (circuit) / one set (swim), in stored order; ungrouped segments are single-segment units. v111: circuit stations are always visible (no Show-all hiding), one "Done round" action per current round, a rounds-done counter, unlimited rounds via "Add another round", and reaching the prescribed round count completes a circuit activity. Swim keeps its set-card flow; only its row spacing changed (v111). Circuit is prescription-and-completion only: no station-result fields exist, differences go in notes. */
function GroupedActivityStepper({ activity, onChange }: { activity: CardioEntry; onChange: (segments: ActivitySegment[], opts?: { completed?: boolean }) => void }) {
  const isCircuit = activity.activityType === "circuit";
  const unitWord = isCircuit ? "Round" : "Set";
  const unitWordPlural = isCircuit ? "rounds" : "sets";
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [labelError, setLabelError] = useState<string | null>(null);
  const segments = activity.segments ?? [];
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const units = segmentUnits(segments);
  const groupedUnits = units.filter(unit => unit.groupId);
  const counts = segmentCounts(segments);
  const groups = [...new Set(segments.flatMap(segment => segment.groupId ? [segment.groupId] : []))];
  const unitNumber = (unit: SegmentUnit) => groupedUnits.indexOf(unit) + 1;
  const unitTitle = (unit: SegmentUnit) => unit.groupId ? `${unitWord} ${unitNumber(unit)} of ${groupedUnits.length}` : segmentPlanText(unit.segments[0]!);
  const unitPosition = (unit: SegmentUnit, index: number) => unit.groupId ? unitTitle(unit) : isCircuit ? segmentPlanText(unit.segments[0]!) : `Interval ${index + 1} of ${units.length}`;
  const resolvedWord = isCircuit ? "rounds" : groupedUnits.length ? "sets" : "intervals";
  const currentUnitIndex = units.findIndex(unit => unit.segments.some(segment => segment.status === "unknown"));
  const currentUnit = currentUnitIndex >= 0 ? units[currentUnitIndex] : null;
  const doneUnits = units.filter(unit => {
    const count = segmentCounts(unit.segments);
    return count.total > 0 && count.unknown === 0 && count.done > 0;
  }).length;
  const statusText = (segment: ActivitySegment) => segment.status === "unknown" ? "Not confirmed" : segment.status === "modified" ? "Measured" : segment.status === "skipped" ? "Skipped" : "As prescribed";
  const unitStatusText = (unit: SegmentUnit) => {
    const count = segmentCounts(unit.segments);
    if (count.total && count.done === count.total) return "Done";
    if (count.total && count.skipped === count.total) return "Skipped";
    if (count.done > 0) return "In progress";
    return "Not confirmed";
  };
  const update = (next: ActivitySegment[], opts?: { completed?: boolean }) => onChange(next, opts);
  const restoredFrom = (previous: ActivitySegment[]) => segmentsRef.current.map(segment => {
    const before = previous.find(item => item.id === segment.id);
    return before ? { ...segment, status: before.status } : segment;
  });
  const restoreStatuses = (previous: ActivitySegment[]) => update(restoredFrom(previous));
  // Circuit only: a Done action that leaves nothing unknown completes the activity (v111). Its toast Undo restores the statuses AND reopens the activity.
  const finishDone = (previous: ActivitySegment[], next: ActivitySegment[], message: string) => {
    const completes = isCircuit && next.every(segment => segment.status !== "unknown");
    if (completes) {
      update(next, { completed: true });
      toast(message, { action: { label: "Undo", onClick: () => update(restoredFrom(previous), { completed: false }) } });
    } else {
      update(next);
      toast(message, { action: { label: "Undo", onClick: () => restoreStatuses(previous) } });
    }
  };
  const doneOne = (segment: ActivitySegment) => {
    const previous = segments;
    const next = segments.map(item => item.id === segment.id ? { ...item, status: item.actualDurationSec != null || item.actualDistanceM != null ? "modified" as const : "completed" as const } : item);
    finishDone(previous, next, `Done: ${segmentPlanText(segment)}`);
  };
  const doneUnit = (unit: SegmentUnit) => {
    if (!unit.groupId) { doneOne(unit.segments[0]!); return; }
    const previous = segments;
    const next = completeSegmentGroupIteration(segments, unit.groupId, unit.iteration);
    finishDone(previous, next, `Done: ${unitTitle(unit)}`);
  };
  const doneLabel = (unit: SegmentUnit) => unit.groupId ? (isCircuit ? "Done round" : `Done: ${unitWord} ${unitNumber(unit)}`) : `Done: ${segmentPlanText(unit.segments[0]!)}`;
  const completeAll = () => {
    const previous = segments;
    const next = resolveUnknownSegments(segments);
    finishDone(previous, next, `All remaining ${resolvedWord} done as prescribed`);
  };
  const completeAllLabel = isCircuit ? "Done: all rounds" : groupedUnits.length ? "Done: all sets" : "Done: all intervals";
  const add = () => update([...segments, { id: uid("segment"), kind: "other", plannedDurationSec: null, actualDurationSec: null, plannedDistanceM: null, actualDistanceM: null, status: "unknown" }]);
  const addLabel = isCircuit ? "Add station" : "Add set";
  const repeatGroup = (groupId: string) => {
    const previous = segments;
    try {
      const next = appendSegmentGroupIteration(segments, groupId);
      update(next);
      toast(`${unitWord} added`, { action: { label: "Undo", onClick: () => update(previous, { completed: activity.completed }) } });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Repeat could not be added"); }
  };
  const addAnotherRound = () => {
    const groupId = groupedUnits[0]?.groupId;
    if (!groupId) return;
    const previous = segments;
    try {
      const next = appendSegmentGroupIteration(segments, groupId);
      update(next);
      toast("Round added", { action: { label: "Undo", onClick: () => update(previous, { completed: activity.completed }) } });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Round could not be added"); }
  };
  const updateOne = (id: string, change: Partial<ActivitySegment>) => update(segments.map(segment => segment.id === id ? { ...segment, ...change } : segment));
  const expandedPart = (segment: ActivitySegment, index: number, word: string) => <div className="activity-stepper-expanded">
    <div className="stepper-plan-fields">
      <label className="field-label">Kind<NativeSelect aria-label={`${word} ${index + 1} kind`} value={segment.kind} onChange={event => updateOne(segment.id, { kind: event.target.value as ActivitySegment["kind"] })}><NativeSelectOption value="run">Run</NativeSelectOption><NativeSelectOption value="walk">Walk</NativeSelectOption><NativeSelectOption value="rest">Rest</NativeSelectOption><NativeSelectOption value="other">Other</NativeSelectOption></NativeSelect></label>
      <label className="field-label">Plan sec<DecimalInput min={0} max={86400} value={segment.plannedDurationSec ?? null} onValueChange={plannedDurationSec => updateOne(segment.id, { plannedDurationSec })} /></label>
      <label className="field-label">Plan m<DecimalInput min={0} max={1000000} value={segment.plannedDistanceM ?? null} onValueChange={plannedDistanceM => updateOne(segment.id, { plannedDistanceM })} /></label>
      <label className="field-label">Label · optional<Input aria-label={`${word} ${index + 1} label`} value={segment.label ?? ""} placeholder="Tempo, Freestyle…" onChange={event => {
        const value = event.target.value;
        const error = segmentLabelError(value);
        if (error) { setLabelError(error); return; }
        setLabelError(null);
        updateOne(segment.id, { label: value.trim() ? value : undefined });
      }} /></label>
      {labelError && <p role="alert" className="text-xs text-amber-100">{labelError}</p>}
    </div>
    <div className="stepper-actual-fields">
      <label className="field-label">Actual sec<DecimalInput min={0} max={86400} value={segment.actualDurationSec ?? null} onValueChange={actualDurationSec => updateOne(segment.id, { actualDurationSec, status: "unknown" })} /></label>
      <label className="field-label">Actual m<DecimalInput min={0} max={1000000} value={segment.actualDistanceM ?? null} onValueChange={actualDistanceM => updateOne(segment.id, { actualDistanceM, status: "unknown" })} /></label>
    </div>
    <span className="segment-status">{statusText(segment)}</span>
    <div className="segment-row-actions">
      <Button type="button" variant="outline" onClick={() => doneOne(segment)}>{segment.actualDurationSec != null || segment.actualDistanceM != null ? "Mark actual" : segment.plannedDurationSec != null || segment.plannedDistanceM != null ? "Complete as prescribed" : "Mark complete"}</Button>
      <Button type="button" variant="ghost" onClick={() => updateOne(segment.id, { status: "skipped" })}>Skip</Button>
      {segment.status !== "unknown" && <Button type="button" variant="ghost" onClick={() => updateOne(segment.id, { status: "unknown" })}>Undo confirmation</Button>}
      <Button type="button" variant="ghost" aria-label={`Remove ${word.toLowerCase()} ${index + 1}`} onClick={() => { const removed = segment; const at = segments.indexOf(segment); update(segments.filter(item => item.id !== segment.id)); if (expandedId === segment.id) setExpandedId(null); toast(`${word} ${index + 1} removed`, { action: { label: "Undo", onClick: () => { const currentSegments = segmentsRef.current; const next = [...currentSegments]; next.splice(Math.min(at, currentSegments.length), 0, removed); update(next); } } }); }}><Trash2 /></Button>
    </div>
  </div>;
  const partCard = (segment: ActivitySegment, index: number, word: string, showInlineDone = true) => <div key={segment.id} className={`activity-stepper-part ${segment.status === "completed" ? "is-done" : segment.status === "modified" ? "is-measured" : segment.status === "skipped" ? "is-skipped" : ""}`}>
    <button type="button" className="stepper-part-text" aria-expanded={expandedId === segment.id} aria-label={`${word} ${index + 1}: ${segmentPlanText(segment)}, ${statusText(segment)}`} onClick={() => setExpandedId(value => value === segment.id ? null : segment.id)}>
      <span className="stepper-part-index">{index + 1}</span>
      <span className="stepper-part-plan">{segmentPlanText(segment)}</span>
      <span className="stepper-part-status">{statusText(segment)}</span>
    </button>
    {showInlineDone && segment.status === "unknown" && <Button type="button" variant="outline" className="stepper-done" onClick={() => doneOne(segment)}>Done: {segmentPlanText(segment)}</Button>}
    {expandedId === segment.id && expandedPart(segment, index, word)}
  </div>;
  const lastDoneRound = [...groupedUnits].reverse().find(unit => segmentCounts(unit.segments).done > 0);
  const undoRound = () => {
    if (!lastDoneRound) return;
    const ids = new Set(lastDoneRound.segments.map(segment => segment.id));
    const next = segments.map(segment => ids.has(segment.id) && (segment.status === "completed" || segment.status === "modified") ? { ...segment, status: "unknown" as const } : segment);
    update(next, { completed: false });
  };
  const unitDotClass = (unit: SegmentUnit) => {
    const count = segmentCounts(unit.segments);
    if (count.modified) return "is-measured";
    if (count.total && count.done === count.total) return "is-done";
    if (count.total && count.skipped === count.total) return "is-skipped";
    if (count.total && count.unknown === 0 && count.done > 0) return "is-done";
    return "";
  };
  const groupFooter = (groupId: string) => {
    const group = segments.filter(segment => segment.groupId === groupId);
    const count = segmentCounts(group);
    const progress = segmentGroupProgress(group);
    const iterations = [...new Set(group.map(segment => segment.iteration ?? 1))].length;
    const multiSegment = iterations > 0 && group.length / iterations > 1;
    return <div className="activity-segment-group" key={groupId}>
      <span>Repeat group · {progress.roundsDone} of {progress.roundsTotal} {unitWordPlural} done{multiSegment ? ` · ${count.done} of ${count.total} intervals done` : ""}</span>
      <Button type="button" variant="outline" disabled={!count.unknown} onClick={() => { const previous = segments; const next = completeSegmentGroup(segments, groupId); finishDone(previous, next, `Done: rest of these ${unitWordPlural}`); }}>Done: rest of these {unitWordPlural}</Button>
      <Button type="button" variant="outline" onClick={() => repeatGroup(groupId)}>Repeat this {unitWord.toLowerCase()}</Button>
    </div>;
  };
  return <section className="activity-stepper grouped-activity-stepper" aria-label={`${unitWord}s for ${activity.name}`}>
    <div className="stepper-progress" aria-label={`${unitWord} progress`}>
      <span className="stepper-position">{currentUnit ? unitPosition(currentUnit, currentUnitIndex) : units.length ? `All ${units.length} ${resolvedWord} resolved · ${counts.done} done${counts.skipped ? ` · ${counts.skipped} skipped` : ""}` : "Nothing added yet"}</span>
      <span className="stepper-dots" role="img" aria-label={`${doneUnits} of ${units.length} ${resolvedWord} done`}>{units.map((unit, index) => <span key={unit.key} className={`stepper-dot ${unitDotClass(unit)} ${index === currentUnitIndex ? "is-current" : ""}`} title={`${unitTitle(unit)}: ${unit.segments.map(segmentPlanText).join(" · ")}`} />)}</span>
    </div>
    {isCircuit && <div className="stepper-rounds-bar">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <p className="stepper-rounds-count">{doneUnits} {doneUnits === 1 ? "round" : "rounds"} done</p>
        <span className="stepper-rounds-helper text-xs text-white/50">{activity.completed ? "Complete" : `${doneUnits} ${doneUnits === 1 ? "round" : "rounds"} logged · Tap Mark complete when finished`}</span>
      </div>
      {lastDoneRound && <Button type="button" variant="outline" size="icon" className="rounds-step" aria-label="Undo round" onClick={undoRound}><Minus /><span className="sr-only">Undo round</span></Button>}
    </div>}
    {currentUnit && <div className="activity-stepper-current">
      {currentUnit.groupId ? <>
        <div className="stepper-current-text" aria-label={`Current ${unitTitle(currentUnit)}`}>
          <span className="stepper-part-plan sr-only">{unitTitle(currentUnit)}</span>
          {activity.intensity ? <span className="stepper-part-intensity">{activity.intensity}</span> : null}
          <div className="stepper-unit-stations">{currentUnit.segments.map((segment, index) => <div key={segment.id} className="stepper-unit-station-row"><span className="stepper-part-index">{index + 1}</span><span className="stepper-unit-station-name">{segmentPlanText(segment)}</span><span className="stepper-part-status">{statusText(segment)}</span></div>)}</div>
        </div>
      </> : <>
        <button type="button" className="stepper-current-text" aria-expanded={expandedId === currentUnit.segments[0]!.id} aria-label={`Current ${unitPosition(currentUnit, currentUnitIndex)}: ${segmentPlanText(currentUnit.segments[0]!)}`} onClick={() => setExpandedId(value => value === currentUnit.segments[0]!.id ? null : currentUnit.segments[0]!.id)}>
          <span className="stepper-part-plan">{segmentPlanText(currentUnit.segments[0]!)}</span>
          {activity.intensity ? <span className="stepper-part-intensity">{activity.intensity}</span> : null}
        </button>
        {expandedId === currentUnit.segments[0]!.id && expandedPart(currentUnit.segments[0]!, segments.indexOf(currentUnit.segments[0]!), isCircuit ? "Station" : "Interval")}
      </>}
      <Button type="button" className="stepper-done-current bg-[var(--lime)] text-[#11140d]" onClick={() => doneUnit(currentUnit)}>{doneLabel(currentUnit)}</Button>
    </div>}
    {isCircuit && <div className="stepper-round-actions">
      <Button type="button" variant="outline" disabled={!counts.unknown} onClick={completeAll}>{completeAllLabel}</Button>
      {groupedUnits.length > 0 && <Button type="button" variant="outline" onClick={addAnotherRound}><Plus /> Add another round</Button>}
    </div>}
    {isCircuit ? <details className="activity-details activity-stepper-units">
      <summary>Rounds & stations ({units.length} {unitWordPlural})</summary>
      <div className="mt-2 grid gap-2">
        {units.map((unit) => unit.groupId ? <div key={unit.key} className="activity-stepper-unit">
          <div className="stepper-unit-head">
            <span className="stepper-unit-title">{unitTitle(unit)}</span>
            <span className="stepper-unit-status">{unitStatusText(unit)}</span>
          </div>
          <div className="activity-stepper-unit-stations">{unit.segments.map((segment, index) => partCard(segment, index, "Station", false))}</div>
        </div> : <div key={unit.key} className="activity-stepper-unit">{partCard(unit.segments[0]!, segments.indexOf(unit.segments[0]!), "Station")}</div>)}
        {groups.map(groupFooter)}
        <Button type="button" variant="outline" onClick={add}><Plus /> Add station</Button>
      </div>
    </details> : <>
      <Button type="button" variant="ghost" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? "Hide all" : units.length === 1 ? `Show all · 1 ${unitWord.toLowerCase()}` : `Show all · ${units.length} ${unitWordPlural}`}</Button>
      {showAll && <div className="activity-stepper-list">
        {units.map((unit) => unit.groupId ? <div key={unit.key} className="activity-stepper-unit">
          <div className="stepper-unit-row">
            <button type="button" className="stepper-unit-text" aria-expanded={expandedUnits.includes(unit.key)} aria-label={`${unitTitle(unit)}: ${unit.segments.map(segmentPlanText).join(" · ")}`} onClick={() => setExpandedUnits(current => current.includes(unit.key) ? current.filter(key => key !== unit.key) : [...current, unit.key])}>
              <span className="stepper-unit-title">{unitTitle(unit)}</span>
              <span className="stepper-unit-summary">{unit.segments.map(segmentPlanText).join(" + ")}</span>
              <span className="stepper-unit-status">{unitStatusText(unit)}</span>
            </button>
            {segmentCounts(unit.segments).unknown > 0 && <Button type="button" variant="outline" className="stepper-done" onClick={() => doneUnit(unit)}>{doneLabel(unit)}</Button>}
          </div>
          {expandedUnits.includes(unit.key) && <div className="activity-stepper-unit-stations">{unit.segments.map(segment => partCard(segment, segments.indexOf(segment), "Interval"))}</div>}
        </div> : <div key={unit.key}>{partCard(unit.segments[0]!, segments.indexOf(unit.segments[0]!), "Interval")}</div>)}
        {groups.map(groupFooter)}
        <Button type="button" variant="outline" onClick={add}><Plus /> {addLabel}</Button>
        <Button type="button" variant="outline" disabled={!counts.unknown} onClick={completeAll}>{completeAllLabel}</Button>
      </div>}
    </>}
  </section>;
}

function ActivityStepper({ activity, onChange }: { activity: CardioEntry; onChange: (segments: ActivitySegment[]) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [quickKind, setQuickKind] = useState<ActivitySegment["kind"]>(activity.activityType === "run" ? "run" : activity.activityType === "walk" ? "walk" : "other");
  const [quickMin, setQuickMin] = useState("");
  const segments = activity.segments ?? [];
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const groups = [...new Set(segments.flatMap(segment => segment.groupId ? [segment.groupId] : []))];
  const counts = segmentCounts(segments);
  const currentIndex = segments.findIndex(segment => segment.status === "unknown");
  const current = currentIndex >= 0 ? segments[currentIndex] : null;
  const statusText = (segment: ActivitySegment) => segment.status === "unknown" ? "Not confirmed" : segment.status === "modified" ? "Measured" : segment.status === "skipped" ? "Skipped" : "As prescribed";
  const update = (next: ActivitySegment[]) => onChange(next);
  const updateOne = (id: string, change: Partial<ActivitySegment>) => update(segments.map(segment => segment.id === id ? { ...segment, ...change } : segment));
  // Done actions only change statuses, so Undo restores statuses by id onto the
  // CURRENT segments instead of replacing the array (a stale snapshot could
  // clobber edits made after the tap).
  const restoreStatuses = (previous: ActivitySegment[]) => update(segmentsRef.current.map(segment => {
    const before = previous.find(item => item.id === segment.id);
    return before ? { ...segment, status: before.status } : segment;
  }));
  const doneOne = (segment: ActivitySegment) => {
    const previous = segments;
    updateOne(segment.id, { status: segment.actualDurationSec != null || segment.actualDistanceM != null ? "modified" : "completed" });
    toast(`Done: ${segmentPlanText(segment)}`, { action: { label: "Undo", onClick: () => restoreStatuses(previous) } });
  };
  const completeAll = () => {
    const previous = segments;
    update(resolveUnknownSegments(segments));
    toast("All remaining intervals done as prescribed", { action: { label: "Undo", onClick: () => restoreStatuses(previous) } });
  };
  const add = () => update([...segments, { id: uid("segment"), kind: activity.activityType === "walk" ? "walk" : activity.activityType === "run" ? "run" : "other", plannedDurationSec: null, actualDurationSec: null, plannedDistanceM: null, actualDistanceM: null, status: "unknown" }]);
  // v111 quick-add: one row, no form navigation, no per-interval save round-trip. Tapping Add appends the interval and leaves the row ready for the next one, so "5 min run, 5 min walk, 4 min run" is three quick taps plus typing.
  const quickMinutes = Number(quickMin);
  const quickValid = quickMin.trim() !== "" && Number.isFinite(quickMinutes) && quickMinutes > 0 && quickMinutes <= 1440;
  const quickAdd = () => {
    if (!quickValid) return;
    update([...segments, { id: uid("segment"), kind: quickKind, plannedDurationSec: Math.round(quickMinutes * 60), actualDurationSec: null, plannedDistanceM: null, actualDistanceM: null, status: "unknown" }]);
    setQuickMin("");
  };
  const repeatGroup = (groupId: string) => {
    const previous = segments;
    try {
      const next = appendSegmentGroupIteration(segments, groupId);
      update(next);
      toast("Repeat added", { action: { label: "Undo", onClick: () => update(previous) } });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Repeat could not be added"); }
  };
  const expandedPart = (segment: ActivitySegment, index: number) => <div className="activity-stepper-expanded">
    <div className="stepper-plan-fields">
      <label className="field-label">Kind<NativeSelect aria-label={`Interval ${index + 1} kind`} value={segment.kind} onChange={event => updateOne(segment.id, { kind: event.target.value as ActivitySegment["kind"] })}><NativeSelectOption value="run">Run</NativeSelectOption><NativeSelectOption value="walk">Walk</NativeSelectOption><NativeSelectOption value="rest">Rest</NativeSelectOption><NativeSelectOption value="other">Other</NativeSelectOption></NativeSelect></label>
      <label className="field-label">Plan sec<DecimalInput min={0} max={86400} value={segment.plannedDurationSec ?? null} onValueChange={plannedDurationSec => updateOne(segment.id, { plannedDurationSec })} /></label>
      <label className="field-label">Plan m<DecimalInput min={0} max={1000000} value={segment.plannedDistanceM ?? null} onValueChange={plannedDistanceM => updateOne(segment.id, { plannedDistanceM })} /></label>
      <label className="field-label">Label · optional<Input aria-label={`Interval ${index + 1} label`} value={segment.label ?? ""} placeholder="Tempo, Freestyle…" onChange={event => {
        const value = event.target.value;
        const error = segmentLabelError(value);
        if (error) { setLabelError(error); return; }
        setLabelError(null);
        updateOne(segment.id, { label: value.trim() ? value : undefined });
      }} /></label>
      {labelError && <p role="alert" className="text-xs text-amber-100">{labelError}</p>}
    </div>
    <div className="stepper-actual-fields">
      <label className="field-label">Actual sec<DecimalInput min={0} max={86400} value={segment.actualDurationSec ?? null} onValueChange={actualDurationSec => updateOne(segment.id, { actualDurationSec, status: "unknown" })} /></label>
      <label className="field-label">Actual m<DecimalInput min={0} max={1000000} value={segment.actualDistanceM ?? null} onValueChange={actualDistanceM => updateOne(segment.id, { actualDistanceM, status: "unknown" })} /></label>
    </div>
    <span className="segment-status">{statusText(segment)}</span>
    <div className="segment-row-actions">
      <Button type="button" variant="outline" onClick={() => doneOne(segment)}>{segment.actualDurationSec != null || segment.actualDistanceM != null ? "Mark actual" : segment.plannedDurationSec != null || segment.plannedDistanceM != null ? "Complete as prescribed" : "Mark complete"}</Button>
      <Button type="button" variant="ghost" onClick={() => updateOne(segment.id, { status: "skipped" })}>Skip</Button>
      {segment.status !== "unknown" && <Button type="button" variant="ghost" onClick={() => updateOne(segment.id, { status: "unknown" })}>Undo confirmation</Button>}
      <Button type="button" variant="ghost" aria-label={`Remove interval ${index + 1}`} onClick={() => { const removed = segment; const at = index; update(segments.filter(item => item.id !== segment.id)); if (expandedId === segment.id) setExpandedId(null); toast(`Interval ${index + 1} removed`, { action: { label: "Undo", onClick: () => { const currentSegments = segmentsRef.current; const next = [...currentSegments]; next.splice(Math.min(at, currentSegments.length), 0, removed); update(next); } } }); }}><Trash2 /></Button>
    </div>
  </div>;
  const partCard = (segment: ActivitySegment, index: number) => <div key={segment.id} className={`activity-stepper-part ${segment.status === "completed" ? "is-done" : segment.status === "modified" ? "is-measured" : segment.status === "skipped" ? "is-skipped" : ""}`}>
    <button type="button" className="stepper-part-text" aria-expanded={expandedId === segment.id} aria-label={`Interval ${index + 1}: ${segmentPlanText(segment)}, ${statusText(segment)}`} onClick={() => setExpandedId(value => value === segment.id ? null : segment.id)}>
      <span className="stepper-part-index">{index + 1}</span>
      <span className="stepper-part-plan">{segmentPlanText(segment)}</span>
      <span className="stepper-part-status">{statusText(segment)}</span>
    </button>
    {segment.status === "unknown" && <Button type="button" variant="outline" className="stepper-done" onClick={() => doneOne(segment)}>Done: {segmentPlanText(segment)}</Button>}
    {expandedId === segment.id && expandedPart(segment, index)}
  </div>;
  return <section className="activity-stepper" aria-label={`Intervals for ${activity.name}`}>
    <div className="stepper-progress" aria-label="Interval progress">
      <span className="stepper-position">{current ? `Interval ${currentIndex + 1} of ${segments.length}` : segments.length ? `All ${segments.length} intervals resolved · ${counts.done} done${counts.skipped ? ` · ${counts.skipped} skipped` : ""}` : "Nothing added yet"}</span>
      <span className="stepper-dots" role="img" aria-label={`${counts.done} of ${segments.length} intervals done`}>{segments.map((segment, index) => <span key={segment.id} className={`stepper-dot ${segment.status === "completed" ? "is-done" : segment.status === "modified" ? "is-measured" : segment.status === "skipped" ? "is-skipped" : ""} ${index === currentIndex ? "is-current" : ""}`} title={`Interval ${index + 1}: ${statusText(segment)}`} />)}</span>
    </div>
    {current && <div className="activity-stepper-current">
      <button type="button" className="stepper-current-text" aria-expanded={expandedId === current.id} aria-label={`Current interval ${currentIndex + 1}: ${segmentPlanText(current)}`} onClick={() => setExpandedId(value => value === current.id ? null : current.id)}>
        <span className="stepper-part-plan">{segmentPlanText(current)}</span>
        {activity.intensity ? <span className="stepper-part-intensity">{activity.intensity}</span> : null}
      </button>
      <Button type="button" className="stepper-done-current bg-[var(--lime)] text-[#11140d]" onClick={() => doneOne(current)}>Done: {segmentPlanText(current)}</Button>
      {expandedId === current.id && expandedPart(current, currentIndex)}
    </div>}
    <div className="stepper-quick-add">
      <div className="stepper-quick-chips" role="group" aria-label="Quick-add kind">
        {(["run", "walk", "rest", "other"] as const).map(kind => <button key={kind} type="button" aria-pressed={quickKind === kind} onClick={() => setQuickKind(kind)}>{kind === "other" ? "Other" : kind[0]!.toUpperCase() + kind.slice(1)}</button>)}
      </div>
      <div className="stepper-quick-row">
        <label className="field-label">Minutes<Input inputMode="decimal" aria-label="Quick-add minutes" value={quickMin} placeholder="—" className="mt-1 h-11 border-white/8 bg-black/20" onChange={event => setQuickMin(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); quickAdd(); } }} /></label>
        <Button type="button" disabled={!quickValid} onClick={quickAdd}>Add</Button>
      </div>
    </div>
    <Button type="button" variant="ghost" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? "Hide all" : segments.length === 1 ? "Show all · 1 interval" : `Show all · ${segments.length} intervals`}</Button>
    {showAll && <div className="activity-stepper-list">
      {segments.map((segment, index) => <div key={segment.id}>{partCard(segment, index)}</div>)}
      {groups.map(groupId => {
        const group = segments.filter(segment => segment.groupId === groupId);
        const count = segmentCounts(group);
        const progress = segmentGroupProgress(group);
        const iterations = [...new Set(group.map(segment => segment.iteration ?? 1))].length;
        const multiSegment = iterations > 0 && group.length / iterations > 1;
        return <div className="activity-segment-group" key={groupId}>
          <span>Repeat group · {progress.roundsDone} of {progress.roundsTotal} repeats done{multiSegment ? ` · ${count.done} of ${count.total} intervals done` : ""}</span>
          <Button type="button" variant="outline" disabled={!count.unknown} onClick={() => { const previous = segments; update(completeSegmentGroup(segments, groupId)); toast("Done: rest of these intervals", { action: { label: "Undo", onClick: () => restoreStatuses(previous) } }); }}>Done: rest of these intervals</Button>
          <Button type="button" variant="outline" onClick={() => repeatGroup(groupId)}>Repeat this interval</Button>
        </div>;
      })}
      <Button type="button" variant="outline" onClick={add}><Plus /> Add interval</Button>
      <Button type="button" variant="outline" disabled={!counts.unknown} onClick={completeAll}>Complete all remaining as prescribed</Button>
    </div>}
  </section>;
}

/** Splits "12 min AMRAP: 10 burpees, 15 swings (24 kg), 200 m run" into a heading and one row per exercise; null when it does not look like a list. */
function amrapParts(text: string): { head: string; items: string[] } | null {
  const match = /^([^:\n]{1,60}):\s*([\s\S]+)$/.exec(text.trim());
  if (!match) return null;
  const items = match[2]!.split(/,\s*(?![^()]*\))|\n+/).map(item => item.trim()).filter(Boolean);
  return items.length >= 2 ? { head: match[1]!.trim(), items } : null;
}

function CardioEditor({
  isNext,
  initiallyOpen = false,
  openOverride,
  onOpenChange,
  onCollapseOthers,
  activity,
  onChange,
  onCompleteEffort,
  onLater,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onRemove,
}: {
  isNext: boolean;
  initiallyOpen?: boolean;
  openOverride?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCollapseOthers?: () => void;
  activity: CardioEntry;
  onChange: (activity: CardioEntry) => void;
  onCompleteEffort: (seconds: number) => void;
  onLater: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRemove: () => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);
  const isOpen = openOverride !== undefined ? openOverride : open;
  const setCardOpen = (nextOpen: boolean) => { setOpen(nextOpen); onOpenChange?.(nextOpen); };
  // v111: "Add intervals" opens the stepper instead of inserting a blank interval, so quick-add chaining starts from an empty list.
  const [intervalsOpen, setIntervalsOpen] = useState(false);
  const [expandedEffortId, setExpandedEffortId] = useState<string | null>(null);
  const style = activityLoggingStyle(activity);
  const efforts = activity.efforts ?? [];
  const distanceUnit = activity.activityType === "swim" || activity.activityType === "row" ? "m" : "km";
  const distanceValue = (value: number | null) => value === null ? null : displayedDistance(value, distanceUnit);
  const readDistance = (value: number | null) => value === null ? null : distanceUnit === "m" ? value / 1000 : value;
  const showDistance = (style === "single" || Boolean(activity.segments?.length)) && !["mobility", "circuit", "force", "yoga", "soccer", "grappling"].includes(activity.activityType);
  const showPerformanceDetails = ["run", "ruck", "hike", "walk", "bike", "swim", "row"].includes(activity.activityType);
  const mobilityText = activity.mobilityMoves.map((move) => `${move.name}${move.prescription ? ` — ${move.prescription}` : ""}`).join("\n");
  const [mobilityDraft, setMobilityDraft] = useState(mobilityText);
  useEffect(() => setMobilityDraft(mobilityText), [activity.id, mobilityText]);
  // v111: updates read the latest activity, not the render closure — toast Undos (rounds counter, stepper add/repeat) must not clobber edits made after the tap.
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const update = (changes: Partial<CardioEntry>, changesActual = false) => onChange({
    ...activityRef.current,
    ...changes,
    completedAsPlanned: "completedAsPlanned" in changes ? Boolean(changes.completedAsPlanned) : changesActual ? false : activityRef.current.completedAsPlanned,
    updatedAt: new Date().toISOString(),
  });
  const postSessionNoSegments = ["yoga", "grappling", "soccer", "water_polo"].includes(activity.activityType) && !activity.segments?.length;
  const mobilitySessionCard = activity.activityType === "mobility" && style === "routine";
  const canAddIntervals = ["run", "walk", "hike", "ruck", "bike", "row", "swim", "other"].includes(activity.activityType) && style !== "efforts";
  if (!isOpen && !activity.completed) {
    const summary = [activity.activityType === "other" ? "Custom activity" : activity.activityType.replace(/_/g, " "), activity.segments?.length ? segmentCountLabel(activity.segments) : activity.plannedDurationMin !== null ? `${formatMeasure(activity.plannedDurationMin)} min` : "", activity.intensity].filter(Boolean).join(" · ");
    const warning = unusualActivityWarning(activity);
    return <>
      <button type="button" className="completed-block activity-summary" onClick={() => setCardOpen(true)} aria-label={`${activity.segments?.length ? "Edit" : "Log"} ${activity.name}`}><span className="completed-block-copy"><strong>{activity.name}</strong><small>{summary}</small></span><span className="completed-block-edit">{activity.segments?.length ? "Edit" : "Log"} <ChevronDown /></span></button>
      {warning && <p role="status" className="activity-warning">{warning}</p>}
    </>;
  }
  if (activity.completed && !showCompleted) {
    const facts = [activityEffortSummary(activity), !activity.segments?.length && (activity.roundsDone ?? 0) > 0 ? `${activity.roundsDone} ${activity.roundsDone === 1 ? "round" : "rounds"} done` : null, performedDuration(activity) !== null ? `${formatMeasure(performedDuration(activity)!)} min` : null, performedDistance(activity) !== null ? `${formatMeasure(distanceValue(performedDistance(activity)!)!)} ${distanceUnit}` : null, activity.effort ? `Effort ${activity.effort}/10` : null].filter(Boolean).join(" · ");
    const warning = unusualActivityWarning(activity);
    return <>
      <button type="button" className="completed-block" onClick={() => setShowCompleted(true)} aria-label={`Edit completed ${activity.name}`}><span className="completed-block-icon"><Check /></span><span className="completed-block-copy"><strong>{activity.name}</strong><small>Complete{facts ? ` · ${facts}` : ""}</small></span><span className="completed-block-edit">Edit <ChevronDown /></span></button>
      {warning && <p role="status" className="activity-warning">{warning}</p>}
    </>;
  }
  return (
    <Card className={`exercise-card activity-card gap-0 py-0 shadow-none ${isNext ? "is-next-activity" : ""} ${activity.completed ? "is-complete" : "border-white/8 bg-[#171916]"}`}>
      <CardHeader className="border-b border-white/7 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <Input
            value={activity.name}
            onChange={(event) => update({ name: event.target.value })}
            aria-label="Activity name"
            className="activity-title-input h-auto border-0 bg-transparent px-0 py-0 text-lg font-black tracking-[-0.035em] shadow-none focus-visible:ring-2"
          />
          <p className="mt-1 text-xs capitalize text-white/60">{activity.activityType === "other" ? "Custom activity" : activity.activityType.replace("_", " ")}</p>
        </div>
        <div className="flex items-center gap-1">
          {activity.completed && <Badge className="activity-complete-badge"><Check /> Complete</Badge>}
          <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-white/65 hover:bg-white/8 hover:text-white" aria-label={`Collapse ${activity.name}`} onClick={() => { if (activity.completed) setShowCompleted(false); else setCardOpen(false); }}><ChevronUp /><span className="sr-only">{activity.completed ? "Complete · Collapse" : "Collapse"}</span></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Options for ${activity.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={6} collisionPadding={16} className="border-white/10 bg-[#20231e] text-white">{onCollapseOthers && <DropdownMenuItem className="min-h-11" onSelect={onCollapseOthers}>Collapse other blocks</DropdownMenuItem>}<DropdownMenuItem className="min-h-11" disabled={!canMoveUp} onSelect={onMoveUp}>Move up</DropdownMenuItem><DropdownMenuItem className="min-h-11" disabled={!canMoveDown} onSelect={onMoveDown}>Move down</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={onLater}>Do later · move to bottom</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => update({ skipped: !activity.skipped, completed: false, completedAsPlanned: false })}>{activity.skipped ? "Restore activity" : "Skip activity"}</DropdownMenuItem><DropdownMenuItem className="min-h-11 text-red-300" onSelect={onRemove}>Remove activity</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="activity-editor px-4 py-3 sm:px-5">
        {activity.coachNotes && <CoachCue text={activity.coachNotes} />}
        {activity.intervals && (activity.activityType === "run" ? <RunPlan text={activity.intervals} /> : amrapParts(activity.intervals) && activity.activityType === "circuit" ? <div className="amrap-plan"><strong className="amrap-plan-head">{amrapParts(activity.intervals)!.head}</strong><ol>{amrapParts(activity.intervals)!.items.map((item, index) => <li key={index}><span>{index + 1}</span>{item}</li>)}</ol></div> : activity.intervals.length > 105 ? <details className="activity-instructions"><summary>{activity.intervals.slice(0, 100).trimEnd()}… · More</summary><p>{activity.intervals}</p></details> : <p className="activity-instructions">{activity.intervals}</p>)}
        <div className="activity-basics-row">
        {style !== "efforts" && <div className="activity-basics">
          <label className="field-label">Minutes<DecimalInput min={0} max={1440} value={activity.actualDurationMin} onValueChange={(actualDurationMin) => update({ actualDurationMin }, true)} placeholder={activity.plannedDurationMin === null ? "—" : formatMeasure(activity.plannedDurationMin)} className={`mt-1 h-9 border-white/8 bg-black/20 ${activity.actualDurationMin == null ? "is-target" : "has-actual"}`} /></label>
          {showDistance && <label className="field-label">Distance {distanceUnit}<DecimalInput min={0} max={distanceUnit === "m" ? 1000000 : 1000} value={distanceValue(activity.actualDistanceKm)} onValueChange={(value) => update({ actualDistanceKm: readDistance(value) }, true)} placeholder={distanceValue(activity.plannedDistanceKm) === null ? "—" : formatMeasure(distanceValue(activity.plannedDistanceKm)!)} className="mt-1 h-9 border-white/8 bg-black/20" /></label>}
          {activity.activityType === "ruck" && style === "single" && <label className="field-label">Pack load <span className="text-white/60">{activity.ruckLoadUnit}</span><DecimalInput min={0} max={1000} value={activity.ruckLoad} onValueChange={(ruckLoad) => update({ ruckLoad }, true)} placeholder="—" className="mt-1 h-9 border-white/8 bg-black/20" /></label>}
        </div>}
        <details className="activity-details"><summary>{activity.activityType === "mobility" ? "Activity options" : "More details"}{activity.intensity ? ` · ${activity.intensity}` : ""}</summary>
          <div className="activity-option-grid"><label className="field-label">Effort / 10 · optional<Input inputMode="decimal" value={activity.effort} placeholder="—" onChange={(event) => update({ effort: event.target.value }, true)} /></label>
            <label className="field-label">Type<NativeSelect value={activity.activityType} onChange={(event) => update({ activityType: event.target.value as CardioEntry["activityType"], loggingStyle: undefined })} aria-label="Activity type" className="mt-1 w-full border-white/8 bg-black/20 capitalize">{(["run", "swim", "water_polo", "bike", "row", "walk", "hike", "ruck", "mobility", "circuit", "force", "soccer", "grappling", "yoga", "other"] as const).map((type) => <NativeSelectOption key={type} value={type}>{type === "other" ? "Custom activity" : type.replace("_", " ")}</NativeSelectOption>)}</NativeSelect></label>
            {activity.activityType === "ruck" && <label className="field-label">Pack unit<NativeSelect value={activity.ruckLoadUnit} onChange={(event) => update({ ruckLoadUnit: event.target.value as Unit, ruckLoad: activity.ruckLoad === null ? null : Number(convertWeight(activity.ruckLoad, activity.ruckLoadUnit, event.target.value as Unit).toFixed(4)) }, true)} className="mt-1 w-full border-white/8 bg-black/20"><NativeSelectOption value="lb">lb</NativeSelectOption><NativeSelectOption value="kg">kg</NativeSelectOption></NativeSelect></label>}
            {style === "efforts" && <><label className="field-label">Effort load unit<NativeSelect value={activity.effortLoadUnit ?? "lb"} onChange={(event) => {
              const from = activity.effortLoadUnit ?? "lb";
              const to = event.target.value as Unit;
              const convert = (value: number | null) => value === null ? null : Number(convertWeight(value, from, to).toFixed(3));
              update({ effortLoadUnit: to, efforts: efforts.map((item) => ({ ...item, plannedLoad: convert(item.plannedLoad), actualLoad: convert(item.actualLoad) })) });
            }} className="mt-1 w-full border-white/8 bg-black/20"><NativeSelectOption value="lb">lb</NativeSelectOption><NativeSelectOption value="kg">kg</NativeSelectOption></NativeSelect></label><label className="field-label">Rest · seconds<DecimalInput min={0} max={3600} value={activity.effortRestSec ?? 0} onValueChange={(effortRestSec) => update({ effortRestSec: effortRestSec ?? 0 })} /></label></>}
            {style === "single" && <label className="field-label">Intensity<Input value={activity.intensity} onChange={(event) => update({ intensity: event.target.value }, true)} placeholder="Easy" className="mt-1 border-white/8 bg-black/20" /></label>}
            {showPerformanceDetails && <>
              {activity.activityType !== "bike" && <label className="field-label">Pace<Input value={activity.pace} onChange={(event) => update({ pace: event.target.value }, true)} placeholder={activity.activityType === "swim" || activity.activityType === "row" ? "2:00/100 m" : "5:30/km"} className="mt-1 border-white/8 bg-black/20" /></label>}
              <label className="field-label">Average HR<DecimalInput min={0} max={300} value={activity.averageHr} onValueChange={(averageHr) => update({ averageHr }, true)} placeholder="bpm" className="mt-1 border-white/8 bg-black/20" /></label>
              {(activity.activityType === "run" || activity.activityType === "ruck" || activity.activityType === "hike" || activity.activityType === "walk") && <label className="field-label">Total ascent (m)<DecimalInput min={0} max={10000} value={activity.elevationM} onValueChange={(elevationM) => update({ elevationM }, true)} placeholder="Elevation gained" className="mt-1 border-white/8 bg-black/20" /></label>}
            </>}
            {(style !== "routine" || activity.activityType === "mobility") && <label className="field-label col-span-2">{style === "routine" ? "Routine" : "Plan / intervals"}<Textarea value={activity.intervals} onChange={(event) => update({ intervals: event.target.value })} placeholder="Optional instructions…" className="mt-1 min-h-14 border-white/8 bg-black/20" /></label>}
          </div>
        </details>
        </div>
        {unusualActivityWarning(activity) && <p role="status" className="activity-warning">{unusualActivityWarning(activity)}</p>}
        {activity.segments?.length ? (activity.activityType === "circuit" || activity.activityType === "swim" ? <GroupedActivityStepper activity={activity} onChange={(segments, opts) => {
          const currentActivity = activityRef.current;
          const added = segments.some(segment => !(currentActivity.segments ?? []).some(item => item.id === segment.id));
          if (opts && opts.completed !== undefined) {
            // v111 circuit: a Done action that resolves every round completes the activity; its toast Undo reopens it.
            if (opts.completed) {
              const done = completeActivity({ ...currentActivity, segments });
              update({ segments: done.segments, completed: true, completedAsPlanned: done.completedAsPlanned }, true);
            } else update({ segments, completed: false, completedAsPlanned: false }, true);
          } else update({ segments, ...(added && currentActivity.completed ? { completed: false } : {}) }, true);
        }} /> : <ActivityStepper activity={activity} onChange={segments => {
          const currentActivity = activityRef.current;
          const added = segments.some(segment => !(currentActivity.segments ?? []).some(item => item.id === segment.id));
          update({ segments, ...(added && currentActivity.completed ? { completed: false } : {}) }, true);
        }} />) : postSessionNoSegments ? null : canAddIntervals ? (intervalsOpen ? <ActivityStepper activity={activity} onChange={segments => {
          const currentActivity = activityRef.current;
          const added = segments.some(segment => !(currentActivity.segments ?? []).some(item => item.id === segment.id));
          update({ segments, ...(added && currentActivity.completed ? { completed: false } : {}) }, true);
        }} /> : <Button type="button" variant="outline" onClick={() => setIntervalsOpen(true)}><Plus /> {activity.activityType === "swim" ? "Add swim sets" : "Add intervals"}</Button>) : null}
        {activity.activityType === "force" && style !== "efforts" && <Button type="button" variant="outline" onClick={() => update({ loggingStyle: "efforts", efforts: [makeActivityEffort()] })}><Plus /> Add effort</Button>}
        {style === "efforts" && <div className="activity-efforts">
          {efforts.map((effort, index) => {
            const changeEffort = (changes: Partial<typeof effort>) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, ...changes } : item), completed: false }, true);
            const unitLabel = activity.effortLoadUnit ?? "lb";
            const planText = [effort.plannedDistanceM !== null ? `${effort.plannedDistanceM} m` : "", effort.plannedDurationSec !== null ? `${effort.plannedDurationSec} sec` : "", effort.plannedLoad !== null ? `${effort.plannedLoad} ${unitLabel}` : ""].filter(Boolean).join(" · ") || "Effort";
            const shownDistanceM = effort.actualDistanceM ?? effort.plannedDistanceM;
            const shownDurationSec = effort.actualDurationSec ?? effort.plannedDurationSec;
            const shownLoad = effort.actualLoad ?? effort.plannedLoad;
            const shownText = [shownDistanceM !== null ? `${shownDistanceM} m` : "", shownDurationSec !== null ? `${shownDurationSec} sec` : "", shownLoad !== null ? `${shownLoad} ${unitLabel}` : ""].filter(Boolean).join(" · ") || "Effort";
            const hasDifferentActual = (effort.actualDistanceM !== null && effort.actualDistanceM !== effort.plannedDistanceM) || (effort.actualDurationSec !== null && effort.actualDurationSec !== effort.plannedDurationSec) || (effort.actualLoad !== null && effort.actualLoad !== effort.plannedLoad);
            // v111: the check never glues onto the plan text. Leading slot holds the number (or a check when done), the plan is its own element, and the action slot is a plain "Done" state in both states — same slot, same size, no layout shift. Tapping Done on a completed effort undoes it.
            return <div key={effort.id} className={`activity-effort ${effort.completed ? "is-done" : ""}`}>
              <span className="activity-effort-state" aria-hidden>{effort.completed ? <Check /> : index + 1}</span>
              <span className="activity-effort-plan-text">{shownText}{hasDifferentActual ? <small className="activity-effort-prescribed"> · prescribed {planText}</small> : null}</span>
              <div className="activity-effort-actions">
                <Button type="button" variant={effort.completed ? "default" : "outline"} className="activity-effort-check" aria-label={`${effort.completed ? "Undo" : "Complete"} effort ${index + 1}: ${shownText}`} onClick={() => {
                  const next = efforts.map((item) => item.id === effort.id ? effort.completed ? { ...item, completed: false, ...(!hasDifferentActual ? { actualDistanceM: null, actualDurationSec: null, actualLoad: null } : {}) } : completeActivityEffort(item) : item);
                  update({ efforts: next, completed: next.length > 0 && next.every((item) => item.completed), completedAsPlanned: false }, true);
                  if (!effort.completed && next.some((item) => !item.completed) && (activity.effortRestSec ?? 0) > 0) onCompleteEffort(activity.effortRestSec!);
                  if (!effort.completed && next.every((item) => item.completed)) setShowCompleted(false);
                }}><Check /><span className="sr-only">Done</span></Button>
                <Button type="button" variant="ghost" className="activity-effort-edit" onClick={() => setExpandedEffortId(value => value === effort.id ? null : effort.id)} aria-expanded={expandedEffortId === effort.id}><Pencil /><span className="sr-only">Did different</span></Button>
              </div>
              {expandedEffortId === effort.id && <div className="activity-effort-actuals">
                <label className="field-label">Metres<DecimalInput min={0} max={1000000} value={effort.actualDistanceM} onValueChange={(actualDistanceM) => changeEffort({ actualDistanceM })} placeholder={effort.plannedDistanceM?.toString() ?? "—"} /></label>
                <label className="field-label">Load <span className="text-white/60">{activity.effortLoadUnit ?? "lb"}</span><DecimalInput min={0} max={5000} value={effort.actualLoad} onValueChange={(actualLoad) => changeEffort({ actualLoad })} placeholder={effort.plannedLoad?.toString() ?? "—"} /></label>
                <label className="field-label">Seconds<DecimalInput min={0} max={86400} value={effort.actualDurationSec} onValueChange={(actualDurationSec) => changeEffort({ actualDurationSec })} placeholder={effort.plannedDurationSec?.toString() ?? "—"} /></label>
                <span className="text-xs text-white/50">Enter what differed, then tap Done.</span>
              </div>}
            </div>;
          })}
          <div className="activity-effort-actions"><Button type="button" variant="ghost" onClick={() => update({ efforts: [...efforts, makeActivityEffort()], completed: false })}><Plus /> Add effort</Button><span>{efforts.filter((item) => item.completed).length}/{efforts.length} done</span></div>
          {efforts.length > 0 && <details className="activity-effort-plan"><summary>Edit prescription</summary><div>{efforts.map((effort, index) => <div key={effort.id} className="activity-effort-plan-row"><span>{index + 1}</span><label className="field-label">Metres<DecimalInput min={0} value={effort.plannedDistanceM} onValueChange={(plannedDistanceM) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, plannedDistanceM } : item) })} /></label><label className="field-label">Load<DecimalInput min={0} value={effort.plannedLoad} onValueChange={(plannedLoad) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, plannedLoad } : item) })} /></label><label className="field-label">Seconds<DecimalInput min={0} value={effort.plannedDurationSec} onValueChange={(plannedDurationSec) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, plannedDurationSec } : item) })} /></label><Button type="button" variant="ghost" aria-label={`Remove effort ${index + 1}`} onClick={() => update({ efforts: efforts.filter((item) => item.id !== effort.id), completed: false })}><X /></Button></div>)}</div></details>}
        </div>}
        {style === "routine" && activity.activityType !== "mobility" && <>
          {activity.activityType === "circuit" && !activity.segments?.length && <div className="routine-rounds-bar space-y-1">
            <div className="routine-rounds">
              <Button type="button" variant="outline" size="icon" className="rounds-step" aria-label="Remove one round" disabled={(activity.roundsDone ?? 0) === 0} onClick={() => update({ roundsDone: (activity.roundsDone ?? 0) - 1 }, true)}><Minus /><span className="sr-only">Undo round</span></Button>
              <span className="routine-rounds-count">{activity.roundsDone ?? 0} {(activity.roundsDone ?? 0) === 1 ? "round" : "rounds"} done</span>
              <Button type="button" variant="outline" size="icon" className="rounds-step rounds-add" aria-label="Done round" onClick={() => { const before = activity.roundsDone ?? 0; update({ roundsDone: before + 1 }, true); toast((before + 1) === 1 ? "1 round done" : `${before + 1} rounds done`, { action: { label: "Undo", onClick: () => update({ roundsDone: before }, true) } }); }}><Check /><span className="sr-only">Done round</span></Button>
            </div>
            <span className="routine-rounds-helper block text-xs text-white/50">{activity.completed ? "Complete" : `${activity.roundsDone ?? 0} ${(activity.roundsDone ?? 0) === 1 ? "round" : "rounds"} logged · Tap Mark complete when finished`}</span>
          </div>}
          <label className="field-label block">{["water_polo", "soccer", "grappling", "yoga"].includes(activity.activityType) ? "What I did" : "What I did / rounds"}<Textarea value={activity.notes} onChange={(event) => update({ notes: event.target.value }, true)} placeholder={activity.activityType === "water_polo" ? "Match, practice, drills, minutes played…" : activity.activityType === "soccer" ? "Match, practice, minutes played…" : activity.activityType === "grappling" ? "Drills, rolling, rounds…" : activity.activityType === "yoga" ? "Flow, class, poses…" : "Rounds, stations, changes…"} className="mt-1 min-h-14 border-white/8 bg-black/20" /></label>
        </>}
        {postSessionNoSegments && style !== "routine" && <label className="field-label block">What I did<Textarea value={activity.notes} onChange={(event) => update({ notes: event.target.value }, true)} placeholder={activity.activityType === "water_polo" ? "Match, practice, drills, minutes played…" : activity.activityType === "soccer" ? "Match, practice, minutes played…" : activity.activityType === "grappling" ? "Drills, rolling, rounds…" : "Flow, class, poses…"} className="mt-1 min-h-14 border-white/8 bg-black/20" /></label>}
        
        {activity.activityType === "mobility" && style === "routine" ? (
          <div className="sm:col-span-2">
            <p className="field-label">Movement routine</p>
            {activity.mobilityMoves.length ? <div className="mobility-list mt-2">{activity.mobilityMoves.map((move) => <div key={move.id}><span>{move.name}</span><strong>{move.prescription}</strong></div>)}</div> : <p className="mt-2 text-sm text-white/60">No movements listed yet.</p>}
            <details className="routine-editor mt-2">
              <summary>Edit movements</summary>
              <Textarea
                value={mobilityDraft}
                onChange={(event) => setMobilityDraft(event.target.value)}
                onBlur={() => update({ mobilityMoves: mobilityDraft.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
                  const [name, ...prescription] = line.split(/\s+[—|]\s+/);
                  return { id: activity.mobilityMoves[index]?.id ?? uid("move"), name: name.trim(), prescription: prescription.join(" — ").trim() };
                }) })}
                placeholder={"Adductor rock-back — 2 × 8/side\nCalf stretch — 2 × 30 sec/side"}
                className="mt-2 min-h-28 border-white/8 bg-black/20"
              />
            </details>
          </div>
        ) : null}
        {mobilitySessionCard && <label className="field-label block">Your notes<Textarea aria-label="Your activity notes" value={activity.notes} onChange={(event) => update({ notes: event.target.value }, true)} placeholder="Feel, pain, terrain — anything useful" className="mt-1 min-h-12 border-white/8 bg-black/20" /></label>}
        {(style !== "routine" || activity.activityType === "mobility") && !mobilitySessionCard && !postSessionNoSegments && <details className="log-notes"><summary>{activity.notes ? "Your notes" : "Add your notes"}</summary><Textarea aria-label="Your activity notes" value={activity.notes} onChange={(event) => update({ notes: event.target.value }, true)} placeholder="Feel, pain, terrain — anything useful" className="mt-1 min-h-12 border-white/8 bg-black/20" /></details>}
        {style !== "efforts" && <Button
          type="button"
          variant="outline"
          onClick={() => {
            const completing = !activity.completed;
            const completed = completing ? completeActivity(activity) : null;
            const clearingAcceptedPlan = !completing && activity.completedAsPlanned;
            update({
              completed: completing,
              completedAsPlanned: completed?.completedAsPlanned ?? false,
              segments: completed?.segments ?? activity.segments,
              actualDurationMin: completed ? completed.actualDurationMin : clearingAcceptedPlan ? null : activity.actualDurationMin,
              actualDistanceKm: completed ? completed.actualDistanceKm : clearingAcceptedPlan ? null : activity.actualDistanceKm,
            });
            setShowCompleted(false);
          }}
          className={activity.completed ? "border-[var(--lime)]/25 bg-[var(--lime)]/8 text-[var(--lime)]" : "border-white/10 bg-white/[0.025] text-white"}
        >
          <Check />{activity.completed ? " Activity complete" : activity.activityType === "circuit" && activity.segments?.length ? " Mark complete" : <> Done<span className="sr-only">: {activity.name}</span>{!activity.segments?.length && (activity.plannedDurationMin !== null || activity.plannedDistanceKm !== null) ? <span className="done-meta">{`${activity.plannedDurationMin !== null ? ` ${formatMeasure(activity.plannedDurationMin)} min` : ""}${activity.plannedDistanceKm !== null ? ` ${formatMeasure(activity.plannedDistanceKm)} km` : ""}`}</span> : null}</>}
        </Button>}
        {style === "efforts" && <p className="text-xs text-white/50">Complete each effort above. Unfinished efforts stay incomplete when you finish the workout.</p>}
      </CardContent>
    </Card>
  );
}

export function WorkoutVolume({ workout, unit }: { workout: WorkoutSession; unit: Unit }) {
  const totals = workoutLiftingVolume(workout, unit);
  if (!workout.exercises.length) return null;
  return <details className="workout-volume"><summary><span>Lifting volume</span><strong>{totals.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}·reps</strong><ChevronDown size={16} /></summary><p>Completed working sets: load × reps. Per-hand loads count both hands; weighted bodyweight exercises count added load only. Warm-ups and bodyweight-only sets are excluded. {totals.countedSets} sets counted{totals.excludedSets ? `; ${totals.excludedSets} other completed working sets excluded (bodyweight, missing load, or unclear reps)` : ""}. Compare similar workouts, rather than treating this as an overall effort score.</p></details>;
}

export function WorkoutEditor({
  saveStatus,
  workout,
  state,
  onUpdate,
  onFinish,
  onDiscard,
  onBack,
  onIncrement,
  demoMode = false,
  quickLogActivityId = null,
}: {
  workout: WorkoutSession;
  state: TrainingState;
  onUpdate: (workout: WorkoutSession) => void;
  saveStatus?: "saving" | "saved" | "error";
  onFinish: (updated?: WorkoutSession) => Promise<void>;
  onDiscard?: () => void;
  onBack: () => void;
  onIncrement: (key: string, value: number) => void;
  demoMode?: boolean;
  quickLogActivityId?: string | null;
}) {
  const [substitutionId, setSubstitutionId] = useState<string|null>(null);
  const substitutionAnchor = useRef<HTMLButtonElement | null>(null);
  const finishFromMenu = useRef(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [actualsPromptOpen, setActualsPromptOpen] = useState(false);
  const [finishCandidate, setFinishCandidate] = useState<WorkoutSession | null>(null);
  const acknowledgedActuals = useRef<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<string[]>([]);
  const [openActivityId, setOpenActivityId] = useState<string | null>(quickLogActivityId);
  const [focusMode, setFocusMode] = useState(false);
  const workoutOptionsRef = useRef<HTMLButtonElement>(null);
  const isEditingHistory = Boolean(workout.completedAt);
  const finishLabel = isEditingHistory ? "Finish editing" : "Finish workout";
  const restStorageKey = `coach-loop-rest-${workout.id}`;
  const restFromKey = `coach-loop-rest-from-${workout.id}`;
  const [restUntil, updateRestUntil] = useState<number | null>(() => {
    try {
      const deadline = Number(localStorage.getItem(restStorageKey));
      return Number.isFinite(deadline) && deadline > Date.now() ? deadline : null;
    } catch { return null; }
  });
  const [restFrom, setRestFrom] = useState<{ blockId: string; setId?: string } | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(restFromKey) ?? "null") as { blockId?: string; setId?: string } | null;
      return saved?.blockId ? { blockId: saved.blockId, setId: saved.setId } : null;
    } catch { return null; }
  });
  const setRestUntil = (deadline: number | null, from?: { blockId: string; setId?: string } | null) => {
    updateRestUntil(deadline);
    if (deadline === null || from !== undefined) setRestFrom(deadline === null ? null : from ?? null);
    try {
      if (deadline === null) localStorage.removeItem(restStorageKey);
      else localStorage.setItem(restStorageKey, String(deadline));
      if (deadline === null || !from) sessionStorage.removeItem(restFromKey);
      else sessionStorage.setItem(restFromKey, JSON.stringify(from));
    } catch { /* The live timer still works if browser storage is unavailable. */ }
  };
  const latestWorkout = useRef(workout);
  useLayoutEffect(() => { latestWorkout.current = workout; }, [workout]);
  const { keepAwakeRequested, setKeepAwakeRequested, wakeLockHeld } = useWakeLock();
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const restTimerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = `coach-loop-position-${workout.id}`;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return;
      let saved = 0;
      try { saved = Number(sessionStorage.getItem(key)); } catch { /* Position memory is optional. */ }
      if (Number.isFinite(saved) && saved > 0) window.scrollTo({ top: saved, behavior: "instant" });
    });
    let pending = 0;
    const remember = () => {
      if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]") ||
          (window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75)) return;
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]") ||
            (window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75)) return;
        try { sessionStorage.setItem(key, String(window.scrollY)); } catch { /* Scrolling still works without storage. */ }
      });
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pending);
      window.removeEventListener("scroll", remember);
      if (!document.activeElement?.matches("input, textarea, select, [contenteditable=true]") &&
          (!window.visualViewport || window.visualViewport.height >= window.innerHeight * 0.75)) {
        try { sessionStorage.setItem(key, String(window.scrollY)); } catch { /* Optional position memory. */ }
      }
    };
  // Restore once per opened workout; changes to its sets must not move the screen.
  }, [workout.id]);
  useEffect(() => {
    const shell = shellRef.current;
    const header = headerRef.current;
    if (!shell || !header) return;
    const updateOffsets = () => {
      // Measure content offsets, never the CSS variable sizing the header itself.
      // Otherwise the first orientation's pixel height freezes its safe-area sizing.
      shell.style.setProperty("--measured-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
      shell.style.setProperty("--live-rest-height", `${Math.ceil(restTimerRef.current?.getBoundingClientRect().height ?? 0)}px`);
    };
    updateOffsets();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateOffsets);
    observer?.observe(header);
    if (restTimerRef.current) observer?.observe(restTimerRef.current);
    window.addEventListener("resize", updateOffsets);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffsets);
    };
  }, [restUntil]);
  const completedBeforeThisWorkout = (item: WorkoutSession) => {
    if (item.status !== "completed" || item.id === workout.id) return false;
    const currentStartedAt = workout.startedAt ?? workout.createdAt;
    const itemFinishedAt = item.completedAt ?? item.updatedAt ?? item.createdAt;
    return item.date < workout.date || (item.date === workout.date && itemFinishedAt <= currentStartedAt);
  };
  const previousFor = (name: string) => {
    const priorWorkout = [...state.workouts]
      .filter(completedBeforeThisWorkout)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? b.updatedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.updatedAt ?? a.createdAt))
      .find((item) => item.exercises.some((exercise) => exerciseIdentity(exercise.name, state.exerciseAliases) === exerciseIdentity(name, state.exerciseAliases)));
    const prior = priorWorkout?.exercises.find((exercise) => exerciseIdentity(exercise.name, state.exerciseAliases) === exerciseIdentity(name, state.exerciseAliases));
    if (!prior || !priorWorkout) return null;
    const target = workout.exercises.find(e => exerciseIdentity(e.name, state.exerciseAliases) === exerciseIdentity(name, state.exerciseAliases))?.sets.find(s => !s.warmup);
    const work = prior.sets.filter(set => set.completed && !set.warmup && (!target || target.loadType === "unrecorded" || (set.loadType === target.loadType && set.weightMode === target.weightMode)));
    const best = [...work].sort((a, b) => convertWeight(performedWeight(b) ?? 0, b.unit, state.settings.defaultUnit) - convertWeight(performedWeight(a) ?? 0, a.unit, state.settings.defaultUnit) || (Number(performedReps(b)) || 0) - (Number(performedReps(a)) || 0))[0];
    return best ? compactSetSummary([best]) : null;
  };
  const recentHistoryFor = (name: string) => [...state.workouts]
    .filter(completedBeforeThisWorkout)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? b.updatedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.updatedAt ?? a.createdAt))
    .flatMap((item) => {
      const exercise = item.exercises.find((entry) => exerciseIdentity(entry.name, state.exerciseAliases) === exerciseIdentity(name, state.exerciseAliases));
      const sets = exercise?.sets.filter((set) => set.completed).map((set) => `${set.warmup ? "Warm-up: " : ""}${formatLoad(set.loadType, performedWeight(set), set.unit, set.weightMode)} × ${performedReps(set) || "reps unrecorded"}${set.rpe ? ` @ RPE ${set.rpe}` : set.rir ? ` @ RIR ${set.rir}` : ""}`) ?? [];
      return sets.length ? [{ date: item.date, sets }] : [];
    }).slice(0, 2);

  const collapseOthers = (keepId: string) => {
    const otherExerciseIds = latestWorkout.current.exercises.filter((item) => item.id !== keepId).map((item) => item.id);
    setFocusMode(true);
    setCollapsedBlockIds(otherExerciseIds);
    setOpenActivityId(latestWorkout.current.cardio.some((item) => item.id === keepId) ? keepId : null);
  };

  const updateExercise = (exercise: ExerciseBlock) => {
    const current = latestWorkout.current;
    const prevExercise = current.exercises.find((item) => item.id === exercise.id);
    const wasDone = Boolean(prevExercise && prevExercise.sets.length > 0 && prevExercise.sets.every((set) => set.completed || set.skipped));
    const isNowDone = exercise.sets.length > 0 && exercise.sets.every((set) => set.completed || set.skipped);
    const next = { ...current, exercises: current.exercises.map((item) => item.id === exercise.id ? exercise : item) };
    latestWorkout.current = next;
    onUpdate(next);
    if (restFrom?.blockId === exercise.id) {
      const activeSet = exercise.sets.find((s) => s.id === restFrom.setId);
      if (!activeSet || !activeSet.completed) {
        setRestUntil(null);
        setRestFrom(null);
      }
    }
    if (wasDone && !isNowDone) {
      setCollapsedBlockIds((ids) => ids.filter((id) => id !== exercise.id));
      if (restUntil && !nextOpenBlock(next)) {
        setRestUntil(null);
      }
    }
    if (!wasDone && isNowDone) {
      const upcoming = nextOpenBlock(next);
      setCollapsedBlockIds((ids) => [...ids.filter((id) => !(upcoming?.type === "exercise" && id === upcoming.exercise.id) && id !== exercise.id), exercise.id]);
      if (upcoming?.type === "activity") setOpenActivityId(upcoming.activity.id);
    }
  };
  const updateCardio = (activity: CardioEntry) => {
    const current = latestWorkout.current;
    const prevActivity = current.cardio.find((item) => item.id === activity.id);
    const wasCompleted = Boolean(prevActivity?.completed);
    const next = { ...current, cardio: current.cardio.map(item => item.id === activity.id ? activity : item) };
    latestWorkout.current = next;
    onUpdate(next);
    if (restFrom?.blockId === activity.id) {
      if (!activity.completed && (!activity.efforts || !activity.efforts.some(e => e.id === restFrom.setId && e.completed))) {
        setRestUntil(null);
        setRestFrom(null);
      }
    }
    if (wasCompleted && !activity.completed) {
      if (restUntil && !nextOpenBlock(next)) {
        setRestUntil(null);
      }
    }
    if (!wasCompleted && activity.completed && (focusMode || current.exercises.length > 0 || collapsedBlockIds.length > 0)) {
      const upcoming = nextOpenBlock(next);
      if (upcoming?.type === "exercise") {
        setCollapsedBlockIds((ids) => ids.filter((id) => id !== upcoming.exercise.id));
      } else if (upcoming?.type === "activity") {
        setOpenActivityId(upcoming.activity.id);
      }
    }
  };

  const moveFor = (id: string) => {
    const order = normalizedBlockOrder(workout);
    const index = order.findIndex(block => block.id === id);
    const move = (direction: "up" | "down") => {
      const next = moveBlock(workout, id, direction);
      if (next !== workout) { onUpdate(next); toast.success(direction === "up" ? "Moved up" : "Moved down"); }
    };
    return { canMoveUp: index > 0, canMoveDown: index >= 0 && index < order.length - 1, onMoveUp: () => move("up"), onMoveDown: () => move("down") };
  };

  const removeExercise = (id: string) => {
    const removed = workout.exercises.find((item) => item.id === id);
    const index = workout.exercises.findIndex((item) => item.id === id);
    if (!removed) return;
    const blockIndex = normalizedBlockOrder(workout).findIndex((block) => block.id === id);
    onUpdate({ ...workout, deletedExerciseIds: [...(workout.deletedExerciseIds ?? []), id], exercises: workout.exercises.filter((item) => item.id !== id), blockOrder: workout.blockOrder.filter((block) => block.id !== id) });
    toast(`${removed.name} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          const current = latestWorkout.current;
          const restored = { ...removed, id: uid("exercise"), updatedAt: new Date().toISOString() };
          const exercises = [...current.exercises];
          exercises.splice(Math.min(index, exercises.length), 0, restored);
          const blockOrder = [...normalizedBlockOrder(current)];
          blockOrder.splice(Math.max(0, blockIndex), 0, { type: "exercise", id: restored.id });
          onUpdate({ ...current, exercises, blockOrder });
        },
      },
    });
  };

  const nextBlock = nextOpenBlock(workout);
  const nextSet = nextBlock?.type === "exercise" ? nextBlock.exercise.sets.find((set) => !set.completed && !set.skipped) : undefined;
  const restTarget = restFrom ? nextRestTarget(workout, restFrom.blockId, restFrom.setId) : undefined;
  const restLabelFor = (exerciseName: string, sets: { id: string; warmup?: boolean }[], setId: string) => {
    const numbers = setDisplayNumbers(sets);
    const at = sets.findIndex((set) => set.id === setId);
    return `${exerciseName} · ${numbers[at]?.label ?? ""}`;
  };
  const fallbackTarget = nextBlock ? (nextBlock.type === "exercise" && nextSet ? restLabelFor(nextBlock.exercise.name, nextBlock.exercise.sets, nextSet.id) : nextBlock.type === "activity" ? nextBlock.activity.name : "") : "";
  const nextLabel = !restUntil ? "" : restFrom
    ? !restTarget ? fallbackTarget : restTarget.type === "activity" ? restTarget.activity.name : restLabelFor(restTarget.exercise.name, restTarget.exercise.sets, restTarget.set.id)
    : fallbackTarget;

  const progress = workoutProgressCopy(workout);
  const reviewWorkout = finishCandidate ?? workout;
  const unusual = unusualWorkoutWarning(reviewWorkout);
  const skippedSets = reviewWorkout.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.skipped&&!s.completed).length,0);
  const unfinishedSets = reviewWorkout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => !set.completed && !set.skipped).length, 0);
  const unfinishedActivities = reviewWorkout.cardio.filter(activityStillOpen).length;
  const differences = planDifferences(reviewWorkout);
  const pendingActuals = unconfirmedActualActivities(workout);
  const updateReviewWorkout = (update: Partial<WorkoutSession>) => {
    const next = { ...reviewWorkout, ...update };
    if (finishCandidate) setFinishCandidate(next);
    else onUpdate(next);
  };
  const openFinish = (fromMenu: boolean) => {
    finishFromMenu.current = fromMenu;
    setFinishCandidate(null);
    if (shouldPromptForUnconfirmedActuals(workout, acknowledgedActuals.current)) {
      setActualsPromptOpen(true);
      return;
    }
    setFinishOpen(true);
  };
  const finishFromActualsPrompt = (markComplete: boolean) => {
    const next = markComplete ? markTypedActivitiesComplete(workout, pendingActuals.map((activity) => activity.id)) : workout;
    acknowledgedActuals.current = markComplete ? null : unconfirmedActualKey(workout);
    setFinishCandidate(next);
    setActualsPromptOpen(false);
    setFinishError("");
    setFinishOpen(true);
  };

  return (
    <div ref={shellRef} className={`workout-shell ${restUntil ? "has-rest-timer" : ""}`}>
      <header ref={headerRef} className="workout-header">
        <Button variant="ghost" size="icon" onClick={() => { onUpdate(latestWorkout.current); onBack(); }} className="min-h-11 min-w-11 text-white/65 hover:bg-white/8 hover:text-white" aria-label="Back to today"><ArrowLeft /></Button>
        <div className="workout-header-title min-w-0 flex-1 overflow-hidden">
          {renaming ? <Input autoFocus value={workout.name} onChange={(event) => onUpdate({ ...workout, name: event.target.value })} onBlur={() => setRenaming(false)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setRenaming(false); }} aria-label="Workout name" className="h-auto border-0 bg-transparent px-0 py-0 text-lg font-black tracking-[-0.04em] shadow-none focus-visible:ring-2" /> : <h1 className="truncate text-lg font-black tracking-[-0.04em]">{workout.name}</h1>}
          <p role="status" className="mt-1 truncate text-xs text-white/55" title={progress}>{progress || "Nothing to log"} · {demoMode ? "Demo · not saved" : saveStatus === "error" ? "Not saved · retry" : saveStatus === "saving" ? "Saving…" : "Saved"}</p>
        </div>
        <div className="workout-header-actions flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon-sm" onClick={() => setKeepAwakeRequested((value) => !value)} className={keepAwakeRequested ? "min-h-11 min-w-11 bg-[var(--lime)]/10 text-[var(--lime)]" : "min-h-11 min-w-11 text-white/60 hover:bg-white/8 hover:text-white"} aria-label={keepAwakeRequested ? "Turn screen wake lock off" : "Keep screen awake"} title={keepAwakeRequested && !wakeLockHeld ? "Keep-awake requested; temporarily unavailable" : undefined}><Activity /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button ref={workoutOptionsRef} variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label="Workout options"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={6} collisionPadding={16} className="border-white/10 bg-[#20231e] text-white">{nextBlock && <DropdownMenuItem onSelect={() => collapseOthers(nextBlock.type === "exercise" ? nextBlock.exercise.id : nextBlock.activity.id)}>Focus current block · collapse others</DropdownMenuItem>}{collapsedBlockIds.length > 0 && <DropdownMenuItem onSelect={() => setCollapsedBlockIds([])}>Expand all exercises</DropdownMenuItem>}<DropdownMenuItem onSelect={() => setRenaming(true)}>Rename workout</DropdownMenuItem><DropdownMenuItem onSelect={() => setDateOpen(true)}>Change workout date</DropdownMenuItem><DropdownMenuItem onSelect={() => openFinish(true)}>{finishLabel}</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button type="button" size="sm" onClick={() => openFinish(false)} className="min-h-11 bg-[var(--lime)] px-3 text-[#11140d]">Done</Button></div>
      </header>

      <ExerciseSubstitution returnFocus={substitutionAnchor} exercise={workout.exercises.find(e=>e.id===substitutionId)??null} state={state} onClose={()=>setSubstitutionId(null)} onSelect={name=>{onUpdate(substituteExercise(workout,substitutionId!,name,state.settings.defaultUnit));setSubstitutionId(null);toast.success("Replacement added; previous sets preserved");}} />
      <RestTimer restUntil={restUntil} onChange={setRestUntil} nextLabel={nextLabel} measureRef={restTimerRef} />

      <main className="workout-main mx-auto w-full max-w-4xl space-y-4 px-3 pb-40 sm:px-6">
        {orderedWorkoutBlocks(workout).map((block) => block.type === "exercise" ? (
          <ExerciseEditor
            key={block.exercise.id}
            exercise={block.exercise}
            nextSetId={nextSet?.id}
            previous={previousFor(block.exercise.name)}
            recentHistory={recentHistoryFor(block.exercise.name)}
            defaultUnit={state.settings.defaultUnit}
            barWeightLb={state.settings.barWeightLb}
            barWeightKg={state.settings.barWeightKg}
            collapsed={collapsedBlockIds.includes(block.exercise.id)}
            onToggleCollapse={() => setCollapsedBlockIds((ids) => ids.includes(block.exercise.id) ? ids.filter((id) => id !== block.exercise.id) : [...ids, block.exercise.id])}
            onCollapseOthers={workout.exercises.length + workout.cardio.length > 1 ? () => collapseOthers(block.exercise.id) : undefined}
            increment={state.loadIncrements?.[incrementKey(block.exercise.name, block.exercise.sets[0]?.unit ?? state.settings.defaultUnit, block.exercise.sets[0]?.weightMode ?? "total", state.exerciseAliases)]?.value ?? 0}
            onIncrement={value => onIncrement(incrementKey(block.exercise.name, block.exercise.sets[0]?.unit ?? state.settings.defaultUnit, block.exercise.sets[0]?.weightMode ?? "total", state.exerciseAliases),value)}
            onLater={() => {onUpdate(moveBlockLater(workout,block.exercise.id));toast.success("Moved to the end of this workout");}}
            {...moveFor(block.exercise.id)}
            onSubstitute={(anchor) => { substitutionAnchor.current = anchor; setSubstitutionId(block.exercise.id); }}
            onChange={updateExercise}
            onCompleteSet={(setId, seconds) => setRestUntil(Date.now() + seconds * 1000, { blockId: block.exercise.id, setId })}
            onRemove={() => removeExercise(block.exercise.id)}
          />
        ) : (
          <CardioEditor
            key={block.activity.id}
            activity={block.activity}
            initiallyOpen={quickLogActivityId === block.activity.id}
            openOverride={openActivityId === block.activity.id}
            onOpenChange={(open) => setOpenActivityId(open ? block.activity.id : null)}
            onCollapseOthers={workout.exercises.length + workout.cardio.length > 1 ? () => collapseOthers(block.activity.id) : undefined}
            isNext={nextBlock?.type === "activity" && nextBlock.activity.id === block.activity.id}
            onChange={updateCardio}
            onCompleteEffort={(seconds) => setRestUntil(Date.now() + seconds * 1000, { blockId: block.activity.id })}
            onLater={() => { onUpdate(moveBlockLater(workout, block.activity.id)); toast.success("Moved to the end of this workout"); }}
            {...moveFor(block.activity.id)}
            onRemove={() => {
              const removed = block.activity;
              const index = normalizedBlockOrder(workout).findIndex((item) => item.id === removed.id);
              onUpdate({ ...workout, deletedActivityIds: [...(workout.deletedActivityIds ?? []), removed.id], cardio: workout.cardio.filter((item) => item.id !== removed.id), blockOrder: workout.blockOrder.filter((item) => item.id !== removed.id) });
              toast(`${removed.name} removed`, { action: { label: "Undo", onClick: () => {
                const current = latestWorkout.current;
                const restored = { ...removed, id: uid("cardio"), updatedAt: new Date().toISOString() };
                const blockOrder = [...normalizedBlockOrder(current)];
                blockOrder.splice(Math.max(0, index), 0, { type: "activity", id: restored.id });
                onUpdate({ ...current, cardio: [...current.cardio, restored], blockOrder });
              } } });
            }}
          />
        ))}

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => {
              const exercise = makeExercise(state.settings.defaultUnit, state.settings.defaultRestSec);
              onUpdate({ ...workout, exercises: [...workout.exercises, exercise], blockOrder: [...workout.blockOrder, { type: "exercise", id: exercise.id }] });
            }}
            className="h-12 border-white/10 bg-white/[0.025] text-white hover:bg-white/6"
          ><Dumbbell /> Add exercise</Button>
          <Button
            variant="outline"
            onClick={() => {
              const activity = makeCardio("other");
              onUpdate({ ...workout, cardio: [...workout.cardio, activity], blockOrder: [...workout.blockOrder, { type: "activity", id: activity.id }] });
            }}
            className="h-12 border-white/10 bg-white/[0.025] text-white hover:bg-white/6"
          ><Activity /> Add activity</Button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3">
          {onDiscard && <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="min-h-11 min-w-11 text-red-200 hover:bg-red-400/10 hover:text-red-100"><Trash2 /> Discard</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-[#171916] text-white">
              <AlertDialogHeader><AlertDialogTitle>Discard this workout?</AlertDialogTitle><AlertDialogDescription className="text-white/60">The active session will be removed. This cannot be undone after you leave the page.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-white">Keep workout</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setRestUntil(null); onDiscard(); }}>Discard</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
          <AlertDialog open={actualsPromptOpen} onOpenChange={(open) => { if (!finishing) setActualsPromptOpen(open); }}>
            <AlertDialogContent className="border-white/10 bg-[#171916] text-white">
              <AlertDialogHeader><AlertDialogTitle>Results are not marked complete</AlertDialogTitle><AlertDialogDescription className="text-white/60">Choose what to do with the activities below. Nothing is discarded.</AlertDialogDescription></AlertDialogHeader>
              <UnconfirmedActualsPrompt activities={pendingActuals.map((activity) => ({ id: activity.id, name: activity.name }))} onMarkAndFinish={() => { void finishFromActualsPrompt(true); }} onFinishIncomplete={() => { void finishFromActualsPrompt(false); }} onReturn={() => setActualsPromptOpen(false)} />
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={finishOpen} onOpenChange={open => { if (!finishing) setFinishOpen(open); if (!open) { setFinishCandidate(null); acknowledgedActuals.current = null; } if (!open && finishFromMenu.current) queueMicrotask(() => { workoutOptionsRef.current?.focus(); finishFromMenu.current = false; }); }}>
            <Button onClick={() => openFinish(false)} className="h-12 bg-[var(--lime)] px-6 font-black text-[#11140d] hover:bg-[var(--lime)]/90"><Check /> {finishLabel}</Button>
            <AlertDialogContent onCloseAutoFocus={(event) => { if (!finishFromMenu.current) return; event.preventDefault(); workoutOptionsRef.current?.focus(); }} className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#171916] text-white">
              <AlertDialogHeader><AlertDialogTitle>{finishLabel}</AlertDialogTitle><AlertDialogDescription className="text-white/60">{workoutCompletionSummary(reviewWorkout)}{unfinishedSets + unfinishedActivities > 0 ? ` ${unfinishedSets ? `${unfinishedSets} unfinished set${unfinishedSets === 1 ? "" : "s"}` : ""}${unfinishedSets && unfinishedActivities ? " and " : ""}${unfinishedActivities ? `${unfinishedActivities} unfinished activit${unfinishedActivities === 1 ? "y" : "ies"}` : ""} will remain marked incomplete in history.` : skippedSets ? ` ${skippedSets} sets explicitly skipped.` : " Everything is complete."}</AlertDialogDescription></AlertDialogHeader>
              {unusual && <p role="status" className="activity-warning">{unusual}</p>}
              {reviewWorkout.cardio.flatMap(activity => { const mismatch = segmentMismatch(activity); return mismatch ? [{ activity, mismatch }] : []; }).map(({ activity, mismatch }) => <p key={activity.id} role="note" className="activity-warning">{activity.name}: {mismatch.message}</p>)}
              <div className="finish-review">
                {isEditingHistory && <Button variant="outline" onClick={() => { setFinishOpen(false); setDateOpen(true); }}>Workout date: {formatDate(workout.date)} · Change</Button>}
                <WorkoutVolume workout={reviewWorkout} unit={state.settings.defaultUnit} />
                {differences.length > 0 && <details className="log-notes" open><summary>Changed from plan · {differences.length}</summary><ul className="space-y-1.5 py-2 text-sm text-white/70">{differences.map((change, index) => <li key={index} className="break-words">{change}</li>)}</ul></details>}
                {unfinishedSets + unfinishedActivities > 0 && <details className="log-notes"><summary>Review unfinished work ({unfinishedSets + unfinishedActivities})</summary><ul className="space-y-2 py-2 text-sm text-white/65">{reviewWorkout.exercises.filter((exercise) => exercise.sets.some((set) => !set.completed && !set.skipped)).map((exercise) => <li key={exercise.id}>{exercise.name}: {exercise.sets.filter((set) => !set.completed && !set.skipped).length} sets incomplete</li>)}{reviewWorkout.cardio.filter(activityStillOpen).map((activity) => <li key={activity.id}>{activity.name}: incomplete</li>)}</ul></details>}
                <div className="finish-fields"><details className="log-notes"><summary>Session effort · optional{reviewWorkout.sessionRpe ? ` · ${reviewWorkout.sessionRpe}/10` : ""}</summary><Input aria-label="Session effort out of 10" inputMode="decimal" value={reviewWorkout.sessionRpe} placeholder="—" onChange={(event) => updateReviewWorkout({ sessionRpe: event.target.value })} /></details>
                <label className="field-label">Notes · optional<Textarea value={reviewWorkout.notes} onChange={(event) => updateReviewWorkout({ notes: event.target.value })} placeholder="How it felt, anything changed…" className="mt-2 min-h-20 border-white/8 bg-black/20" /></label></div>
              </div>
              {finishError && <p role="alert" className="text-sm text-red-200">{finishError}</p>}
              <AlertDialogFooter><AlertDialogCancel disabled={finishing} className="border-white/10 bg-transparent text-white">{isEditingHistory ? "Keep editing" : "Keep training"}</AlertDialogCancel><AlertDialogAction disabled={finishing} onClick={async event => { event.preventDefault(); setFinishing(true); setFinishError(""); try { await onFinish(finishCandidate ?? undefined); setRestUntil(null); setFinishOpen(false); setFinishCandidate(null); } catch { setFinishError("Could not save. Your editable workout is retained. Retry, or keep training and export a backup from Settings."); } finally { setFinishing(false); } }} className="bg-[var(--lime)] text-[#11140d] hover:bg-[var(--lime)]/90">{unusualSaveLabel(unusual, finishing, finishLabel)}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      {dateOpen && <WorkoutDateDialog workout={workout} open={dateOpen} onOpenChange={setDateOpen} onUpdate={onUpdate} returnFocus={workoutOptionsRef} />}
    </div>
  );
}
