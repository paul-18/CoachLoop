"use client";

import { ChevronDown, ChevronUp, Cloud, CloudOff, DatabaseBackup, Download, FileJson, Import, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { Textarea } from "@/components/ui/textarea";

import { MuscleMappingSettings } from "./muscle-mapping-settings";
import { BenchmarkSettings } from "./benchmark-settings";
import { DEFAULT_COACH_PROFILE } from "../interchange/coach-export";

import { mergeRestoredState, type SyncStatus } from "../persistence/cloud-sync";

import { toCsv } from "../interchange/csv-export";

import { listSnapshots, loadSnapshot, type TrainingSnapshot } from "../persistence/training-storage";
import { localDate, uid, type FieldConflict, type TrainingState, type Unit } from "../domain/training-types";

import { DecimalInput, downloadText, syncCopy } from "./shared";
import { prepareLoadedState } from "../persistence/migrations";

function ConflictReviewItem({ conflict, onResolve }: { conflict: FieldConflict; onResolve: (id: string, value: unknown) => Promise<void> }) {
  const [fresh, setFresh] = useState("");
  const format = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value);
  return <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.035] p-3"><p className="break-words font-semibold">{conflict.fieldPath}</p><div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><div className="break-words"><span className="text-white/45">Saved in cloud</span><p>{format(conflict.remoteValue)}</p></div><div className="break-words"><span className="text-white/45">Other edit</span><p>{format(conflict.raisingDeviceValue)}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void onResolve(conflict.id, conflict.remoteValue)}>Keep cloud</Button><Button type="button" size="sm" variant="outline" onClick={() => void onResolve(conflict.id, conflict.raisingDeviceValue)}>Use other edit</Button>{typeof conflict.remoteValue === "string" && typeof conflict.raisingDeviceValue === "string" && <Button type="button" size="sm" variant="outline" onClick={() => void onResolve(conflict.id, `${conflict.remoteValue}\n${conflict.raisingDeviceValue}`)}>Keep both</Button>}</div><div className="mt-2 flex gap-2"><Input aria-label={`Fresh value for ${conflict.fieldPath}`} value={fresh} onChange={(event) => setFresh(event.target.value)} placeholder="Or enter a new value" className="min-w-0 border-white/10 bg-black/20" /><Button type="button" size="sm" disabled={!fresh.trim()} onClick={() => { let value: unknown = fresh; if (typeof conflict.remoteValue !== "string") { try { value = JSON.parse(fresh); } catch { toast.error("Enter a valid value for this field"); return; } } void onResolve(conflict.id, value); }}>Use new</Button></div></div>;
}

