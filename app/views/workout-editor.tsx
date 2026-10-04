/* External persistence, timers, and controlled-dialog hydration intentionally update state in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Activity, ArrowLeft, Check, ChevronDown, ChevronUp, CopyPlus, Dumbbell, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
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
import { moveBlockLater, substituteExercise, incrementKey, matchedPreviousSetValues } from "../domain/training-workflow";
import { activityEffortSummary, activityLoggingStyle, completeActivityEffort, makeActivityEffort } from "../domain/activity-logging";

import { completedSetValues, convertWeight, completedActivityValues, exerciseIdentity, formatLoad, performedReps, performedWeight, performedDuration, performedDistance, workoutLiftingVolume } from "../domain/training-metrics";

import { makeCardio, makeExercise, makeSet, uid, type CardioEntry, type ExerciseBlock, type LoadType, type TrainingSet, type TrainingState, type Unit, type WeightMode, type WorkoutSession } from "../domain/training-types";

import { DecimalInput, formatDate, formatDuration, orderedWorkoutBlocks } from "./shared";
import { editedSet, setEvidenceError } from "../domain/completion";
import { normalizedBlockOrder } from "../domain/block-order";
import { WorkoutDateDialog } from "./workout-date-dialog";
import { workoutCompletionSummary } from "../domain/completion";
import { planDifferences } from "../domain/plan-review";
import { RunPlan } from "./run-plan";
import { useWakeLock } from "../pwa/use-wake-lock";

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
}: {
  total: number | null;
  unit: Unit;
  barWeight: number;
}) {
  if (total === null || !Number.isFinite(total) || total > 5000 || !Number.isFinite(barWeight) || barWeight < 0 || total < barWeight) return null;
  const available = unit === "lb" ? [45, 35, 25, 10, 5, 2.5, 1.25] : [25, 20, 15, 10, 5, 2.5, 1.25];
  let remaining = Math.max(0, (total - barWeight) / 2);
  const plates: number[] = [];
  for (const plate of available) {
    const count = Math.min(24 - plates.length, Math.floor((remaining + 0.001) / plate));
    for (let i = 0; i < count; i++) plates.push(plate);
    remaining -= count * plate;
  }

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
        {plates.length ? `${plates.join(" + ")} ${unit} per side` : `Empty ${barWeight} ${unit} bar`}
        {remaining > 0.01 ? ` · ${remaining.toFixed(2).replace(/\.00$/, "")} ${unit} unfilled` : ""}
      </span>
    </div>
  );
}

function SetRow({
  exerciseName,
  isNext,
  set,
  index,
  onChange,
  onToggle,
  onMatchPrevious,
  onToggleWarmup,
  increment,
  onSkip,
  onRemove,
}: {
  exerciseName: string;
  isNext: boolean;
  set: TrainingSet;
  index: number;
  onChange: (changes: Partial<TrainingSet>) => void;
  onToggle: () => void;
  onMatchPrevious?: () => void;
  onToggleWarmup: () => void;
  increment?: number;
  onSkip: () => void;
  onRemove: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  const context = `${exerciseName || "Unnamed exercise"}, ${set.warmup ? "warm-up " : ""}set ${index + 1}`;
  const evidenceError = (set.completed || set.actualReps.trim() || set.rpe.trim() || set.rir.trim()) ? setEvidenceError(set) : null;
  const errorId = `evidence-${set.id}`;
  const targetEffort = set.plannedRpe ? `RPE ${set.plannedRpe}` : set.plannedRir ? `RIR ${set.plannedRir}` : "";
  return (
    <>
    <div className={`set-row compact-set-row ${set.completed ? "is-complete" : set.skipped ? "is-skipped" : ""} ${isNext ? "is-next" : ""}`} role="group" aria-label={`${context}${isNext ? ", next unfinished set" : ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button ref={optionsTrigger} variant="ghost" className="set-number" aria-label={`Options for ${context}${targetEffort ? `, target ${targetEffort}` : ""}${set.notes ? ", note recorded" : ""}`}><span>{set.warmup ? "W" : index + 1}{set.notes ? "•" : ""}</span>{targetEffort ? <small className="set-target-effort" title={`Target ${targetEffort}`}>{set.plannedRpe ? `@${set.plannedRpe}` : `R${set.plannedRir}`}</small> : <MoreHorizontal className="size-3" />}</Button></DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} collisionPadding={{ top: 132, bottom: 16 }} className="border-white/10 bg-[#20231e] text-white">
          <DropdownMenuItem className="min-h-11" onSelect={onSkip}>{set.skipped ? "Restore skipped set" : "Skip this set"}</DropdownMenuItem>
          {!!increment && set.loadType !== "bodyweight" && <><DropdownMenuItem className="min-h-11" onSelect={() => onChange({actualWeight: Number(((set.actualWeight ?? set.plannedWeight ?? 0) + increment).toFixed(4)), loadType:"weighted"})}>+ {increment} {set.unit}</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({actualWeight: Number(Math.max(0,(set.actualWeight ?? set.plannedWeight ?? 0)-increment).toFixed(4)), loadType:"weighted"})}>− {increment} {set.unit}</DropdownMenuItem></>}
          {onMatchPrevious && <DropdownMenuItem className="min-h-11" onSelect={onMatchPrevious}><CopyPlus /> Match previous set</DropdownMenuItem>}
          <DropdownMenuItem className="min-h-11" onSelect={() => setNoteOpen(true)}>{set.notes ? "Edit set note" : "Add set note"}</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={onToggleWarmup}>{set.warmup ? "Mark as working set" : "Mark as warm-up"}</DropdownMenuItem>
          {set.completed && <><DropdownMenuItem className="min-h-11" onSelect={() => { const unit: Unit = set.unit === "lb" ? "kg" : "lb"; const convert = (weight: number | null) => weight === null ? null : Number(convertWeight(weight, set.unit, unit).toFixed(4)); onChange({ unit, actualWeight: convert(set.actualWeight), plannedWeight: convert(set.plannedWeight) }); }}>Convert this set to {set.unit === "lb" ? "kg" : "lb"}</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({ unit: set.unit === "lb" ? "kg" : "lb" })}>Correct unit label to {set.unit === "lb" ? "kg" : "lb"} · keep numbers</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({ loadType: "bodyweight", actualWeight: null, plannedWeight: null })}>Correct this set to bodyweight</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={() => onChange({ loadType: "weighted", weightMode: "added" })}>Correct this set to added load</DropdownMenuItem></>}
          <DropdownMenuItem className="min-h-11 text-red-300" onSelect={onRemove}><Trash2 /> Remove set</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="set-input">
        <span>Weight</span>
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
        />
      </label>
      <Button
        type="button"
        size="icon"
        onClick={onToggle}
        aria-label={set.completed ? `Mark ${context} incomplete` : `Complete ${context}`}
        aria-pressed={set.completed}
        className={set.completed ? "set-check complete" : "set-check"}
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
  onChange,
  onCompleteSet,
  onRemove,
  onLater,
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
  onChange: (exercise: ExerciseBlock) => void;
  onCompleteSet: (seconds: number) => void;
  onRemove: () => void;
  onLater: () => void;
  onSubstitute: () => void;
  increment: number;
  onIncrement: (value: number) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const latestExercise = useRef(exercise);
  useLayoutEffect(() => { latestExercise.current = exercise; }, [exercise]);
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
  const allDone = exercise.sets.length > 0 && exercise.sets.every((set) => set.completed || set.skipped);
  if (allDone && !showCompleted) {
    const summary = compactSetSummary(exercise.sets);
    return <button type="button" className="completed-block" onClick={() => setShowCompleted(true)} aria-label={`Review ${exercise.name}`}><span className="completed-block-icon">{exercise.sets.every(s=>s.completed) ? <Check /> : <span>—</span>}</span><span className="completed-block-copy"><strong>{exercise.name}</strong><small>{exercise.sets.filter(s => s.completed).length} {exercise.sets.filter(s => s.completed).length === 1 ? "set" : "sets"} done{exercise.sets.some(s => s.skipped) ? ` · ${exercise.sets.filter(s => s.skipped).length} skipped` : ""}{summary ? ` · ${summary}` : ""}</small></span><span className="completed-block-edit">Edit <ChevronDown /></span></button>;
  }
  return (
    <Card className={`exercise-card gap-0 border-white/8 bg-[#171916] py-0 shadow-none ${allDone ? "is-complete" : ""}`}>
      <CardHeader className="gap-3 border-b border-white/7 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="exercise-title-line"><Input
            value={exercise.name}
            onChange={(event) => onChange({ ...exercise, name: event.target.value, updatedAt: new Date().toISOString() })}
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
          <div className="mt-1 flex items-center gap-2"><p className="previous-result text-sm text-white/55">{previous ? `Last: ${previous}` : "No previous result"}</p>{recentHistory.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} className="h-7 shrink-0 px-2 text-xs text-[var(--lime)]/80">Last {recentHistory.length}</Button>}</div>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[80dvh] overflow-y-auto border-white/10 bg-[#151713] text-white sm:max-w-md"><DialogHeader><DialogTitle>{exercise.name} history</DialogTitle><DialogDescription className="text-white/45">Recent completed results. Warm-ups are labelled.</DialogDescription></DialogHeader><div className="space-y-3">{recentHistory.map((entry) => <div key={entry.date} className="rounded-xl border border-white/8 bg-black/15 p-3"><p className="mb-1 text-xs font-bold text-white/45">{formatDate(entry.date)}</p>{entry.sets.map((set, index) => <p key={`${index}-${set}`} className="text-sm text-white/78">{set}</p>)}</div>)}</div></DialogContent></Dialog>

        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Options for ${exercise.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent className="border-white/10 bg-[#20231e] text-white"><DropdownMenuItem className="min-h-11" onSelect={onLater}>Do later · move to bottom</DropdownMenuItem><DropdownMenuItem className="min-h-11" disabled={!exercise.sets.some(s=>!s.completed&&!s.skipped)} onSelect={onSubstitute}>Substitute remaining sets</DropdownMenuItem><DropdownMenuItem className="min-h-11" onSelect={()=>onChange({...exercise,updatedAt:new Date().toISOString(),sets:exercise.sets.map(s=>s.completed?s:{...s,skipped:true,updatedAt:new Date().toISOString()})})}>Finish exercise · skip remaining</DropdownMenuItem><DropdownMenuItem className="min-h-11 text-red-300" onSelect={onRemove}>Remove exercise</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 py-3 sm:px-4">
        {allDone && <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-[var(--lime)]/80" onClick={() => setShowCompleted(false)}>{exercise.sets.every(s=>s.completed) ? "All sets complete" : "Exercise finished"} · Collapse <ChevronUp /></Button>}
        {exercise.coachNotes && <CoachCue text={exercise.coachNotes} />}
        <div className="set-table-heading" aria-hidden="true"><span>Set</span><span>Weight</span><span>Reps</span><span>Done</span></div>
        {exercise.sets.map((set, index) => (
          <div key={set.id}>
            <SetRow
              exerciseName={exercise.name}
              isNext={set.id === nextSetId}
              set={set}
              increment={set.unit === (exercise.sets[0]?.unit ?? defaultUnit) && set.weightMode === exercise.sets[0]?.weightMode ? increment : 0}
              onSkip={() => updateSet(set.id, {skipped:!set.skipped,completed:false,completedAsPlanned:false})}
              index={index}
              onChange={(changes) => updateSet(set.id, changes)}
              onToggleWarmup={() => updateSet(set.id, { warmup: !set.warmup })}
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
                if (completing && !currentSet.warmup && exercise.restSec) onCompleteSet(exercise.restSec);
                if (completing) setShowCompleted(false);
              }}
              onRemove={() => removeSet(set.id)}
            />
            {set.id === nextSetId && set.loadType === "weighted" && set.weightMode === "total" && isBarbellExercise(exercise.name) && (
              <PlateVisualizer
                total={set.completedAsPlanned ? set.plannedWeight : set.actualWeight ?? set.plannedWeight}
                unit={set.unit}
                barWeight={set.unit === "lb" ? barWeightLb : barWeightKg}
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
        <details className="log-notes optional-effort"><summary>Effort · optional{exercise.sets.some((set) => set.rpe || set.rir) ? " · recorded" : ""}</summary><div className="optional-effort-sets">{exercise.sets.map((set, index) => { const rir = Boolean(set.rir) || (!set.rpe && !set.plannedRpe && Boolean(set.plannedRir)); return <label key={set.id} className="field-label">Set {index + 1} · {rir ? "RIR" : "RPE"}<Input inputMode="decimal" value={rir ? set.rir : set.rpe} placeholder="—" onChange={(event) => updateSet(set.id, rir ? { rir: event.target.value, rpe: "" } : { rpe: event.target.value, rir: "" })} /></label>; })}</div></details>
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

function CardioEditor({
  isNext,
  activity,
  onChange,
  onCompleteEffort,
  onLater,
  onRemove,
}: {
  isNext: boolean;
  activity: CardioEntry;
  onChange: (activity: CardioEntry) => void;
  onCompleteEffort: (seconds: number) => void;
  onLater: () => void;
  onRemove: () => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const style = activityLoggingStyle(activity);
  const efforts = activity.efforts ?? [];
  const hasCompletedEfforts = efforts.some((effort) => effort.completed);
  const distanceUnit = activity.activityType === "swim" || activity.activityType === "row" ? "m" : "km";
  const distanceValue = (value: number | null) => value === null ? null : distanceUnit === "m" ? value * 1000 : value;
  const readDistance = (value: number | null) => value === null ? null : distanceUnit === "m" ? value / 1000 : value;
  const showDistance = style === "single" && activity.activityType !== "mobility";
  const showPerformanceDetails = ["run", "ruck", "hike", "walk", "bike", "swim", "row"].includes(activity.activityType);
  const mobilityText = activity.mobilityMoves.map((move) => `${move.name}${move.prescription ? ` — ${move.prescription}` : ""}`).join("\n");
  const [mobilityDraft, setMobilityDraft] = useState(mobilityText);
  useEffect(() => setMobilityDraft(mobilityText), [activity.id, mobilityText]);
  const update = (changes: Partial<CardioEntry>, changesActual = false) => onChange({
    ...activity,
    ...changes,
    completedAsPlanned: "completedAsPlanned" in changes ? Boolean(changes.completedAsPlanned) : changesActual ? false : activity.completedAsPlanned,
    updatedAt: new Date().toISOString(),
  });
  if (activity.completed && !showCompleted) {
    const facts = [activityEffortSummary(activity), performedDuration(activity) !== null ? `${performedDuration(activity)} min` : null, performedDistance(activity) !== null ? `${distanceValue(performedDistance(activity))} ${distanceUnit}` : null, activity.effort ? `Effort ${activity.effort}/10` : null].filter(Boolean).join(" · ");
    return <button type="button" className="completed-block" onClick={() => setShowCompleted(true)} aria-label={`Edit completed ${activity.name}`}><span className="completed-block-icon"><Check /></span><span className="completed-block-copy"><strong>{activity.name}</strong><small>Complete{facts ? ` · ${facts}` : ""}</small></span><span className="completed-block-edit">Edit <ChevronDown /></span></button>;
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
          <p className="mt-1 text-xs capitalize text-white/38">{activity.activityType === "other" ? "Custom activity" : activity.activityType.replace("_", " ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {activity.completed && <Badge className="activity-complete-badge"><Check /> Complete</Badge>}
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Options for ${activity.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="border-white/10 bg-[#20231e] text-white"><DropdownMenuItem className="min-h-11" onSelect={onLater}>Do later · move to bottom</DropdownMenuItem><DropdownMenuItem className="min-h-11 text-red-300" onSelect={onRemove}>Remove activity</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="activity-editor px-4 py-3 sm:px-5">
        {activity.completed && <Button variant="ghost" className="w-full text-[var(--lime)]" onClick={() => setShowCompleted(false)}><Check /> Complete · Collapse <ChevronUp /></Button>}
        {activity.coachNotes && <CoachCue text={activity.coachNotes} />}
        {activity.intervals && (activity.activityType === "run" ? <RunPlan text={activity.intervals} /> : activity.intervals.length > 105 ? <details className="activity-instructions"><summary>{activity.intervals.slice(0, 100).trimEnd()}… · More</summary><p>{activity.intervals}</p></details> : <p className="activity-instructions">{activity.intervals}</p>)}
        {style !== "efforts" && <div className="activity-basics">
          <label className="field-label">Minutes<DecimalInput min={0} max={1440} value={activity.actualDurationMin} onValueChange={(actualDurationMin) => update({ actualDurationMin }, true)} placeholder={activity.plannedDurationMin?.toString() ?? "—"} className="mt-1 h-9 border-white/8 bg-black/20" /></label>
          {showDistance && <label className="field-label">Distance {distanceUnit}<DecimalInput min={0} max={distanceUnit === "m" ? 1000000 : 1000} value={distanceValue(activity.actualDistanceKm)} onValueChange={(value) => update({ actualDistanceKm: readDistance(value) }, true)} placeholder={distanceValue(activity.plannedDistanceKm)?.toString() ?? "—"} className="mt-1 h-9 border-white/8 bg-black/20" /></label>}
          {activity.activityType === "ruck" && style === "single" && <label className="field-label">Pack load <span className="text-white/40">{activity.ruckLoadUnit}</span><DecimalInput min={0} max={1000} value={activity.ruckLoad} onValueChange={(ruckLoad) => update({ ruckLoad }, true)} placeholder="—" className="mt-1 h-9 border-white/8 bg-black/20" /></label>}
        </div>}
        {style === "efforts" && <div className="activity-efforts">
          {efforts.map((effort, index) => {
            const changeEffort = (changes: Partial<typeof effort>) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, ...changes } : item), completed: false }, true);
            return <div key={effort.id} className={`activity-effort ${effort.completed ? "is-done" : ""}`}>
              <span className="activity-effort-number">{index + 1}</span>
              <label className="field-label">Metres<DecimalInput min={0} max={1000000} value={effort.actualDistanceM} onValueChange={(actualDistanceM) => changeEffort({ actualDistanceM })} placeholder={effort.plannedDistanceM?.toString() ?? "—"} /></label>
              <label className="field-label">Load <span className="text-white/40">{activity.effortLoadUnit ?? "lb"}</span><DecimalInput min={0} max={5000} value={effort.actualLoad} onValueChange={(actualLoad) => changeEffort({ actualLoad })} placeholder={effort.plannedLoad?.toString() ?? "—"} /></label>
              <label className="field-label">Seconds<DecimalInput min={0} max={86400} value={effort.actualDurationSec} onValueChange={(actualDurationSec) => changeEffort({ actualDurationSec })} placeholder={effort.plannedDurationSec?.toString() ?? "—"} /></label>
              <Button type="button" variant={effort.completed ? "default" : "outline"} className="activity-effort-check" aria-label={`${effort.completed ? "Undo" : "Complete"} effort ${index + 1}`} onClick={() => {
                const next = efforts.map((item) => item.id === effort.id ? effort.completed ? { ...item, completed: false } : completeActivityEffort(item) : item);
                update({ efforts: next, completed: next.length > 0 && next.every((item) => item.completed), completedAsPlanned: false }, true);
                if (!effort.completed && next.some((item) => !item.completed) && (activity.effortRestSec ?? 0) > 0) onCompleteEffort(activity.effortRestSec!);
                if (!effort.completed && next.every((item) => item.completed)) setShowCompleted(false);
              }}><Check /></Button>
            </div>;
          })}
          <div className="activity-effort-actions"><Button type="button" variant="ghost" onClick={() => update({ efforts: [...efforts, makeActivityEffort()], completed: false })}><Plus /> Add effort</Button><span>{efforts.filter((item) => item.completed).length}/{efforts.length} done</span></div>
          {efforts.length > 0 && <details className="activity-effort-plan"><summary>Edit prescription</summary><div>{efforts.map((effort, index) => <div key={effort.id} className="activity-effort-plan-row"><span>{index + 1}</span><label className="field-label">Metres<DecimalInput min={0} value={effort.plannedDistanceM} onValueChange={(plannedDistanceM) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, plannedDistanceM } : item) })} /></label><label className="field-label">Load<DecimalInput min={0} value={effort.plannedLoad} onValueChange={(plannedLoad) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, plannedLoad } : item) })} /></label><label className="field-label">Seconds<DecimalInput min={0} value={effort.plannedDurationSec} onValueChange={(plannedDurationSec) => update({ efforts: efforts.map((item) => item.id === effort.id ? { ...item, plannedDurationSec } : item) })} /></label><Button type="button" variant="ghost" aria-label={`Remove effort ${index + 1}`} onClick={() => update({ efforts: efforts.filter((item) => item.id !== effort.id), completed: false })}><X /></Button></div>)}</div></details>}
        </div>}
        {style === "routine" && activity.activityType !== "mobility" && <label className="field-label block">{["water_polo", "soccer", "grappling", "yoga"].includes(activity.activityType) ? "What I did" : "What I did / rounds"}<Textarea value={activity.notes} onChange={(event) => update({ notes: event.target.value }, true)} placeholder={activity.activityType === "water_polo" ? "Match, practice, drills, minutes played…" : activity.activityType === "soccer" ? "Match, practice, minutes played…" : activity.activityType === "grappling" ? "Drills, rolling, rounds…" : activity.activityType === "yoga" ? "Flow, class, poses…" : "Rounds, stations, changes…"} className="mt-1 min-h-14 border-white/8 bg-black/20" /></label>}
        <details className="activity-details"><summary>{activity.activityType === "mobility" ? "Activity options" : "More details"}{activity.intensity ? ` · ${activity.intensity}` : ""}</summary>
          <div className="activity-option-grid"><label className="field-label">Effort / 10 · optional<Input inputMode="decimal" value={activity.effort} placeholder="—" onChange={(event) => update({ effort: event.target.value }, true)} /></label>
            <label className="field-label">Type<NativeSelect value={activity.activityType} onChange={(event) => update({ activityType: event.target.value as CardioEntry["activityType"], loggingStyle: undefined })} aria-label="Activity type" className="mt-1 w-full border-white/8 bg-black/20 capitalize">{(["run", "swim", "water_polo", "bike", "row", "walk", "hike", "ruck", "mobility", "circuit", "force", "soccer", "grappling", "yoga", "other"] as const).map((type) => <NativeSelectOption key={type} value={type}>{type === "other" ? "Custom activity" : type.replace("_", " ")}</NativeSelectOption>)}</NativeSelect></label>
            <label className="field-label">Logging style<NativeSelect value={style} disabled={hasCompletedEfforts} onChange={(event) => update({ loggingStyle: event.target.value as CardioEntry["loggingStyle"], efforts: event.target.value === "efforts" ? efforts : [] })} className="mt-1 w-full border-white/8 bg-black/20"><NativeSelectOption value="single">One result</NativeSelectOption><NativeSelectOption value="routine">Routine</NativeSelectOption><NativeSelectOption value="efforts">Repeated efforts</NativeSelectOption></NativeSelect></label>
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
        {activity.activityType === "mobility" && style === "routine" ? (
          <div className="sm:col-span-2">
            <p className="field-label">Movement routine</p>
            {activity.mobilityMoves.length ? <div className="mobility-list mt-2">{activity.mobilityMoves.map((move) => <div key={move.id}><span><Check />{move.name}</span><strong>{move.prescription}</strong></div>)}</div> : <p className="mt-2 text-sm text-white/38">No movements listed yet.</p>}
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
        {(style !== "routine" || activity.activityType === "mobility") && <details className="log-notes"><summary>{activity.notes ? "Your notes" : "Add your notes"}</summary><Textarea aria-label="Your activity notes" value={activity.notes} onChange={(event) => update({ notes: event.target.value }, true)} placeholder="Feel, pain, terrain — anything useful" className="mt-1 min-h-12 border-white/8 bg-black/20" /></details>}
        {style !== "efforts" && <Button
          type="button"
          variant="outline"
          onClick={() => {
            const completing = !activity.completed;
            const values = completing ? completedActivityValues(activity) : null;
            const clearingAcceptedPlan = !completing && activity.completedAsPlanned;
            update({
              completed: completing,
              completedAsPlanned: values?.completedAsPlanned ?? false,
              actualDurationMin: values ? values.actualDurationMin : clearingAcceptedPlan ? null : activity.actualDurationMin,
              actualDistanceKm: values ? values.actualDistanceKm : clearingAcceptedPlan ? null : activity.actualDistanceKm,
            });
            setShowCompleted(false);
          }}
          className={activity.completed ? "border-[var(--lime)]/25 bg-[var(--lime)]/8 text-[var(--lime)]" : "border-white/10 bg-white/[0.025] text-white"}
        >
          <Check /> {activity.completed ? "Activity complete" : "Mark activity complete"}
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
}: {
  workout: WorkoutSession;
  state: TrainingState;
  onUpdate: (workout: WorkoutSession) => void;
  saveStatus?: "saving" | "saved" | "error";
  onFinish: () => Promise<void>;
  onDiscard?: () => void;
  onBack: () => void;
  onIncrement: (key: string, value: number) => void;
}) {
  const [substitutionId, setSubstitutionId] = useState<string|null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const isEditingHistory = Boolean(workout.completedAt);
  const finishLabel = isEditingHistory ? "Finish editing" : "Finish workout";
  const restStorageKey = `coach-loop-rest-${workout.id}`;
  const [restUntil, updateRestUntil] = useState<number | null>(() => {
    try {
      const deadline = Number(localStorage.getItem(restStorageKey));
      return Number.isFinite(deadline) && deadline > Date.now() ? deadline : null;
    } catch { return null; }
  });
  const setRestUntil = (deadline: number | null) => {
    updateRestUntil(deadline);
    try {
      if (deadline === null) localStorage.removeItem(restStorageKey);
      else localStorage.setItem(restStorageKey, String(deadline));
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

  const updateExercise = (exercise: ExerciseBlock) => {
    const current = latestWorkout.current;
    const next = { ...current, exercises: current.exercises.map((item) => item.id === exercise.id ? exercise : item) };
    latestWorkout.current = next;
    onUpdate(next);
  };
  const updateCardio = (activity: CardioEntry) => {
    const next = { ...latestWorkout.current, cardio: latestWorkout.current.cardio.map(item => item.id === activity.id ? activity : item) };
    latestWorkout.current = next; onUpdate(next);
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

  const nextBlock = orderedWorkoutBlocks(workout).find((block) => block.type === "exercise"
    ? block.exercise.sets.some((set) => !set.completed && !set.skipped) : !block.activity.completed);
  const nextSet = nextBlock?.type === "exercise" ? nextBlock.exercise.sets.find((set) => !set.completed && !set.skipped) : undefined;
  const nextLabel = nextBlock?.type === "exercise"
    ? `${nextBlock.exercise.name} · Set ${nextBlock.exercise.sets.findIndex((set) => set.id === nextSet?.id) + 1}`
    : nextBlock?.activity.name ?? "";

  const doneCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0) + workout.cardio.reduce((sum, item) => sum + (item.efforts?.length ? item.efforts.filter((effort) => effort.completed).length : Number(item.completed)), 0);
  const totalCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(s=>!s.skipped || s.completed).length, 0) + workout.cardio.reduce((sum, item) => sum + (item.efforts?.length || 1), 0);
  const skippedSets = workout.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.skipped&&!s.completed).length,0);
  const unfinishedSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => !set.completed && !set.skipped).length, 0);
  const unfinishedActivities = workout.cardio.filter((item) => !item.completed).length;
  const differences = planDifferences(workout);

  return (
    <div ref={shellRef} className={`workout-shell ${restUntil ? "has-rest-timer" : ""}`}>
      <header ref={headerRef} className="workout-header">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white/65 hover:bg-white/8 hover:text-white" aria-label="Back to today"><ArrowLeft /></Button>
        <div className="workout-header-title min-w-0 flex-1 overflow-hidden">
          {renaming ? <Input autoFocus value={workout.name} onChange={(event) => onUpdate({ ...workout, name: event.target.value })} onBlur={() => setRenaming(false)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setRenaming(false); }} aria-label="Workout name" className="h-auto border-0 bg-transparent px-0 py-0 text-lg font-black tracking-[-0.04em] shadow-none focus-visible:ring-2" /> : <h1 className="truncate text-lg font-black tracking-[-0.04em]">{workout.name}</h1>}
          <p role="status" className="mt-1 truncate text-xs text-white/55" title={`${doneCount} of ${totalCount} items complete${skippedSets ? `, ${skippedSets} skipped` : ""}`}>{doneCount}/{totalCount} done{skippedSets ? ` · ${skippedSets} skipped` : ""} · {saveStatus === "error" ? "Not saved · retry" : saveStatus === "saving" ? "Saving…" : "Saved"}</p>
        </div>
        <div className="workout-header-actions flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon-sm" onClick={() => setKeepAwakeRequested((value) => !value)} className={keepAwakeRequested ? "bg-[var(--lime)]/10 text-[var(--lime)]" : "text-white/45 hover:bg-white/8 hover:text-white"} aria-label={keepAwakeRequested ? "Turn screen wake lock off" : "Keep screen awake"} title={keepAwakeRequested && !wakeLockHeld ? "Keep-awake requested; temporarily unavailable" : undefined}><Activity /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Workout options"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="border-white/10 bg-[#20231e] text-white"><DropdownMenuItem onSelect={() => setRenaming(true)}>Rename workout</DropdownMenuItem><DropdownMenuItem onSelect={() => setDateOpen(true)}>Change workout date</DropdownMenuItem><DropdownMenuItem onSelect={() => setFinishOpen(true)}>{finishLabel}</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button type="button" size="sm" onClick={() => setFinishOpen(true)} className="bg-[var(--lime)] px-2 text-[#11140d]">Done</Button></div>
      </header>

      <ExerciseSubstitution exercise={workout.exercises.find(e=>e.id===substitutionId)??null} state={state} onClose={()=>setSubstitutionId(null)} onSelect={name=>{onUpdate(substituteExercise(workout,substitutionId!,name,state.settings.defaultUnit));setSubstitutionId(null);toast.success("Replacement added; previous sets preserved");}} />
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
            increment={state.loadIncrements?.[incrementKey(block.exercise.name, block.exercise.sets[0]?.unit ?? state.settings.defaultUnit, block.exercise.sets[0]?.weightMode ?? "total", state.exerciseAliases)]?.value ?? 0}
            onIncrement={value => onIncrement(incrementKey(block.exercise.name, block.exercise.sets[0]?.unit ?? state.settings.defaultUnit, block.exercise.sets[0]?.weightMode ?? "total", state.exerciseAliases),value)}
            onLater={() => {onUpdate(moveBlockLater(workout,block.exercise.id));toast.success("Moved to the end of this workout");}}
            onSubstitute={() => setSubstitutionId(block.exercise.id)}
            onChange={updateExercise}
            onCompleteSet={(seconds) => setRestUntil(Date.now() + seconds * 1000)}
            onRemove={() => removeExercise(block.exercise.id)}
          />
        ) : (
          <CardioEditor
            key={block.activity.id}
            activity={block.activity}
            isNext={nextBlock?.type === "activity" && nextBlock.activity.id === block.activity.id}
            onChange={updateCardio}
            onCompleteEffort={(seconds) => setRestUntil(Date.now() + seconds * 1000)}
            onLater={() => { onUpdate(moveBlockLater(workout, block.activity.id)); toast.success("Moved to the end of this workout"); }}
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
              <Button variant="ghost" className="text-red-300/70 hover:bg-red-400/10 hover:text-red-300"><Trash2 /> Discard</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-[#171916] text-white">
              <AlertDialogHeader><AlertDialogTitle>Discard this workout?</AlertDialogTitle><AlertDialogDescription className="text-white/45">The active session will be removed. This cannot be undone after you leave the page.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-white">Keep workout</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setRestUntil(null); onDiscard(); }}>Discard</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
          <AlertDialog open={finishOpen} onOpenChange={open => { if (!finishing) setFinishOpen(open); }}>
            <Button onClick={() => setFinishOpen(true)} className="h-12 bg-[var(--lime)] px-6 font-black text-[#11140d] hover:bg-[var(--lime)]/90"><Check /> {finishLabel}</Button>
            <AlertDialogContent className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#171916] text-white">
              <AlertDialogHeader><AlertDialogTitle>{finishLabel}</AlertDialogTitle><AlertDialogDescription className="text-white/45">{workoutCompletionSummary(workout)}{unfinishedSets + unfinishedActivities > 0 ? ` ${unfinishedSets ? `${unfinishedSets} unfinished set${unfinishedSets === 1 ? "" : "s"}` : ""}${unfinishedSets && unfinishedActivities ? " and " : ""}${unfinishedActivities ? `${unfinishedActivities} unfinished activit${unfinishedActivities === 1 ? "y" : "ies"}` : ""} will remain marked incomplete in history.` : skippedSets ? ` ${skippedSets} sets explicitly skipped.` : " Everything is complete."}</AlertDialogDescription></AlertDialogHeader>
              <div className="finish-review">
                {isEditingHistory && <Button variant="outline" onClick={() => { setFinishOpen(false); setDateOpen(true); }}>Workout date: {formatDate(workout.date)} · Change</Button>}
                <WorkoutVolume workout={workout} unit={state.settings.defaultUnit} />
                {differences.length > 0 && <details className="log-notes" open><summary>Changed from plan · {differences.length}</summary><ul className="space-y-1.5 py-2 text-sm text-white/70">{differences.map((change, index) => <li key={index} className="break-words">{change}</li>)}</ul></details>}
                {unfinishedSets + unfinishedActivities > 0 && <details className="log-notes"><summary>Review unfinished work ({unfinishedSets + unfinishedActivities})</summary><ul className="space-y-2 py-2 text-sm text-white/65">{workout.exercises.filter((exercise) => exercise.sets.some((set) => !set.completed && !set.skipped)).map((exercise) => <li key={exercise.id}>{exercise.name}: {exercise.sets.filter((set) => !set.completed && !set.skipped).length} sets incomplete</li>)}{workout.cardio.filter((activity) => !activity.completed).map((activity) => <li key={activity.id}>{activity.name}: incomplete</li>)}</ul></details>}
                <div className="finish-fields"><details className="log-notes"><summary>Session effort · optional{workout.sessionRpe ? ` · ${workout.sessionRpe}/10` : ""}</summary><Input aria-label="Session effort out of 10" inputMode="decimal" value={workout.sessionRpe} placeholder="—" onChange={(event) => onUpdate({ ...workout, sessionRpe: event.target.value })} /></details>
                <label className="field-label">Notes · optional<Textarea value={workout.notes} onChange={(event) => onUpdate({ ...workout, notes: event.target.value })} placeholder="How it felt, anything changed…" className="mt-2 min-h-20 border-white/8 bg-black/20" /></label></div>
              </div>
              {finishError && <p role="alert" className="text-sm text-red-200">{finishError}</p>}
              <AlertDialogFooter><AlertDialogCancel disabled={finishing} className="border-white/10 bg-transparent text-white">{isEditingHistory ? "Keep editing" : "Keep training"}</AlertDialogCancel><AlertDialogAction disabled={finishing} onClick={async event => { event.preventDefault(); setFinishing(true); setFinishError(""); try { await onFinish(); setRestUntil(null); setFinishOpen(false); } catch { setFinishError("Could not save. Your editable workout is retained. Retry, or keep training and export a backup from Settings."); } finally { setFinishing(false); } }} className="bg-[var(--lime)] text-[#11140d] hover:bg-[var(--lime)]/90">{finishing ? "Saving…" : finishLabel}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      {dateOpen && <WorkoutDateDialog workout={workout} open={dateOpen} onOpenChange={setDateOpen} onUpdate={onUpdate} />}
    </div>
  );
}
