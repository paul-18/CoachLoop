import { orderedQuickLogOptions } from "../domain/quick-log-order";
import { useStorageHealth } from "../pwa/use-storage-health";
import { parseBackup, restoredState, backupChanges, MAX_BACKUP_BYTES, type RestoreMode } from "../persistence/backup-tools";
import { exportTrainingCsv } from "../interchange/training-csv";
/* External persistence, timers, and controlled-dialog hydration intentionally update state in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { ChevronDown, ChevronUp, DatabaseBackup, Download, FileJson, Import, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";



import { MuscleMappingSettings } from "./muscle-mapping-settings";
import { BenchmarkSettings } from "./benchmark-settings";
import { DisplayPreferences } from "./display-preferences";
import { APP_RELEASE } from "../app-release";
import { DEFAULT_COACH_PROFILE } from "../interchange/coach-export";

import { type SyncStatus } from "../persistence/cloud-sync";


import { listSnapshots, loadSnapshot, type TrainingSnapshot } from "../persistence/training-storage";
import { DEFAULT_QUICK_LOG_ACTIVITIES, localDate, uid, type FieldConflict, type TrainingState, type Unit } from "../domain/training-types";

import { DecimalInput, shareTextFile, downloadText } from "./shared";
import { validMeasurementDate } from "../domain/training-workflow";
import { portableBackup } from "../persistence/portable-backup";
import { TextEditorDialog } from "./text-editor-dialog";

function ConflictReviewItem({ conflict, onResolve }: { conflict: FieldConflict; onResolve: (id: string, value: unknown) => Promise<void> }) {
  const [fresh, setFresh] = useState("");
  const field = decodeURIComponent(conflict.fieldPath.split("/").at(-1) ?? "");
  const format = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value);
  const freeText = /^(notes|coachNotes|coachProfile|skipReason)$/.test(field);
  const numeric = typeof conflict.remoteValue === "number" || /^(actualWeight|plannedWeight|ruckLoad|averageHr|elevationM|weight|cm|retestDays|actualDurationMin|plannedDurationMin|actualDistanceKm|plannedDistanceKm)$/.test(field);
  const options: Record<string, string[]> = { unit: ["lb", "kg"], defaultUnit: ["lb", "kg"], ruckLoadUnit: ["lb", "kg"], effortLoadUnit: ["lb", "kg"], loadType: ["weighted", "bodyweight", "unrecorded"], weightMode: ["total", "per_hand", "added"], status: ["planned", "active", "completed", "skipped"], loggingStyle: ["single", "routine", "efforts"], activityType: ["run", "swim", "water_polo", "bike", "row", "walk", "hike", "ruck", "mobility", "circuit", "force", "soccer", "grappling", "yoga", "other"] };
  const choices = typeof conflict.remoteValue === "boolean" ? ["true", "false"] : options[field];
  const resolveFresh = () => {
    let value: unknown = fresh;
    if (numeric) {
      value = fresh.trim() ? Number(fresh) : null;
      if (value !== null && !Number.isFinite(value)) return toast.error("Enter a finite number");
    } else if (typeof conflict.remoteValue !== "string") {
      try { value = JSON.parse(fresh); } catch { return toast.error("Enter a valid value for this field"); }
    }
    void onResolve(conflict.id, value);
  };
  return <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.035] p-3">
    <p className="break-words font-semibold">{conflict.fieldPath}</p>
    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><div className="break-words"><span className="text-white/65">Saved value</span><p>{format(conflict.remoteValue)}</p></div><div className="break-words"><span className="text-white/65">Other edit</span><p>{format(conflict.raisingDeviceValue)}</p></div></div>
    <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void onResolve(conflict.id, conflict.remoteValue)}>Keep saved</Button><Button type="button" size="sm" variant="outline" onClick={() => void onResolve(conflict.id, conflict.raisingDeviceValue)}>Use other edit</Button>{freeText && typeof conflict.remoteValue === "string" && typeof conflict.raisingDeviceValue === "string" && <Button type="button" size="sm" variant="outline" onClick={() => void onResolve(conflict.id, `${conflict.remoteValue}\n${conflict.raisingDeviceValue}`)}>Keep both</Button>}</div>
    <div className="mt-2 flex gap-2">{choices ? <NativeSelect aria-label={`New value for ${field}`} value={fresh} onChange={(e) => setFresh(e.target.value)}><NativeSelectOption value="">Choose a value</NativeSelectOption>{choices.map((v) => <NativeSelectOption key={v} value={v}>{v}</NativeSelectOption>)}</NativeSelect> : <Input aria-label={`New value for ${field}`} type={/^(date|start|end|testedOn)$/.test(field) ? "date" : "text"} inputMode={numeric ? "decimal" : "text"} value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder={numeric ? "Number, or blank to clear" : "Or enter a new value"} className="min-w-0 border-white/10 bg-black/20" />}<Button type="button" size="sm" disabled={!numeric && !fresh.trim()} onClick={resolveFresh}>Use new</Button></div>
  </div>;
}

export function SettingsView({ openSection, onSectionOpened, state, canonicalState, setState, onResolveConflict, onRestoreBackup, onReset, offlineReady, updateReady, release, localSaveStatus, updateBlocked, onCheckUpdates, onApplyUpdate }: { openSection?: "coach-profile" | "training-goals" | null; onSectionOpened?: () => void; state: TrainingState; canonicalState: TrainingState; setState: React.Dispatch<React.SetStateAction<TrainingState>>; onResolveConflict: (id: string, value: unknown) => Promise<void>; onRestoreBackup: (backup: TrainingState, recover?: boolean, mode?: RestoreMode) => Promise<void>; onReset: () => Promise<void>; syncStatus: SyncStatus; syncFailure: string | null; onRetrySync: () => void; lastSyncedAt: string | null; offlineReady: "checking" | "ready" | "failed"; updateReady: boolean; release?: string | null; localSaveStatus?: "saving" | "saved" | "error"; updateBlocked?: boolean; onCheckUpdates?: () => Promise<void>; onApplyUpdate?: () => Promise<void> }) {
  useEffect(() => {
    if (!openSection) return;
    const target = document.getElementById(openSection);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    onSectionOpened?.();
  }, [openSection, onSectionOpened]);
  const { health } = useStorageHealth();
  const [recover, setRecover] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [snapshots, setSnapshots] = useState<TrainingSnapshot[]>([]);
  const [installed, setInstalled] = useState(false);
  const [updateNotice, setUpdateNotice] = useState("");
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [restoreCandidate, setRestoreCandidate] = useState<TrainingState | null>(null);
  useEffect(() => { void listSnapshots().then(setSnapshots).catch(() => undefined); }, []);
  useEffect(() => { setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true); }, []);
  const [textEdit, setTextEdit] = useState<{ kind: "goal" | "new-goal" | "profile"; index?: number; value: string } | null>(null);
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
    downloadText(JSON.stringify(portableBackup(canonicalState, state), null, 2), `coach-loop-backup-${localDate()}.json`, "application/json");
    updateSettings((settings) => ({ ...settings, lastBackupAt: new Date().toISOString() }));
    toast("Backup download requested");
  };
  const exportCsv = () => {
    downloadText(`\uFEFF${exportTrainingCsv(state)}`, `coach-loop-training-${localDate()}.csv`, "text/csv;charset=utf-8");
    toast("CSV download requested");
  };
  const restore = async (file: File) => {
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 10 MB limit");
      setRestoreMode("merge"); setRecover(false); setRestoreCandidate(parseBackup(await file.text()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That file is not a valid Coach Loop backup");
    }
  };
  const restorePreview = restoreCandidate ? restoredState(canonicalState, restoreCandidate, restoreMode, recover) : null;
  const restoreAdditions = restorePreview?.workouts.filter((workout) => !canonicalState.workouts.some((item) => item.id === workout.id)).length ?? 0;
  const restoreRemovals = canonicalState.workouts.filter((workout) => !restorePreview?.workouts.some((item) => item.id === workout.id)).length;
  const changes = restorePreview ? backupChanges(canonicalState, restorePreview) : null;
  return (
    <div className="page-stack">
      <section className="topline"><div><h1>Settings</h1></div></section>
      <Dialog open={Boolean(restoreCandidate)} onOpenChange={(open) => { if (!open && !restoring) setRestoreCandidate(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#171916] text-white"><DialogHeader><DialogTitle>Review backup restore</DialogTitle><DialogDescription className="text-white/55">Choose how to restore. A recovery copy of the current log is saved before applying either option.</DialogDescription></DialogHeader>
        <label className="field-label">Restore method<NativeSelect aria-label="Restore method" value={restoreMode} disabled={restoring} onChange={event => { setRestoreMode(event.target.value as RestoreMode); setRecover(false); }}><NativeSelectOption value="merge">Merge — keep newer changes</NativeSelectOption><NativeSelectOption value="replace">Complete restore — use backup only</NativeSelectOption></NativeSelect></label>
        <p className="text-sm text-white/65">{restoreMode === "replace" ? "Replaces the current workouts, goals, coach profile, measurements and settings with exactly what is in the backup. Current records absent from the backup are removed." : "Combines both logs. Newer local goals, profile and measurements can win over older backup values."}</p>
        <p className="text-sm text-white/65">Adds {restoreAdditions} workouts; removes {restoreRemovals}; changes {changes?.changed ?? 0} existing workouts. Other changed sections: {changes?.sections.join(", ") || "none"}.</p>
        <p className="text-sm text-white/65">After restore: {restorePreview?.goals.length ?? 0} goals, {restorePreview?.bodyweightEntries.length ?? 0} bodyweight entries; coach profile {restorePreview?.coachProfile?.trim() ? "included" : "empty"}.</p>
        {restoreMode === "merge" && <><label className="flex min-h-11 items-center gap-3"><Checkbox checked={recover} disabled={restoring} onCheckedChange={value => setRecover(value === true)} />Recover deleted records with new IDs</label><p className="text-sm text-white/60">Use recovery only for accidental deletions. Ordinary merge keeps deletion protection.</p></>}
        <DialogFooter><Button disabled={restoring} variant="outline" onClick={() => setRestoreCandidate(null)}>Cancel</Button><Button disabled={restoring} onClick={async () => { if (!restoreCandidate) return; setRestoring(true); try { await onRestoreBackup(restoreCandidate, recover, restoreMode); setRestoreCandidate(null); toast.success("Backup restored and saved"); } catch (error) { toast.error(error instanceof Error ? error.message : "Restore could not be saved; original log retained"); } finally { setRestoring(false); } }}>{restoring ? "Saving…" : restoreMode === "replace" ? "Complete restore" : "Merge backup"}</Button></DialogFooter></DialogContent></Dialog>
      {Boolean(state.pendingConflicts?.length) && <section className="settings-panel"><h2 className="text-lg font-bold">Needs review · {state.pendingConflicts?.length}</h2><p className="mt-1 text-sm text-white/55">This backup contains unresolved edits. Choose one value for each field.</p><div className="mt-4 space-y-3">{state.pendingConflicts?.map((conflict) => <ConflictReviewItem key={conflict.id} conflict={conflict} onResolve={onResolveConflict} />)}</div></section>}
      <section className="settings-panel">
        <div className="settings-title"><div><h2>On this device</h2></div><DatabaseBackup className="text-[var(--lime)]" /></div>
        <p className="text-sm text-white/65">Workouts save to this phone’s browser storage. Download a JSON backup regularly from below; this edition does not sync between devices.</p>
        <p className="mt-2 text-sm text-white/60">Storage protection: {health.persisted === true ? "Persistent storage granted" : health.persisted === false ? "Best-effort storage; keep an external backup" : "Status unavailable; keep an external backup"}{health.usage !== undefined && health.quota ? ` · ${(health.usage / 1048576).toFixed(1)} MB used of ${(health.quota / 1048576).toFixed(0)} MB estimated quota` : ""}</p><details className="settings-sync-details"><summary>Offline files</summary><p>{offlineReady === "ready" ? "Ready for offline use" : offlineReady === "failed" ? "Could not be prepared yet; open while online and try again" : "Preparing…"}</p></details>
        <p className="mt-3 text-sm" role="status">{localSaveStatus === "error" ? "Latest changes are not saved" : localSaveStatus === "saving" ? "Saving…" : "Saved on this device"} · {APP_RELEASE}{release ? ` · ${release.split(":").at(-1)?.slice(0, 8)}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={!onCheckUpdates} onClick={() => void onCheckUpdates?.().then(() => setUpdateNotice("Update check requested. Any downloaded update appears here.")).catch(() => setUpdateNotice("Update check failed; try again while online."))}>Check updates</Button>{updateReady && <Button disabled={updateBlocked || !onApplyUpdate} onClick={() => void onApplyUpdate?.().catch(error => toast.error(error instanceof Error ? error.message : "Update failed; try again"))}>Restart to update</Button>}</div>
        {updateNotice && <p role="status" aria-live="polite" className="mt-2 text-sm text-white/65">{updateNotice}</p>}
        {updateReady && <p className="mt-2 text-sm text-white/65">Update downloaded. Finish your workout, save and close any editor, then restart here. Close other Coach Loop windows first.</p>}
      </section>
      <details className="settings-panel profile-editor"><summary><span><strong>Appearance & quick log</strong><small>Colors, shortcuts, and Progress layout</small></span><ChevronDown /></summary><div className="space-y-5 pt-4">
        <DisplayPreferences settings={state.settings} onUpdate={updateSettings} />
        <label className="field-label block">Strength coverage visual<NativeSelect aria-label="Strength coverage visual" value={state.settings.bodyDiagram ?? "male"} onChange={event => updateSettings(settings => ({ ...settings, bodyDiagram: event.target.value as "male" | "female" }))} className="mt-2 w-full"><NativeSelectOption value="male">Male</NativeSelectOption><NativeSelectOption value="female">Female</NativeSelectOption></NativeSelect><small className="mt-2 block text-white/55">Changes the diagram only. Your logged sets, coverage calculations, profile, and goals stay the same.</small></label>
        <div><h3 className="font-bold">Quick-log activities</h3><p className="mt-1 text-sm text-white/60">Select the buttons you want on Today. Hiding a button keeps its history and import support.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{orderedQuickLogOptions(state.settings.quickLogActivities ?? DEFAULT_QUICK_LOG_ACTIVITIES).map(option => {
          const selected = state.settings.quickLogActivities ?? DEFAULT_QUICK_LOG_ACTIVITIES;
          const index = selected.indexOf(option.type);
          return <div key={option.type} data-quick-log={option.type} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3"><label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3"><Checkbox checked={index >= 0} onCheckedChange={checked => updateSettings(settings => { const current = settings.quickLogActivities ?? DEFAULT_QUICK_LOG_ACTIVITIES; return { ...settings, quickLogActivities: checked === true ? [...current.filter(type => type !== option.type), option.type] : current.filter(type => type !== option.type) }; })} />{option.label}</label>{index >= 0 && <><Button variant="ghost" size="icon" disabled={index === 0} aria-label={`Move ${option.label} earlier`} onClick={() => updateSettings(settings => { const next = [...(settings.quickLogActivities ?? DEFAULT_QUICK_LOG_ACTIVITIES)]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return { ...settings, quickLogActivities: next }; })}><ChevronUp /></Button><Button variant="ghost" size="icon" disabled={index === selected.length - 1} aria-label={`Move ${option.label} later`} onClick={() => updateSettings(settings => { const next = [...(settings.quickLogActivities ?? DEFAULT_QUICK_LOG_ACTIVITIES)]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return { ...settings, quickLogActivities: next }; })}><ChevronDown /></Button></>}</div>;
        })}</div><Button variant="outline" className="mt-3" onClick={() => updateSettings(settings => ({ ...settings, quickLogActivities: [...DEFAULT_QUICK_LOG_ACTIVITIES] }))}>Restore default shortcuts</Button></div>
      </div></details>
      <section className="settings-panel">
        <div className="settings-title"><div><h2>Backup & export</h2><p>Save a JSON backup for recovery. Export CSV to view your training in a spreadsheet. Restoring merges data; newer changes are kept.</p></div><DatabaseBackup className="text-[var(--lime)]" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><Button onClick={exportBackup} className="h-12 bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"><FileJson /> Download full backup</Button><Button variant="outline" onClick={exportCsv} className="h-12 border-white/10 bg-white/[0.025] text-white"><Download /> Export CSV</Button><Button variant="outline" onClick={() => fileRef.current?.click()} className="h-12 border-white/10 bg-white/[0.025] text-white sm:col-span-2"><Import /> Restore JSON backup</Button><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.target.value = ""; }} /></div>
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => { void shareTextFile(JSON.stringify(portableBackup(canonicalState, state), null, 2), `coach-loop-backup-${localDate()}.json`, "application/json").then(() => { updateSettings(settings => ({ ...settings, lastBackupAt: new Date().toISOString() })); toast("Backup shared; confirm it is saved in Files"); }).catch(error => { if (error?.name !== "AbortError") toast.error(error.message ?? "Use Download full backup"); }); }}>Share backup / Save to Files</Button><p className="mt-4 text-xs leading-5 text-white/35">Last backup requested: {state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).toLocaleString() : "Never"}. Save the JSON file to iCloud Drive or another safe location.</p>
      </section>
      <details className="page-disclosure"><summary><span>Recovery copies<small>Automatic copies saved on this device</small></span><ChevronDown /></summary><div className="settings-panel space-y-3"><Button variant="outline" size="sm" onClick={() => void listSnapshots().then(setSnapshots).catch(() => toast.error("Recovery copies could not be read"))}>Refresh copies</Button>{snapshots.length ? snapshots.map((snapshot) => <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><p className="text-sm">{new Date(snapshot.createdAt).toLocaleString()} · {({ "workout-complete": "Workout saved", "before-start": "Before starting a workout", "before-restore": "Before restoring a backup", "before-reset": "Before resetting data" } as Record<string, string>)[snapshot.reason] ?? "Saved checkpoint"}</p><Button size="sm" variant="outline" onClick={() => void loadSnapshot(snapshot.id).then((copy) => { if (copy) downloadText(JSON.stringify(copy.state, null, 2), `coach-loop-recovery-${copy.id}.json`, "application/json"); }).catch(() => toast.error("Copy could not be downloaded"))}>Download JSON</Button></div>) : <p className="text-sm text-white/50">No recovery copies yet.</p>}</div></details>
      <details id="training-goals" className="settings-panel profile-editor">
        <summary><span><strong>Training goals</strong><small>Included in every coach brief</small></span><ChevronDown /></summary>
        <div className="pt-4">
        <p className="mb-3 text-sm leading-6 text-white/55">Rank your goals from most to least important. Your coach brief includes this order.</p>
        <div className="space-y-2">
          {state.goals.map((goal, index) => <div key={index} className="goal-read-card"><p>{goal}</p><div className="goal-actions"><Button type="button" variant="outline" size="sm" onClick={() => setTextEdit({ kind: "goal", index, value: goal })}>Edit</Button><Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => updateGoals((goals) => { const next = [...goals]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} aria-label={`Move goal ${index + 1} up`}><ChevronUp /></Button><Button type="button" variant="ghost" size="icon" disabled={index === state.goals.length - 1} onClick={() => updateGoals((goals) => { const next = [...goals]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} aria-label={`Move goal ${index + 1} down`}><ChevronDown /></Button><Button type="button" variant="ghost" size="icon" onClick={() => updateGoals((goals) => goals.filter((_, goalIndex) => goalIndex !== index))} aria-label={`Remove goal ${index + 1}`}><X /></Button></div></div>)}
          {!state.goals.length && <p className="text-sm text-white/60">No goals yet.</p>}
          <Button variant="outline" onClick={() => setTextEdit({ kind: "new-goal", value: "" })}><Plus /> Add goal</Button>
        </div>
        </div>
      </details>
      <details id="coach-profile" className="settings-panel profile-editor">
        <summary>
          <span><strong>Coach profile</strong><small>Your background and long-term coaching preferences</small></span>
          <ChevronDown />
        </summary>
        <div className="mt-5">
          <p className="profile-read-text">{state.coachProfile || "Add your training background and durable preferences."}</p>
          <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTextEdit({ kind: "profile", value: state.coachProfile })}>Edit coach profile</Button><Button type="button" variant="ghost" size="sm" onClick={() => setTextEdit({ kind: "profile", value: DEFAULT_COACH_PROFILE })}><RotateCcw /> Use starter guidance</Button></div>
          <p className="mt-3 text-sm leading-5 text-white/55">Keep durable preferences here. Put today’s sleep, soreness, and upcoming PT in the Coach brief form.</p>
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
            <div className="mt-2 grid gap-2 sm:grid-cols-[145px_1fr_auto]"><Input type="date" aria-label="Event date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} className="border-white/8 bg-black/15" /><Input aria-label="Event name" value={scheduleLabel} onChange={(event) => setScheduleLabel(event.target.value)} placeholder="Morning ruck, pool PT, FORCE test…" className="border-white/8 bg-black/15" /><Button onClick={() => { if (!scheduleLabel.trim() || !validMeasurementDate(scheduleDate)) { toast.error("Enter an event name and valid date"); return; } setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, events: [...current.scheduleContext.events, { id: uid("event"), date: scheduleDate, label: scheduleLabel.trim(), updatedAt: new Date().toISOString() }].sort((a, b) => a.date.localeCompare(b.date)) } })); setScheduleLabel(""); }} className="bg-white/8 text-white"><Plus /> Add</Button></div>
          </div>
          <div><p className="mb-2 text-sm font-bold text-white/75">Training periods</p>
            <div className="space-y-2">{state.scheduleContext.phases.filter((phase) => !phase.deletedAt).map((phase) => <div key={phase.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="min-w-0 text-sm text-white/75"><strong>{phase.label}</strong> · {phase.start} to {phase.end}</p><Button variant="ghost" size="icon-sm" aria-label={`Remove ${phase.label}`} onClick={() => setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, phases: current.scheduleContext.phases.map((item) => item.id === phase.id ? { ...item, updatedAt: new Date().toISOString(), deletedAt: new Date().toISOString() } : item) } }))}><X /></Button></div>)}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[140px_140px_1fr_auto]"><Input type="date" aria-label="Period start" value={phaseStart} onChange={(event) => setPhaseStart(event.target.value)} className="border-white/8 bg-black/15" /><Input type="date" aria-label="Period end" value={phaseEnd} onChange={(event) => setPhaseEnd(event.target.value)} className="border-white/8 bg-black/15" /><Input aria-label="Training period name" value={phaseLabel} onChange={(event) => setPhaseLabel(event.target.value)} placeholder="Field exercise, travel, build block…" className="border-white/8 bg-black/15" /><Button onClick={() => { if (!phaseLabel.trim() || !validMeasurementDate(phaseStart) || !validMeasurementDate(phaseEnd) || phaseEnd < phaseStart) { toast.error("Enter a name and valid start and end dates"); return; } setState((current) => ({ ...current, scheduleContext: { ...current.scheduleContext, phases: [...current.scheduleContext.phases, { id: uid("phase"), start: phaseStart, end: phaseEnd, label: phaseLabel.trim(), updatedAt: new Date().toISOString() }].sort((a, b) => a.start.localeCompare(b.start)) } })); setPhaseLabel(""); }} className="bg-white/8 text-white"><Plus /> Add</Button></div>
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
        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 /> Erase this device’s data</Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171916] text-white"><AlertDialogHeader><AlertDialogTitle>Erase every workout on this device?</AlertDialogTitle><AlertDialogDescription className="text-white/45">Goals, aliases, history, and the active workout will be removed from this browser. Download a backup first. Automatic recovery copies are also permanently erased.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-transparent text-white">Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void onReset()}>Erase everything</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
      </details>
      {textEdit && <TextEditorDialog title={textEdit.kind === "profile" ? "Edit coach profile" : textEdit.kind === "new-goal" ? "Add training goal" : "Edit training goal"} description="Changes apply when you tap Save." value={textEdit.value} allowEmpty={textEdit.kind === "profile"} onChange={(value) => setTextEdit((current) => current ? { ...current, value } : current)} onClose={() => setTextEdit(null)} onSave={() => {
        if (textEdit.kind === "profile") updateCoachProfile(textEdit.value);
        else if (textEdit.kind === "new-goal") updateGoals((goals) => [...goals, textEdit.value.trim()]);
        else updateGoals((goals) => goals.map((goal, index) => index === textEdit.index ? textEdit.value.trim() : goal));
        setTextEdit(null);
      }} />}
      <footer className="pt-4 text-center text-xs text-white/40">Coach Loop {APP_RELEASE} · Local storage</footer>
    </div>
  );
}
