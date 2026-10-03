/* External persistence, timers, and controlled-dialog hydration intentionally update state in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useLocalDay } from "../pwa/use-local-day";
import { QuickLogButtons } from "./quick-log-buttons";
import { APP_RELEASE } from "../app-release";

import { Activity, Bot, Check, ChevronRight, CirclePlus, Clipboard, ClipboardCheck, CloudOff, Copy, Dumbbell, Import, Play, Redo2, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { buildCoachPrompt } from "../interchange/coach-export";

import { type SyncStatus } from "../persistence/cloud-sync";
import { exampleFitlog, parseFitlog } from "../interchange/fitlog";

import { formatLoad } from "../domain/training-metrics";
import { pendingRetests } from "../domain/benchmarks";
import { trainingWeekStreak } from "../domain/training-streak";

import { localDate, currentCoachCheckIn, type CardioEntry, type CoachOptions, type TrainingState, type WorkoutSession } from "../domain/training-types";

import { copyText, formatDate, orderedWorkoutBlocks, syncCopy } from "./shared";

import { CoachCue } from "./workout-editor";
import { RunPlan } from "./run-plan";




export function ImportWorkoutDialog({
  open,
  onOpenChange,
  text,
  onTextChange,
  state,
  onStart,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onTextChange: (value: string) => void;
  state: TrainingState;
  onStart: (workout: WorkoutSession) => void;
  onSave: (workout: WorkoutSession) => void;
}) {
  const [preview, setPreview] = useState<WorkoutSession | null>(null);
  const [error, setError] = useState("");
  const [warningsReviewed, setWarningsReviewed] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError("");
      setWarningsReviewed(false);
    }
  }, [open]);
  useEffect(() => { setPreview(null); setError(""); setWarningsReviewed(false); }, [text]);

  const review = () => {
    setWarningsReviewed(false);
    try {
      setPreview(
        parseFitlog(text, state.settings.defaultUnit, state.exerciseAliases),
      );
      setError("");
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "This workout could not be read.");
    }
  };
  const duplicate = preview?.importFingerprint
    ? state.workouts.find((workout) => workout.importFingerprint === preview.importFingerprint)
    : undefined;
  const needsWarningReview = Boolean(preview?.importWarnings?.length) && !warningsReviewed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto border-white/10 bg-[#151713] p-0 text-white sm:max-w-2xl">
        <DialogHeader className="border-b border-white/8 p-6 pb-5 text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.035em]">
            Import a ChatGPT workout
          </DialogTitle>
          <DialogDescription className="leading-6 text-white/48">
            Paste the complete reply. Coach Loop reads only the validated FITLOG block.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-6">
          {!preview ? (
            <>
              <Textarea
                value={text}
                onChange={(event) => onTextChange(event.target.value)}
                aria-label="FITLOG workout text" placeholder="Paste ChatGPT’s reply here…"
                className="min-h-56 resize-y border-white/10 bg-black/20 font-mono text-sm leading-6 text-white placeholder:text-white/25"
              />
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/8 p-4 text-sm leading-6 text-red-100">
                  {error} Use the Coach screen first so ChatGPT receives the exact format.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onTextChange(exampleFitlog);
                  setError("");
                }}
                className="text-sm font-semibold text-[var(--lime)] hover:underline"
              >
                Load a safe example
              </button>
            </>
          ) : (
          <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--lime)]/20 bg-[var(--lime)]/[0.055] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--lime)]/70">
                      {preview.importWarnings?.length ? "Needs review" : "Ready to import"}
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.035em]">{preview.name}</h3>
                    <p className="mt-1 text-sm text-white/45">{formatDate(preview.date)}</p>
                  </div>
                  <Badge className={preview.importWarnings?.length ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-[var(--lime)]/20 bg-[var(--lime)]/10 text-[var(--lime)]"}>
                    {preview.importWarnings?.length ? "Review warnings" : "Valid FITLOG"}
                  </Badge>
                </div>
              </div>
              {preview.importWarnings?.length ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100/80">
                  <strong>Review before importing</strong>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {preview.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                  <label className="mt-3 flex items-center gap-3 text-sm"><Checkbox checked={warningsReviewed} onCheckedChange={(checked) => setWarningsReviewed(checked === true)} />I reviewed these warnings</label>
                </div>
              ) : null}
              {duplicate ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100/80">
                  <strong>This exact FITLOG was already imported.</strong> It is in your {duplicate.status === "completed" ? "history" : duplicate.status === "planned" ? "saved plans" : "active workout"} as “{duplicate.name}” ({formatDate(duplicate.date)}). You can still import it again if that is intentional.
                </div>
              ) : null}
              {orderedWorkoutBlocks(preview).map((block) => block.type === "exercise" ? (
                <div key={block.exercise.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <p className="font-bold">{block.exercise.name}</p>
                  <p className="mt-1 text-sm text-white/45">
                    {block.exercise.sets.length} sets · {block.exercise.restSec}s rest
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {block.exercise.sets.map((set) => (
                      <span key={set.id} className="rounded-lg bg-black/25 px-2.5 py-1.5 text-xs text-white/65">
                        {formatLoad(set.loadType, set.plannedWeight, set.unit, set.weightMode)} × {set.plannedReps}{set.warmup ? " · Warm-up" : ""}{set.plannedRpe ? ` · target RPE ${set.plannedRpe}` : set.plannedRir ? ` · target RIR ${set.plannedRir}` : ""}
                      </span>
                    ))}
                  </div>
                  {block.exercise.coachNotes && <p className="coach-cue mt-3"><strong>Coach cue</strong>{block.exercise.coachNotes}</p>}
                </div>
              ) : (
                <div key={block.activity.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><p className="min-w-0 font-bold">{block.activity.name}</p><label className="text-xs text-white/60">Category <NativeSelect aria-label={`Category for ${block.activity.name}`} value={block.activity.activityType} onChange={(event) => setPreview((current) => current ? { ...current, cardio: current.cardio.map((item) => item.id === block.activity.id ? { ...item, activityType: event.target.value as CardioEntry["activityType"], loggingStyle: undefined } : item) } : current)} className="ml-2 inline-block h-9 w-auto max-w-36 border-white/15 bg-[#20231e] text-white">{(["run", "ruck", "bike", "swim", "water_polo", "row", "walk", "hike", "mobility", "circuit", "force", "soccer", "grappling", "yoga", "other"] as const).map((type) => <NativeSelectOption key={type} value={type}>{type.replace("_", " ")}</NativeSelectOption>)}</NativeSelect></label></div>
                  <p className="mt-1 text-sm text-white/45">
                    {block.activity.plannedDurationMin ? `${block.activity.plannedDurationMin} min` : "Duration open"}
                    {block.activity.plannedDistanceKm ? ` · ${block.activity.plannedDistanceKm} km` : ""}
                    {block.activity.intensity ? ` · ${block.activity.intensity}` : ""}
                  </p>
                  {block.activity.intervals && <RunPlan text={block.activity.intervals} />}
                  {!!block.activity.efforts?.length && <ol className="mt-3 space-y-2 text-sm text-white/75">{block.activity.efforts.map((e, index) => <li key={e.id}>{index + 1}. {[e.plannedDistanceM !== null ? `${e.plannedDistanceM} m` : "", e.plannedDurationSec !== null ? `${e.plannedDurationSec} sec` : "", e.plannedLoad !== null ? `${e.plannedLoad} ${block.activity.effortLoadUnit ?? "lb"}` : ""].filter(Boolean).join(" · ")}</li>)}</ol>}
                  {block.activity.mobilityMoves.length > 0 && <div className="mobility-list mt-3">{block.activity.mobilityMoves.map((move) => <div key={move.id}><span>{move.name}</span><strong>{move.prescription}</strong></div>)}</div>}
                  {block.activity.coachNotes && <p className="coach-cue mt-3"><strong>Coach cue</strong>{block.activity.coachNotes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-white/8 p-5">
          {preview ? (
            <>
              <Button variant="ghost" onClick={() => setPreview(null)} className="text-white/65 hover:bg-white/6 hover:text-white">
                Back to text
              </Button>
              <Button
                onClick={() => {
                  onSave(preview);
                  onOpenChange(false);
                  onTextChange("");
                }}
                variant="outline"
                disabled={needsWarningReview}
                className="border-white/10 bg-white/[0.025] font-bold text-white hover:bg-white/8"
              >
                <Save /> Save for later
              </Button>
              <Button
                onClick={() => {
                  onStart(preview);
                  onOpenChange(false);
                  onTextChange("");
                }}
                disabled={Boolean(state.activeWorkoutId) || needsWarningReview}
                className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"
              >
                <Play /> Start workout
              </Button>
            </>
          ) : (
            <Button
              onClick={review}
              disabled={!text.trim()}
              className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"
            >
              <ClipboardCheck /> Review import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SkipWorkoutDialog({
  workout,
  open,
  onOpenChange,
  onSkip,
}: {
  workout: WorkoutSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip: (id: string, reason: string, importReplacement: boolean) => void;
}) {
  const [reason, setReason] = useState("Time / work / study");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("Time / work / study");
    setDetails("");
  }, [open]);

  if (!workout) return null;
  const completeReason = details.trim() ? `${reason}: ${details.trim()}` : reason;
  const finish = (replacement: boolean) => {
    onSkip(workout.id, completeReason, replacement);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#151713] text-white sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.035em]">Skip {workout.name}?</DialogTitle>
          <DialogDescription className="leading-6 text-white/48">
            It will stay in your timeline with the reason, but it will not count as completed training.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label className="field-label">
            Main reason
            <NativeSelect value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full border-white/10 bg-black/20 text-white">
              <NativeSelectOption value="Time / work / study">Time / work / study</NativeSelectOption>
              <NativeSelectOption value="Recovery / fatigue">Recovery / fatigue</NativeSelectOption>
              <NativeSelectOption value="Soreness / pain">Soreness / pain</NativeSelectOption>
              <NativeSelectOption value="Schedule changed">Schedule changed</NativeSelectOption>
              <NativeSelectOption value="Weather / access">Weather / access</NativeSelectOption>
              <NativeSelectOption value="Other">Other</NativeSelectOption>
            </NativeSelect>
          </label>
          <label className="field-label">
            Optional detail
            <Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What changed?" className="mt-2 min-h-20 border-white/10 bg-black/20" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)} className="border-white/10 bg-white/[0.025] text-white hover:bg-white/8">
            <X /> Mark skipped
          </Button>
          <Button onClick={() => finish(true)} className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90">
            <Import /> Skip & import replacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const initialCoachOptions = (): CoachOptions => ({
  mode: "continue",
  days: 7,
  since: null,
  sinceAt: null,
  energy: "",
  sleep: "",
  soreness: "",
  timeAvailable: "75 minutes",
  equipment: "Full gym",
  restrictions: "",
  schedule: "",
  request: "",
});

export function CoachDialog({
  open,
  onOpenChange,
  state,
  onRemember,
  onMarkSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TrainingState;
  onRemember: (checkIn: TrainingState["settings"]["coachCheckIn"]) => void;
  onMarkSent: () => void;
}) {
  const [options, setOptions] = useState<CoachOptions>(initialCoachOptions);
  const wasOpen = useRef(false);

  const prompt = useMemo(() => buildCoachPrompt(state, options), [state, options]);

  useEffect(() => {
    if (!open) { wasOpen.current = false; return; }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const saved = state.settings.coachCheckIn;
    const checkIn = currentCoachCheckIn(saved);
    setOptions({ ...initialCoachOptions(), mode: state.settings.lastCoachBriefAt ? "continue" : "new", energy: checkIn.energy, sleep: checkIn.sleep, soreness: checkIn.soreness, restrictions: checkIn.restrictions, schedule: checkIn.schedule });
  }, [open, state.settings.coachCheckIn, state.settings.lastCoachBriefAt]);

  const field = <K extends keyof CoachOptions>(key: K, value: CoachOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#151713] p-0 text-white sm:max-w-3xl">
        <DialogHeader className="border-b border-white/8 p-6 pb-5 text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.035em]">Build your coach brief</DialogTitle>
          <DialogDescription className="leading-6 text-white/48">
            Choose whether ChatGPT already knows your background. Your recorded history and FITLOG instructions are added automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-6 sm:grid-cols-2">
          <div className="coach-mode-picker sm:col-span-2" aria-label="Chat context">
            <button type="button" aria-pressed={options.mode === "continue"} className={options.mode === "continue" ? "active" : ""} onClick={() => field("mode", "continue")}>
              <Redo2 />
              <span><strong>Continue existing chat</strong><small>Recent log and today’s readiness</small></span>
            </button>
            <button type="button" aria-pressed={options.mode === "new"} className={options.mode === "new" ? "active" : ""} onClick={() => setOptions((current) => ({ ...current, mode: "new", days: current.days < 14 ? 14 : current.days }))}>
              <CirclePlus />
              <span><strong>Start a new chat</strong><small>Full athlete profile plus recent log</small></span>
            </button>
          </div>
          <label className="field-label">
            Training history
            <NativeSelect
              value={options.days}
              onChange={(event) => setOptions((current) => ({ ...current, days: Number(event.target.value) as CoachOptions["days"], since: null, sinceAt: null }))}
              className="mt-2 w-full border-white/10 bg-black/20 text-white"
            >
              <NativeSelectOption value="0">Latest completed session</NativeSelectOption>
              <NativeSelectOption value="1">Last 1 day</NativeSelectOption>
              <NativeSelectOption value="7">Last 7 days</NativeSelectOption>
              <NativeSelectOption value="14">Last 14 days</NativeSelectOption>
              <NativeSelectOption value="30">Last 30 days</NativeSelectOption>
            </NativeSelect>
            {state.settings.lastCoachBriefAt && <button type="button" onClick={() => setOptions((current) => ({ ...current, since: state.settings.lastCoachBriefAt ? localDate(new Date(state.settings.lastCoachBriefAt)) : null, sinceAt: state.settings.lastCoachBriefAt }))} className={options.since ? "mt-2 text-xs font-bold text-[var(--lime)]" : "mt-2 text-xs font-semibold text-white/42 hover:text-white/70"}>Use only sessions since your last brief ({formatDate(localDate(new Date(state.settings.lastCoachBriefAt)))})</button>}
          </label>
          <label className="field-label">
            Energy (1–10)
            <Input
              inputMode="decimal"
              value={options.energy}
              onChange={(event) => field("energy", event.target.value)}
              className="mt-2 border-white/10 bg-black/20"
            />
          </label>
          <label className="field-label">
            Soreness
            <Input
              value={options.soreness}
              onChange={(event) => field("soreness", event.target.value)}
              placeholder="Low, legs 5/10…"
              className="mt-2 border-white/10 bg-black/20"
            />
          </label>
          <label className="field-label">
            Sleep last night
            <Input
              value={options.sleep}
              onChange={(event) => field("sleep", event.target.value)}
              placeholder="6.5 hours, interrupted…"
              className="mt-2 border-white/10 bg-black/20"
            />
          </label>
          <label className="field-label">
            Restrictions
            <Input
              value={options.restrictions}
              onChange={(event) => field("restrictions", event.target.value)}
              placeholder="No running, shoulder sore…"
              className="mt-2 border-white/10 bg-black/20"
            />
          </label>
          <label className="field-label min-w-0 sm:col-span-2">
            Mandatory PT / next 48 hours
            <Input
              value={options.schedule}
              onChange={(event) => field("schedule", event.target.value)}
              placeholder="Circuit this morning; 50 lb ruck tomorrow…"
              className="mt-2 min-w-0 max-w-full border-white/10 bg-black/20"
            />
          </label>
          <details className="sm:col-span-2 rounded-xl border border-white/8 bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-bold text-white/70">Optional request details</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="field-label">Time available<Input value={options.timeAvailable} onChange={(event) => field("timeAvailable", event.target.value)} placeholder="60 minutes" className="mt-2 border-white/10 bg-black/20" /></label>
              <label className="field-label">Equipment<Input value={options.equipment} onChange={(event) => field("equipment", event.target.value)} placeholder="Full gym" className="mt-2 border-white/10 bg-black/20" /></label>
              <label className="field-label sm:col-span-2">What should ChatGPT do?<Textarea value={options.request} onChange={(event) => field("request", event.target.value)} placeholder="Recommend my next workout based on my recent training, recovery, and goals." className="mt-2 min-h-20 border-white/10 bg-black/20" /></label>
            </div>
          </details>
          <details className="sm:col-span-2 rounded-xl border border-white/8 bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-bold text-white/70">Preview copied text</summary>
            <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-white/45">{prompt}</pre>
          </details>
        </div>
        <DialogFooter className="border-t border-white/8 p-5">
          <Button
            onClick={async () => {
              onRemember({ date: localDate(), energy: options.energy, sleep: options.sleep, soreness: options.soreness, restrictions: options.restrictions, schedule: options.schedule });
              if (await copyText(prompt)) {
                toast.success("Coach brief copied — paste it into ChatGPT");
                onOpenChange(false);
              } else {
                toast.error("Could not copy the brief. Use Preview copied text to select and copy it.");
              }
            }}
            className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"
          >
            <Copy /> {options.mode === "new" ? "Copy full context" : "Copy recent update"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { onRemember({ date: localDate(), energy: options.energy, sleep: options.sleep, soreness: options.soreness, restrictions: options.restrictions, schedule: options.schedule }); onMarkSent(); toast.success("Marked as sent — the next brief can use only newer sessions"); }}
            className="border-white/10 bg-transparent text-white hover:bg-white/8"
          >
            <Check /> Mark sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SavedPlanPreview({ workout, active, onClose, onStart, onReschedule }: { workout: WorkoutSession | undefined; active: boolean; onClose: () => void; onStart: (id: string) => void; onReschedule: (id: string, date: string) => void }) {
  const [date, setDate] = useState(workout?.date ?? "");
  useEffect(() => { setDate(workout?.date ?? ""); }, [workout?.id, workout?.date]);
  return <Dialog open={Boolean(workout)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className="plan-preview-dialog border-white/10 bg-[#151713] text-white">
    <DialogHeader><DialogTitle>{workout?.name}</DialogTitle><DialogDescription className="text-white/60">Saved plan · {workout ? formatDate(workout.date) : ""}. Previewing does not start or log anything.</DialogDescription></DialogHeader>
    {workout && <div className="flex min-w-0 flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs font-bold text-white/60">Planned date<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 min-w-0 w-full border-white/10 bg-black/20 text-base" /></label>{date !== workout.date && <Button type="button" variant="outline" disabled={!date} onClick={() => onReschedule(workout.id, date)} className="border-white/10 bg-transparent text-white">Save date</Button>}</div>}
    <div className="plan-preview-body">{workout && orderedWorkoutBlocks(workout).map((block) => block.type === "exercise" ? <section key={block.exercise.id} className="plan-preview-block">
      <h3>{block.exercise.name}</h3><p className="text-sm text-white/60">{block.exercise.sets.length} sets · {block.exercise.restSec}s rest</p>
      <ol>{block.exercise.sets.map((set, index) => <li key={set.id}><span>{set.warmup ? "Warm-up" : `Set ${index + 1}`}</span><strong>{formatLoad(set.loadType, set.plannedWeight, set.unit, set.weightMode)} × {set.plannedReps || "—"}{set.plannedRpe ? ` · RPE ${set.plannedRpe}` : set.plannedRir ? ` · RIR ${set.plannedRir}` : ""}</strong></li>)}</ol>
      {block.exercise.coachNotes && <CoachCue text={block.exercise.coachNotes} />}{block.exercise.notes && <p>{block.exercise.notes}</p>}
    </section> : <section key={block.activity.id} className="plan-preview-block"><h3>{block.activity.name}</h3><p className="text-sm text-white/65">{[block.activity.activityType, block.activity.plannedDurationMin !== null ? `${block.activity.plannedDurationMin} min` : "", block.activity.plannedDistanceKm !== null ? `${block.activity.plannedDistanceKm} km` : "", block.activity.ruckLoad !== null ? `${block.activity.ruckLoad} ${block.activity.ruckLoadUnit} pack` : "", block.activity.efforts?.length ? `${block.activity.efforts.length} efforts` : "", block.activity.intensity].filter(Boolean).join(" · ")}</p>
      {block.activity.intervals && (block.activity.activityType === "run" ? <RunPlan text={block.activity.intervals} /> : <p>{block.activity.intervals}</p>)}{block.activity.mobilityMoves.map((move) => <p key={move.id}>{move.name} · {move.prescription}</p>)}{block.activity.coachNotes && <CoachCue text={block.activity.coachNotes} />}{block.activity.notes && <p>{block.activity.notes}</p>}
    </section>)}{workout?.notes && <p className="text-sm text-white/65">{workout.notes}</p>}</div>
    <div className="plan-preview-actions"><Button variant="outline" onClick={onClose}>Close</Button><Button disabled={active} className="bg-[var(--lime)] text-[#11140d]" onClick={() => { if (workout) { onClose(); onStart(workout.id); } }}><Play /> Start workout</Button></div>{active && <p className="text-sm text-white/60">Finish your current workout before starting another.</p>}
  </DialogContent></Dialog>;
}

export function TodayView({
  state,
  onStartBlank,
  onQuickCardio,
  onHyrox,
  onImport,
  onCoach,
  onResume,
  onStartPlan,
  onReschedulePlan,
  onSkipPlan,
  onHistory,
  onBodyweightLog,
  onTrainingCalendar,
  syncStatus,
}: {
  state: TrainingState;
  onHyrox: () => void;
  onStartBlank: () => void;
  onQuickCardio: (type: CardioEntry["activityType"]) => void;
  onImport: () => void;
  onCoach: () => void;
  onResume: () => void;
  onStartPlan: (id: string) => void;
  onReschedulePlan: (id: string, date: string) => void;
  onSkipPlan: (id: string) => void;
  onHistory: () => void;
  onBodyweightLog: () => void;
  onTrainingCalendar: () => void;
  syncStatus: SyncStatus;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [dismissedNudge, setDismissedNudge] = useState<string | null>(() => typeof window === "undefined" ? null : safeNudge());
  const active = state.workouts.find((workout) => workout.id === state.activeWorkoutId);
  const nextActiveBlock = active && orderedWorkoutBlocks(active).find((block) => block.type === "exercise"
    ? block.exercise.sets.some((set) => !set.completed && !set.skipped)
    : !block.activity.completed);
  const nextActiveLabel = nextActiveBlock?.type === "exercise" ? nextActiveBlock.exercise.name : nextActiveBlock?.activity.name;
  const planned = [...state.workouts]
    .filter((workout) => workout.status === "planned")
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const today = useLocalDay();
  const todayEntries = state.workouts.filter((workout) => workout.date === today && workout.status === "completed");
  const streak = trainingWeekStreak(state, today);
  const upcomingEvents = state.scheduleContext.events.filter((event) => !event.deletedAt && event.date >= today && event.label.trim()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const upcomingRetests = pendingRetests(state.benchmarks ?? [], today).slice(0, 1);
  const visibleEvents = upcomingEvents.slice(0, upcomingRetests.length ? 2 : 3);
  const latestWeightDate = state.bodyweightEntries.filter((entry) => entry.date <= today).map((entry) => entry.date).sort().at(-1);
  const weightAge = latestWeightDate ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${latestWeightDate}T12:00:00Z`)) / 86400000) : Infinity;
  const nudgeKey = `${today}:${latestWeightDate ?? "none"}`;

  return (
    <div className="page-stack today-stack">
      <SavedPlanPreview workout={planned.find((item) => item.id === previewId)} active={Boolean(active)} onClose={() => setPreviewId(null)} onStart={onStartPlan} onReschedule={onReschedulePlan} />
      <section className="topline">
        <div>
          <h1 className="today-date">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</h1>
        </div>
        <span className="text-xs text-white/50" aria-label={`Published app version ${APP_RELEASE}`}>{APP_RELEASE}</span>
        {(syncStatus === "offline" || syncStatus === "error") && <span className="data-pill sync-exception"><CloudOff />{syncCopy[syncStatus]}</span>}
      </section>

      {!active && (visibleEvents.length > 0 || upcomingRetests.length > 0) && <div className="today-context-list">{visibleEvents.map((event) => { const days = Math.round((Date.parse(`${event.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000); return <p key={event.id} className="today-context-line">{days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} until`} · {event.label}</p>; })}{upcomingRetests.map(({ item, due }) => { const days = Math.round((Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000); return <p key={item.id} className="today-context-line">{days <= 0 ? "Re-test due" : `${days} day${days === 1 ? "" : "s"} until re-test`} · {item.name}</p>; })}</div>}
      {!active && <button type="button" className="today-context-line today-streak-link" onClick={onTrainingCalendar} title="A week counts when you complete training on five different days, Monday through Sunday. Rest days do not break it. Open training calendar."><span className="font-semibold text-[var(--lime)]">{streak.weeks > 0 ? `${streak.weeks}-week training streak` : "Build a training streak"}</span> · {streak.daysThisWeek}/{streak.targetDays} days this week <ChevronRight aria-hidden="true" size={15} /></button>}
      {!active && weightAge >= 7 && dismissedNudge !== nudgeKey && <div className="today-bodyweight-nudge"><button type="button" onClick={onBodyweightLog}>Haven’t logged bodyweight in a while — log now?</button><button type="button" aria-label="Dismiss bodyweight reminder" onClick={() => { try { localStorage.setItem("coach-loop-bodyweight-nudge", nudgeKey); } catch { /* Optional preference. */ } setDismissedNudge(nudgeKey); }}><X size={16} /></button></div>}

      {active && (
        <button type="button" onClick={onResume} className="active-workout-card group">
          <div className="flex items-start gap-4">
            <span className="pulse-dot mt-1.5" />
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--lime)]/70">Workout in progress</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-white">{active.name}</h2>
              <p className="mt-2 text-xs font-medium text-white/55">{nextActiveLabel ? `Next: ${nextActiveLabel}` : "All logged items complete"}</p>
            </div>
          </div>
          <span className="rounded-xl bg-[var(--lime)] px-4 py-2 text-sm font-black text-[#11140d] transition group-hover:scale-[1.02]">Resume</span>
        </button>
      )}

      {!active && planned.length > 0 && (
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Saved for later</p>
              <h2>Planned workouts</h2>
            </div>
            <Badge variant="outline" className="border-white/10 text-white/45">{planned.length}</Badge>
          </div>
          <div className="space-y-3">
            {planned.map((workout) => {
              const exerciseSets = workout.exercises.reduce((sum, item) => sum + item.sets.length, 0);
              const timing = workout.date < localDate() ? "Overdue" : workout.date === localDate() ? "Today" : formatDate(workout.date);
              return (
                <article key={workout.id} className="plan-card">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-extrabold tracking-[-0.02em] text-white">{workout.name}</h3>
                      <Badge className="border-sky-300/15 bg-sky-300/8 text-sky-200/75">{timing}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/42">{workout.exercises.length + workout.cardio.length} blocks · {exerciseSets} sets</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => setPreviewId(workout.id)} className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90">Preview</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Skip ${workout.name}`} onClick={() => onSkipPlan(workout.id)} className="text-white/45 hover:bg-white/7 hover:text-white"><X /></Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {active ? <div className="active-secondary-actions"><button type="button" onClick={onImport}>Import a plan</button><button type="button" onClick={onCoach}>Ask ChatGPT</button></div> : <section className="action-grid">
        <button type="button" className="primary-action" onClick={onImport}>
          <span className="action-icon"><Clipboard /></span>
          <span>
            <strong>Import workout</strong>
            <small>Paste ChatGPT’s FITLOG plan</small>
          </span>
          <CirclePlus className="ml-auto size-5 opacity-50" />
        </button>
        <button type="button" className="secondary-action" onClick={onCoach}>
          <span className="action-icon"><Bot /></span>
          <span>
            <strong>Ask ChatGPT</strong>
            <small>Copy recent training and goals</small>
          </span>
        </button>
        <button type="button" className="secondary-action" onClick={onStartBlank}>
          <span className="action-icon"><Dumbbell /></span>
          <span>
            <strong>Blank workout</strong>
            <small>Build as you train</small>
          </span>
        </button>
      </section>}

      {!active && <section>
        <div className="section-heading">
          <div>
            <h2>Quick log</h2>
          </div>
        </div>
        <QuickLogButtons settings={state.settings} disabled={Boolean(active)} onChoose={onQuickCardio} />
      </section>}

      {!active && <button type="button" className="hyrox-entry" onClick={onHyrox}><Activity /><span><strong>HYROX simulation</strong><small>Choose a division · run + station timer</small></span><ChevronRight /></button>}

      {!active && todayEntries.length > 0 && <button type="button" className="today-logged" onClick={onHistory}><span className="truncate">Logged today: {todayEntries.map((workout) => workout.name).join(" · ")}</span><ChevronRight aria-hidden="true" /></button>}

    </div>
  );
}

function safeNudge() { try { return localStorage.getItem("coach-loop-bodyweight-nudge"); } catch { return null; } }
