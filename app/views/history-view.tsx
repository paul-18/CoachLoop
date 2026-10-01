"use client";

import { ChevronDown, ChevronUp, Copy, Download, History, MoreHorizontal, Redo2, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { DailyReview } from "./training-review";
import { RunPlan } from "./run-plan";

import { HyroxResults } from "./hyrox-ui";

import { workoutToText } from "../interchange/coach-export";

import { exportCompletedHistory } from "../interchange/history-export";

import { formatLoad, performedReps, performedWeight } from "../domain/training-metrics";

import { localDate, type TrainingState, type Unit, type WorkoutSession } from "../domain/training-types";

import { copyText, downloadText, formatDate, summarizeWorkout, orderedWorkoutBlocks, EmptyPanel } from "./shared";

import { WorkoutVolume } from "./workout-editor";

const historyUiKey = "coach-loop-history-view";
function savedHistoryUi(): { search: string; filter: "all" | "completed" | "skipped"; expanded: string | null } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(historyUiKey) ?? "null") as Record<string, unknown> | null;
    return {
      search: typeof saved?.search === "string" ? saved.search : "",
      filter: saved?.filter === "completed" || saved?.filter === "skipped" ? saved.filter : "all",
      expanded: typeof saved?.expanded === "string" ? saved.expanded : null,
    };
  } catch { return { search: "", filter: "all", expanded: null }; }
}