export function SettingsView({ state, canonicalState, setState, onResolveConflict, onRestoreBackup, onReset, syncStatus, syncFailure, onRetrySync, lastSyncedAt, offlineReady, updateReady }: { state: TrainingState; canonicalState: TrainingState; setState: React.Dispatch<React.SetStateAction<TrainingState>>; onResolveConflict: (id: string, value: unknown) => Promise<void>; onRestoreBackup: (backup: TrainingState) => Promise<void>; onReset: () => Promise<void>; syncStatus: SyncStatus; syncFailure: string | null; onRetrySync: () => void; lastSyncedAt: string | null; offlineReady: "checking" | "ready" | "failed"; updateReady: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<TrainingSnapshot[]>([]);
  const [installed, setInstalled] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<TrainingState | null>(null);
  useEffect(() => { void listSnapshots().then(setSnapshots).catch(() => undefined); }, []);
  useEffect(() => { setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true); }, []);
  const [newGoal, setNewGoal] = useState("");
  const [scheduleDate, setScheduleDate] = useState(localDate());
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [phaseStart, setPhaseStart] = useState(localDate());
  const [phaseEnd, setPhaseEnd] = useState(localDate());
  const [phaseLabel, setPhaseLabel] = useState("");
  const updateSettings = (update: (settings: TrainingState["settings"]) => TrainingState["settings"]) =>
    setState((current) => ({ ...current, settings: update(current.settings), settingsUpdatedAt: new Date().toISOString() }));
  const updateGoals = (update: (goals: string[]) => string[]) =>
    setState((current) => ({ ...current, goals: update(current.goals), goalsUpdatedAt: new Date().toISOString() }));
  const updateCoachProfile = (coachProfile: string) =>
    setState((current) => ({ ...current, coachProfile, coachProfileUpdatedAt: new Date().toISOString() }));
  const exportBackup = () => {
    downloadText(JSON.stringify(canonicalState, null, 2), `coach-loop-backup-${localDate()}.json`, "application/json");
    toast("Backup download requested");
  };
  const exportCsv = () => {
    const recordStatus = (completed: boolean, skipped = false) => completed ? "completed" : skipped ? "skipped" : "incomplete";
    const rows = [["date", "workout", "record_status", "type", "exercise_or_activity", "set", "load_type", "weight_mode", "planned_weight", "actual_weight", "unit", "planned_reps", "actual_reps", "completed_as_planned", "rpe_or_effort", "duration_min", "distance_km", "ruck_load", "average_hr", "elevation_m", "pace", "notes", "skip_reason", "efforts"]];
    state.workouts.filter((workout) => workout.status === "completed").forEach((workout) => {
      workout.exercises.forEach((exercise) => exercise.sets.forEach((set, index) => rows.push([workout.date, workout.name, recordStatus(set.completed, set.skipped), "strength", exercise.name, String(index + 1), set.loadType, set.weightMode, set.plannedWeight?.toString() ?? "", set.actualWeight?.toString() ?? "", set.unit, set.plannedReps, set.actualReps, String(set.completedAsPlanned), set.rpe, "", "", "", "", "", "", `${exercise.notes} ${set.notes}`.trim(), "", ""])));
      workout.cardio.forEach((item) => rows.push([workout.date, workout.name, recordStatus(item.completed), item.activityType, item.name, "", "", "", "", "", "", "", "", String(item.completedAsPlanned), item.effort, item.actualDurationMin?.toString() ?? "", item.actualDistanceKm?.toString() ?? "", item.ruckLoad !== null ? `${item.ruckLoad} ${item.ruckLoadUnit}` : "", item.averageHr?.toString() ?? "", item.elevationM?.toString() ?? "", item.pace, item.notes, "", (item.efforts ?? []).map((effort, index) => `${index + 1}: ${effort.completed ? "done" : "not done"}${effort.actualDistanceM !== null ? ` ${effort.actualDistanceM} m` : ""}${effort.actualLoad !== null ? ` ${effort.actualLoad} ${item.effortLoadUnit ?? "lb"}` : ""}${effort.actualDurationSec !== null ? ` ${effort.actualDurationSec} sec` : ""}`).join("; ")]));
    });
    state.workouts.filter((workout) => workout.status === "skipped").forEach((workout) => rows.push([workout.date, workout.name, "skipped", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", workout.notes, workout.skipReason, ""]));
    const csv = toCsv(rows);
    downloadText(`\uFEFF${csv}`, `coach-loop-training-${localDate()}.csv`, "text/csv;charset=utf-8");
    toast.success("CSV downloaded");
  };
  const restore = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text());
      setRestoreCandidate(prepareLoadedState(raw));
    } catch {
      toast.error("That file is not a valid Coach Loop backup");
    }
  };
  const restorePreview = restoreCandidate ? mergeRestoredState(canonicalState, restoreCandidate) : null;
  const restoreAdditions = restorePreview?.workouts.filter((workout) => !canonicalState.workouts.some((item) => item.id === workout.id)).length ?? 0;
  const restoreRemovals = canonicalState.workouts.filter((workout) => !restorePreview?.workouts.some((item) => item.id === workout.id)).length;
  return (
    <div className="page-stack">
      <section className="topline"><div><h1>Settings</h1></div></section>
      <Dialog open={Boolean(restoreCandidate)} onOpenChange={(open) => { if (!open) setRestoreCandidate(null); }}><DialogContent className="border-white/10 bg-[#171916] text-white"><DialogHeader><DialogTitle>Review backup restore</DialogTitle><DialogDescription className="text-white/55">Adds {restoreAdditions} workouts; removes {restoreRemovals} workouts according to backup deletion records. Current data is snapshotted before applying.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRestoreCandidate(null)}>Cancel</Button><Button onClick={async () => { if (!restoreCandidate) return; try { await onRestoreBackup(restoreCandidate); setRestoreCandidate(null); toast.success("Backup merged"); } catch { toast.error("Restore could not be saved"); } }}>Merge backup</Button></DialogFooter></DialogContent></Dialog>
      {Boolean(state.pendingConflicts?.length) && <section className="settings-panel"><h2 className="text-lg font-bold">Needs review · {state.pendingConflicts?.length}</h2><p className="mt-1 text-sm text-white/55">Other changes continue syncing. Choose one value for each field.</p><div className="mt-4 space-y-3">{state.pendingConflicts?.map((conflict) => <ConflictReviewItem key={conflict.id} conflict={conflict} onResolve={onResolveConflict} />)}</div></section>}
      <section className="settings-panel">
        <div className="settings-title"><div><h2>On this device</h2></div><DatabaseBackup className="text-[var(--lime)]" /></div>
        <p className="text-sm text-white/65">Workouts save to this phone’s browser storage. Download a JSON backup regularly from below; this edition does not sync between devices.</p>
        <details className="settings-sync-details"><summary>Offline files</summary><p>{offlineReady === "ready" ? "Ready for offline use" : offlineReady === "failed" ? "Could not be prepared yet; open while online and try again" : "Preparing…"}</p></details>
        {updateReady && <div role="status" className="mt-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.045] px-4 py-3"><p className="text-sm font-bold text-sky-100">Update downloaded</p><p className="mt-1 text-sm text-white/65">Finish your workout and wait for local saving to complete. Close all Coach Loop windows, then reopen the app.</p></div>}
      </section>
      <section className="settings-panel">
        <div className="settings-title"><div><h2>Backup & export</h2><p>Restore merges backup data with this device; newer entries and deletions are kept. CSV opens cleanly in Excel.</p></div><DatabaseBackup className="text-[var(--lime)]" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><Button onClick={exportBackup} className="h-12 bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"><FileJson /> Download full backup</Button><Button variant="outline" onClick={exportCsv} className="h-12 border-white/10 bg-white/[0.025] text-white"><Download /> Export CSV</Button><Button variant="outline" onClick={() => fileRef.current?.click()} className="h-12 border-white/10 bg-white/[0.025] text-white sm:col-span-2"><Import /> Restore JSON backup</Button><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.target.value = ""; }} /></div>
        <p className="mt-4 text-xs leading-5 text-white/35">Last downloaded backup: {state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).toLocaleString() : "Never"}. Save the JSON file to iCloud Drive or another safe location.</p>
      </section>
      <details className="page-disclosure"><summary><span>Recovery copies<small>Download a local checkpoint before restoring it</small></span><ChevronDown /></summary><div className="settings-panel space-y-3"><Button variant="outline" size="sm" onClick={() => void listSnapshots().then(setSnapshots).catch(() => toast.error("Recovery copies could not be read"))}>Refresh copies</Button>{snapshots.length ? snapshots.map((snapshot) => <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><p className="text-sm">{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.reason}</p><Button size="sm" variant="outline" onClick={() => void loadSnapshot(snapshot.id).then((copy) => { if (copy) downloadText(JSON.stringify(copy.state, null, 2), `coach-loop-recovery-${copy.id}.json`, "application/json"); }).catch(() => toast.error("Copy could not be downloaded"))}>Download JSON</Button></div>) : <p className="text-sm text-white/50">No recovery copies yet.</p>}</div></details>
      <details className="settings-panel profile-editor">
        <summary><span><strong>Training goals</strong><small>Included in every coach brief</small></span><ChevronDown /></summary>
        <div className="pt-4">
        <div className="space-y-2">
          {state.goals.map((goal, index) => <div key={index} className="goal-edit"><Input aria-label={`Training goal ${index + 1}`} value={goal} onChange={(event) => updateGoals((goals) => goals.map((item, goalIndex) => goalIndex === index ? event.target.value : item))} className="border-white/8 bg-black/15" /><Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => updateGoals((goals) => { const next = [...goals]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="text-white/42 hover:bg-white/8 hover:text-white disabled:opacity-20" aria-label={`Move goal ${index + 1} up`}><ChevronUp /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={index === state.goals.length - 1} onClick={() => updateGoals((goals) => { const next = [...goals]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} className="text-white/42 hover:bg-white/8 hover:text-white disabled:opacity-20" aria-label={`Move goal ${index + 1} down`}><ChevronDown /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => updateGoals((goals) => goals.filter((_, goalIndex) => goalIndex !== index))} className="text-white/25 hover:bg-red-400/10 hover:text-red-300" aria-label={`Remove goal ${index + 1}`}><X /></Button></div>)}
          <div className="flex gap-2"><Input value={newGoal} onChange={(event) => setNewGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && newGoal.trim()) { updateGoals((goals) => [...goals, newGoal.trim()]); setNewGoal(""); } }} placeholder="Add another goal…" className="border-white/8 bg-black/15" /><Button onClick={() => { if (!newGoal.trim()) return; updateGoals((goals) => [...goals, newGoal.trim()]); setNewGoal(""); }} className="bg-white/8 text-white hover:bg-white/12"><Plus /></Button></div>
        </div>
        </div>
      </details>
      <details className="settings-panel profile-editor">
        <summary>
          <span><strong>Coach profile</strong><small>Background used when you start a new ChatGPT chat</small></span>
          <ChevronDown />
        </summary>
        <div className="mt-5">
          <Textarea
            value={state.coachProfile}
            onChange={(event) => updateCoachProfile(event.target.value)}
            placeholder={DEFAULT_COACH_PROFILE}
            className="min-h-80 border-white/8 bg-black/15 text-sm leading-6"
            aria-label="Editable coach profile"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-5 text-white/42">Keep durable preferences here. Put today’s sleep, soreness, and upcoming PT in the Coach brief form.</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => updateCoachProfile(DEFAULT_COACH_PROFILE)} className="text-white/50 hover:bg-white/7 hover:text-white"><RotateCcw /> Insert starter guidance</Button>
          </div>
        </div>
      </details>
      <details className="settings-panel profile-editor">
        <summary><span><strong>Workout defaults</strong><small>Units, rest time and bar weight</small></span><ChevronDown /></summary>
        <div className="pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">Default unit<NativeSelect value={state.settings.defaultUnit} onChange={(event) => updateSettings((settings) => ({ ...settings, defaultUnit: event.target.value as Unit }))} className="mt-2 w-full border-white/8 bg-black/15"><NativeSelectOption value="lb">Pounds (lb)</NativeSelectOption><NativeSelectOption value="kg">Kilograms (kg)</NativeSelectOption></NativeSelect></label>
          <label className="field-label">Default rest (seconds)<DecimalInput min={0} max={3600} value={state.settings.defaultRestSec} onValueChange={(defaultRestSec) => updateSettings((settings) => ({ ...settings, defaultRestSec: defaultRestSec ?? 0 }))} className="mt-2 border-white/8 bg-black/15" /></label>
          <label className="field-label">Pound bar weight<DecimalInput min={0} max={200} value={state.settings.barWeightLb} onValueChange={(barWeightLb) => updateSettings((settings) => ({ ...settings, barWeightLb: barWeightLb ?? 45 }))} className="mt-2 border-white/8 bg-black/15" /></label>
          <label className="field-label">Kilogram bar weight<DecimalInput min={0} max={100} value={state.settings.barWeightKg} onValueChange={(barWeightKg) => updateSettings((settings) => ({ ...settings, barWeightKg: barWeightKg ?? 20 }))} className="mt-2 border-white/8 bg-black/15" /></label>
        </div>
        </div>
      </details>
      <details className="settings-panel profile-editor">
        <summary><span><strong>Upcoming PT & training periods</strong><small>Saved dates are added to your ChatGPT brief automatically.</small></span><ChevronDown /></summary>
        <div className="mt-5 space-y-5">
          <div><p className="mb-2 text-sm font-bold text-white/75">Upcoming events</p>
            <div className="space-y-2">{state.scheduleContext.events.filter((entry) => !entry.deletedAt).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="min-w-0 text-sm text-white/75"><strong>{entry.date}</strong> · {entry.label}</p><Button variant="ghost" size="icon-sm" aria-label={`Remove ${entry.label}`} onClick={() => setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, events: current.scheduleContext.events.map((item) => item.id === entry.id ? { ...item, updatedAt: new Date().toISOString(), deletedAt: new Date().toISOString() } : item) } }))}><X /></Button></div>)}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[145px_1fr_auto]"><Input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} className="border-white/8 bg-black/15" /><Input value={scheduleLabel} onChange={(event) => setScheduleLabel(event.target.value)} placeholder="Morning ruck, pool PT, FORCE test…" className="border-white/8 bg-black/15" /><Button onClick={() => { if (!scheduleLabel.trim()) return; setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, events: [...current.scheduleContext.events, { id: uid("event"), date: scheduleDate, label: scheduleLabel.trim(), updatedAt: new Date().toISOString() }].sort((a, b) => a.date.localeCompare(b.date)) } })); setScheduleLabel(""); }} className="bg-white/8 text-white"><Plus /> Add</Button></div>
          </div>
          <div><p className="mb-2 text-sm font-bold text-white/75">Training periods</p>
            <div className="space-y-2">{state.scheduleContext.phases.filter((phase) => !phase.deletedAt).map((phase) => <div key={phase.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="min-w-0 text-sm text-white/75"><strong>{phase.label}</strong> · {phase.start} to {phase.end}</p><Button variant="ghost" size="icon-sm" aria-label={`Remove ${phase.label}`} onClick={() => setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, phases: current.scheduleContext.phases.map((item) => item.id === phase.id ? { ...item, updatedAt: new Date().toISOString(), deletedAt: new Date().toISOString() } : item) } }))}><X /></Button></div>)}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[140px_140px_1fr_auto]"><Input type="date" aria-label="Period start" value={phaseStart} onChange={(event) => setPhaseStart(event.target.value)} className="border-white/8 bg-black/15" /><Input type="date" aria-label="Period end" value={phaseEnd} onChange={(event) => setPhaseEnd(event.target.value)} className="border-white/8 bg-black/15" /><Input value={phaseLabel} onChange={(event) => setPhaseLabel(event.target.value)} placeholder="Field exercise, travel, build block…" className="border-white/8 bg-black/15" /><Button onClick={() => { if (!phaseLabel.trim() || phaseEnd < phaseStart) return; setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, phases: [...current.scheduleContext.phases, { id: uid("phase"), start: phaseStart, end: phaseEnd, label: phaseLabel.trim(), updatedAt: new Date().toISOString() }].sort((a, b) => a.start.localeCompare(b.start)) } })); setPhaseLabel(""); }} className="bg-white/8 text-white"><Plus /> Add</Button></div>
          </div>
          <p className="text-xs leading-5 text-white/40">Individual events and active or upcoming periods appear in coach context through their end date. Saved workouts already appear on Today.</p>
        </div>
      </details>
      <BenchmarkSettings state={state} setState={setState} />
      <MuscleMappingSettings state={state} setState={setState} />
      {!installed && <details className="settings-panel profile-editor">
        <summary><span><strong>Install on iPhone</strong><small>Home Screen and offline use</small></span><ChevronDown /></summary>
        <div className="pt-4">
        <div className="settings-title"><div><h2>Install on iPhone</h2><p>In Safari, tap Share, then Add to Home Screen. The tracker works offline after the first load.</p></div><Save className="text-sky-300" /></div>
        </div>
      </details>}
      <details className="settings-panel border-red-400/10 profile-editor">
        <summary><span><strong>Reset & erase data</strong><small>Destructive actions · backup first</small></span><ChevronDown /></summary>
        <div className="pt-4">
        <div className="settings-title"><div><h2>Reset Coach Loop</h2><p>Download a backup first. This removes the log saved on this device.</p></div></div>
        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 /> Erase this device’s data</Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171916] text-white"><AlertDialogHeader><AlertDialogTitle>Erase every workout on this device?</AlertDialogTitle><AlertDialogDescription className="text-white/45">Goals, aliases, history, and the active workout will be removed from this browser. Download a backup first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-white">Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void onReset()}>Erase everything</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
      </details>
      <footer className="pt-4 text-center text-xs text-white/40">Coach Loop · Local storage</footer>
    </div>
  );
}