function HistoryWorkoutDetails({ workout, unit, history }: { workout: WorkoutSession; unit: Unit; history: WorkoutSession[] }) {
  if (workout.hyrox) return <><HyroxResults workout={workout} unit={unit} history={history} />{workout.notes && <p className="hyrox-muted">Your notes: {workout.notes}</p>}</>;
  return (
    <div className="history-details">
      {orderedWorkoutBlocks(workout).map((block) => {
        if (block.type === "exercise") {
          const exercise = block.exercise;
          const completedSets = exercise.sets.filter((set) => set.completed);
          return (
            <details key={exercise.id} className="history-exercise" open={exercise.sets.length <= 6 ? true : undefined}>
              <summary className="history-detail-heading">
                <div><h3>{exercise.name}</h3>{exercise.notes && <p>Your note: {exercise.notes}</p>}</div>
                <span className="flex shrink-0 items-center gap-2"><Badge variant="outline" className="border-white/9 text-white/48">{completedSets.length}/{exercise.sets.length} sets</Badge><ChevronDown className="history-chevron" /></span>
              </summary>
              {exercise.coachNotes && <details className="history-extra"><summary>Coach cue</summary><p>{exercise.coachNotes}</p></details>}
              {exercise.sets.length ? (
                <div className="history-set-list">
                  {exercise.sets.map((set, index) => {
                    const weight = set.completed ? performedWeight(set) : set.plannedWeight;
                    const reps = set.completed ? performedReps(set) : set.plannedReps;
                    return (
                      <div key={set.id} className={`history-set-compact ${set.completed ? "" : "incomplete"}`}>
                        <span className="history-set-index">{set.warmup ? "W" : index + 1}</span>
                        <strong>{formatLoad(set.loadType, weight, set.unit, set.weightMode)} × {reps || "?"}</strong>
                        <small>{set.completed ? set.rpe ? `RPE ${set.rpe}` : set.rir ? `${set.rir} RIR` : "" : set.skipped ? "Skipped" : "Not done"}</small>
                        {set.notes && <p className="history-set-note">{set.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="history-empty-copy">No sets recorded.</p>}
            </details>
          );
        }
        const item = block.activity;
        const duration = !item.completed || item.completedAsPlanned ? item.plannedDurationMin : item.actualDurationMin;
        const distance = !item.completed || item.completedAsPlanned ? item.plannedDistanceKm : item.actualDistanceKm;
        return (
          <section key={item.id} className={`history-exercise ${item.completed ? "" : "history-activity-incomplete"}`}>
            <div className="history-detail-heading"><div><h3>{item.name}</h3><p>{item.activityType}</p></div><Badge variant="outline" className={item.completed ? "border-sky-300/15 text-sky-200/55" : "border-amber-300/15 text-amber-200/65"}>{item.completed ? item.completedAsPlanned ? "As prescribed" : "Completed" : "Not completed"}</Badge></div>
            {item.coachNotes && <details className="history-extra"><summary>Coach cue</summary><p>{item.coachNotes}</p></details>}
            {item.activityType === "mobility" && item.mobilityMoves.length > 0 && <div className="mobility-list mt-3">{item.mobilityMoves.map((move) => <div key={move.id}><span>{move.name}</span><strong>{move.prescription}</strong></div>)}</div>}
            {(item.efforts?.length ?? 0) > 0 && <div className="history-efforts">{item.efforts!.map((effort, index) => <div key={effort.id}><span>Effort {index + 1}{effort.completed ? "" : " · not done"}</span><strong>{[effort.completed ? effort.actualDistanceM : effort.plannedDistanceM, effort.completed ? effort.actualLoad : effort.plannedLoad, effort.completed ? effort.actualDurationSec : effort.plannedDurationSec].map((value, i) => value === null ? "" : `${value} ${["m", item.effortLoadUnit ?? "lb", "sec"][i]}`).filter(Boolean).join(" · ") || "No measurement"}</strong></div>)}</div>}
            <div className="history-cardio-grid">
              {(duration !== null || !(item.efforts?.length)) && <div><small>Duration</small><strong>{duration !== null ? `${duration} min` : "Not recorded"}</strong></div>}
              {!(["mobility", "soccer", "grappling", "yoga"].includes(item.activityType)) && (distance !== null || !(item.efforts?.length)) && <div><small>Distance</small><strong>{distance !== null ? `${item.activityType === "swim" || item.activityType === "row" ? `${distance * 1000} m` : `${distance} km`}` : "Not recorded"}</strong></div>}
              {item.activityType === "ruck" && <div><small>Ruck load</small><strong>{item.ruckLoad !== null ? `${item.ruckLoad} ${item.ruckLoadUnit}` : "Not recorded"}</strong></div>}
            </div>
            {item.activityType === "run" && item.intervals && <RunPlan text={item.intervals} />}
            {(item.effort || item.intensity || item.averageHr !== null || item.elevationM !== null || item.pace || (item.intervals && item.activityType !== "run")) && <details className="history-extra"><summary>More activity details</summary><div className="history-cardio-grid">{item.effort && <div><small>Effort</small><strong>{item.effort}/10</strong></div>}{item.intensity && <div><small>Intensity</small><strong>{item.intensity}</strong></div>}{item.averageHr !== null && <div><small>Average HR</small><strong>{item.averageHr} bpm</strong></div>}{item.elevationM !== null && <div><small>Elevation</small><strong>{item.elevationM} m</strong></div>}{item.pace && <div><small>Pace</small><strong>{item.pace}</strong></div>}</div>{item.intervals && item.activityType !== "run" && <p className="history-detail-note">{item.intervals}</p>}</details>}
            {item.notes && <p className="history-detail-note"><strong>Your note:</strong> {item.notes}</p>}
          </section>
        );
      })}
      {(workout.sessionRpe || workout.notes) && (
        <section className="history-session-note">
          {workout.sessionRpe && <p><strong>Session effort</strong> RPE {workout.sessionRpe}</p>}
          {workout.notes && <p><strong>Notes</strong> {workout.notes}</p>}
        </section>
      )}
      <details className="history-extra"><summary>Workout volume</summary><WorkoutVolume workout={workout} unit={unit} /></details>
    </div>
  );
}

export function HistoryView({
  state,
  onEdit,
  onRepeat,
  onReplan,
  onDelete,
}: {
  state: TrainingState;
  onEdit: (id: string) => void;
  onRepeat: (id: string) => void;
  onReplan: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [initialUi] = useState(savedHistoryUi);
  const [search, setSearch] = useState(initialUi.search);
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "skipped">(initialUi.filter);
  const [expanded, setExpanded] = useState<string | null>(initialUi.expanded);
  useEffect(() => {
    try { sessionStorage.setItem(historyUiKey, JSON.stringify({ search, filter: statusFilter, expanded })); } catch { /* Optional view memory. */ }
  }, [search, statusFilter, expanded]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportExercise, setExportExercise] = useState("");
  const exportFilter = { from: exportFrom, to: exportTo, exercise: exportExercise };
  const exportText = exportCompletedHistory(state, exportFilter);
  const exportExercises = [...new Set(state.workouts.filter((workout) => workout.status === "completed").flatMap((workout) => workout.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).map((exercise) => exercise.name.trim())))].sort((a, b) => a.localeCompare(b));
  const workouts = [...state.workouts]
    .filter((workout) => workout.status === "completed" || workout.status === "skipped")
    .filter((workout) => statusFilter === "all" || workout.status === statusFilter)
    .filter((workout) => {
      const haystack = `${workout.name} ${workout.skipReason} ${workout.exercises.map((exercise) => exercise.name).join(" ")} ${workout.cardio.map((item) => item.name).join(" ")}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? b.skippedAt ?? "").localeCompare(a.completedAt ?? a.skippedAt ?? ""));

  return (
    <div className="page-stack">
      <section className="topline"><h1>History</h1><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="History options"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="border-white/10 bg-[#20231e] text-white"><DropdownMenuItem disabled={!state.workouts.some((workout) => workout.status === "completed")} onSelect={() => setExportOpen(true)}><Download /> Export history</DropdownMenuItem></DropdownMenuContent></DropdownMenu></section>
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#151713] text-white sm:max-w-lg">
          <DialogHeader><DialogTitle>Completed training history</DialogTitle><DialogDescription className="text-white/48">Every completed set and activity, grouped by date. No skipped plans or notes. This text is for reading and saving; a JSON backup in Settings is needed to restore app data.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3"><label className="field-label">From<Input type="date" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} className="mt-1 border-white/10 bg-black/20" /></label><label className="field-label">To<Input type="date" value={exportTo} onChange={(event) => setExportTo(event.target.value)} className="mt-1 border-white/10 bg-black/20" /></label><label className="field-label">Exercise<NativeSelect value={exportExercise} onChange={(event) => setExportExercise(event.target.value)} className="mt-1 w-full border-white/10 bg-black/20"><NativeSelectOption value="">All exercises</NativeSelectOption>{exportExercises.map((name) => <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>)}</NativeSelect></label></div>
          <pre className="max-h-[42dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/75">{exportText}</pre>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={async () => { if (await copyText(exportText)) toast.success("History copied"); else toast.error("Could not copy. Select the history text and copy it manually."); }}><Copy /> Copy text</Button><Button className="bg-[var(--lime)] font-bold text-[#11140d] hover:bg-[var(--lime)]/90" onClick={() => downloadText(exportText, `coach-loop-history-${localDate()}.txt`, "text/plain;charset=utf-8")}><Download /> Download .txt</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workouts or exercises…" className="h-12 border-white/9 bg-white/[0.025] px-4" />
      <div className="history-filters" aria-label="Filter history">{(["all", "completed", "skipped"] as const).map((value) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{value === "all" ? "All sessions" : value === "completed" ? "Completed" : "Skipped"}</button>)}<span className="text-xs text-white/45">{workouts.length} sessions</span></div>
      {workouts.length ? (
        <div className="space-y-3">
          {workouts.map((workout) => {
            const isOpen = expanded === workout.id;
            return (
              <article key={workout.id} className="history-card">
                <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : workout.id)} className="flex w-full items-center justify-between gap-4 text-left">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold tracking-[-0.02em] text-white">{workout.name}</p>
                      {workout.status === "skipped" && <Badge variant="outline" className="border-amber-300/20 text-amber-200/70">Skipped</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-white/42">{formatDate(workout.date)} · {workout.status === "skipped" ? workout.skipReason || "No reason recorded" : summarizeWorkout(workout)}</p>
                  </div>
                  {isOpen ? <ChevronUp className="size-4 text-white/35" /> : <ChevronDown className="size-4 text-white/35" />}
                </button>
                {isOpen && (
                  <div className="mt-5 border-t border-white/7 pt-5">
                    {workout.status === "skipped" ? (
                      <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.035] p-4 text-sm leading-6 text-white/58">
                        <strong className="text-amber-200/80">Reason recorded</strong>
                        <p className="mt-1">{workout.skipReason || "No reason recorded."}</p>
                      </div>
                    ) : <HistoryWorkoutDetails workout={workout} unit={state.settings.defaultUnit} history={state.workouts} />}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {workout.status === "skipped" ? (
                        <Button size="sm" variant="outline" onClick={() => onReplan(workout.id)} className="border-white/10 bg-transparent text-white"><Redo2 /> Replan</Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => onEdit(workout.id)} className="border-white/10 bg-transparent text-white"><SquarePen /> Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => onRepeat(workout.id)} className="border-white/10 bg-transparent text-white"><Redo2 /> Repeat</Button>
                        </>
                      )}
                      <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`More options for ${workout.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="border-white/10 bg-[#20231e] text-white">{workout.status === "completed" && <DropdownMenuItem onSelect={async () => { if (await copyText(workoutToText(workout))) toast.success("Workout copied"); else toast.error("Could not copy this workout."); }}><Copy /> Copy workout</DropdownMenuItem>}<DropdownMenuItem onSelect={() => setDeleteId(workout.id)} className="text-red-300"><Trash2 /> Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                      <AlertDialog open={deleteId === workout.id} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                        <AlertDialogContent className="border-white/10 bg-[#171916] text-white"><AlertDialogHeader><AlertDialogTitle>Delete this session?</AlertDialogTitle><AlertDialogDescription className="text-white/45">It will be removed from history and future coach exports.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-white">Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onDelete(workout.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyPanel icon={History} title={search ? "No matching sessions" : "Your history starts here"} text={search ? "Try a different exercise or workout name." : "Complete a workout and it will become available for search, review, editing, and ChatGPT exports."} />
      )}
      <DailyReview state={state} onOpen={id=>{setSearch("");setStatusFilter("all");setExpanded(id);}} />
    </div>
  );
}
