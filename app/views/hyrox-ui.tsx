/* External persistence, timers, and controlled-dialog hydration intentionally update state in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { localDate, type Unit, type WorkoutSession } from "../domain/training-types";
import { HYROX_DIVISIONS, HYROX_RULEBOOK, HYROX_SEASON, hyroxPreset, hyroxPrescription, makeHyroxWorkout, hyroxCurrentIndex, hyroxSegmentElapsed, hyroxTotal, hyroxTime, updateHyrox, correctHyroxSplit, comparableHyrox, type HyroxDivision, type HyroxSegment } from "../domain/hyrox";

function NumberField({ label, value, onChange, integer = false }: { label: string; value: number; onChange: (value: number) => void; integer?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="field-label">{label}<Input inputMode={integer ? "numeric" : "decimal"} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { const n = Number(draft); if (draft.trim() && Number.isFinite(n) && n > 0 && (!integer || Number.isInteger(n))) onChange(n); else { setDraft(String(value)); toast.error(`Enter a positive ${integer ? "whole " : ""}number for ${label.toLowerCase()}`); } }} /></label>;
}

export function HyroxSetup({ open, onOpenChange, onSave, onStart, active, unit }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (workout: WorkoutSession) => Promise<void>; onStart: (workout: WorkoutSession) => Promise<void>; active: boolean; unit: Unit }) {
  const [mode, setMode] = useState("full");
  const [selected, setSelected] = useState<string[]>(["run-1","station-1","run-2","station-2"]);
  const [setupLabel, setSetupLabel] = useState("");
  const [division, setDivision] = useState<HyroxDivision>("men_open");
  const [segments, setSegments] = useState(() => hyroxPreset("men_open"));
  const update = (id: string, changes: Partial<HyroxSegment>) => setSegments((items) => items.map((s) => s.id === id ? { ...s, ...changes } : s));
  const [saving, setSaving] = useState(false);
  const create = async (start: boolean) => { if (saving) return; setSaving(true); try { const workout = makeHyroxWorkout(division, mode === "full" ? segments : segments.filter(s=>selected.includes(s.id)), setupLabel); await (start ? onStart(workout) : onSave(workout)); onOpenChange(false); } catch { toast.error("Could not save; your setup is retained. Retry when storage is available."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}><DialogContent className="hyrox-setup border-white/10 bg-[#151713] text-white">
    <DialogHeader><DialogTitle>HYROX gym simulation</DialogTitle><DialogDescription>Singles · full simulation or focused practice.</DialogDescription></DialogHeader>
    <div className="hyrox-scroll">
      <label className="field-label">Session<NativeSelect value={mode} onChange={e=>setMode(e.target.value)}><NativeSelectOption value="full">Full simulation</NativeSelectOption><NativeSelectOption value="focused">Focused practice · choose segments</NativeSelectOption></NativeSelect></label>
      <label className="field-label">Gym / route label · optional<Input placeholder="Base gym · treadmill / turf" value={setupLabel} onChange={e=>setSetupLabel(e.target.value)} /></label><p className="hyrox-muted">Use the same label for comparable equipment and routes.</p>
      <label className="field-label">Division<NativeSelect className="w-full mt-1" value={division} onChange={(event) => { const next = event.target.value as HyroxDivision; setDivision(next); setSegments(hyroxPreset(next)); }}>{Object.entries(HYROX_DIVISIONS).map(([key,label]) => <NativeSelectOption key={key} value={key}>{label}</NativeSelectOption>)}</NativeSelect></label>
      <p className="hyrox-muted">Changing division resets setup edits. Presets use kg; {unit === "lb" ? "pound equivalents are approximate." : "edit loads below if your gym differs."}</p>
      <details className="hyrox-info"><summary>Equipment & timing <ChevronDown size={16} /></summary><p>Measured run route or treadmill, SkiErg, sled and rope, measured lanes, rower, two kettlebells, sandbag and a wall ball with a target.</p><p>Sled loads include the sled itself. Gym turf and equipment affect difficulty. Tap Complete segment at the end of each run or station; transitions count toward the next segment. Pause only for gym interruptions—paused time is excluded and flagged.</p><p>Self-timed training, not an official result. <a href={HYROX_RULEBOOK} target="_blank" rel="noreferrer">{HYROX_SEASON} singles rulebook</a> · Independent tracker.</p></details>
      <ol className="hyrox-plan">{segments.map((s,index) => <li key={s.id}><div className="hyrox-plan-line"><span>{mode === "focused" ? <Checkbox className="hyrox-include" aria-label={`Include ${s.name}`} checked={selected.includes(s.id)} onCheckedChange={v=>setSelected(ids=>v?[...ids,s.id]:ids.filter(id=>id!==s.id))} /> : index+1}</span><div><strong>{s.name}</strong><small>{hyroxPrescription(s, unit)}</small></div></div><details className="hyrox-adjust"><summary>Instructions / adjust</summary><p>{s.cue}</p><label className="field-label">Exercise or substitution<Input value={s.name} onChange={(event) => update(s.id, { name: event.target.value })} /></label><div className="hyrox-fields">{s.distanceM !== null && <NumberField label="Distance (m)" value={s.distanceM} onChange={(distanceM) => update(s.id, { distanceM })} />}{s.reps !== null && <NumberField label="Reps" integer value={s.reps} onChange={(reps) => update(s.id, { reps })} />}{s.loadKg !== null && <NumberField label={s.loadCount === 2 ? "Each weight (kg)" : "Load (kg)"} value={s.loadKg} onChange={(loadKg) => update(s.id, { loadKg })} />}{s.targetM !== null && <NumberField label="Target height (m)" value={s.targetM} onChange={(targetM) => update(s.id, { targetM })} />}</div></details></li>)}</ol>
    </div>
    <div className="hyrox-actions"><Button variant="outline" onClick={() => create(false)} disabled={saving || (mode === "focused" && !selected.length) || segments.some((s) => !s.name.trim())}>Save for later</Button><Button disabled={saving || active || (mode === "focused" && !selected.length) || segments.some((s) => !s.name.trim())} onClick={() => create(true)} className="bg-[var(--lime)] text-black">Open session</Button></div>{active && <p className="hyrox-muted">You can save this plan while another workout is active.</p>}
  </DialogContent></Dialog>;
}

function SplitEdit({ workout, segment, onUpdate }: { workout: WorkoutSession; segment: HyroxSegment; onUpdate: (workout: WorkoutSession) => void }) {
  const [value, setValue] = useState(hyroxTime(segment.splitMs ?? 0));
  useEffect(() => setValue(hyroxTime(segment.splitMs ?? 0)), [segment.splitMs]);
  return <details className="hyrox-adjust"><summary>Correct split</summary><div className="hyrox-actions"><Input aria-label={`Time for ${segment.name} in minutes:seconds`} value={value} placeholder="mm:ss" onChange={(event) => setValue(event.target.value)} /><Button variant="outline" onClick={() => { const match = /^(\d+):([0-5]\d)$/.exec(value.trim()); const ms = match ? (Number(match[1])*60+Number(match[2]))*1000 : 0; if (!ms) return toast.error("Enter a time such as 4:35"); onUpdate(correctHyroxSplit(workout, segment.id, ms)); toast.success("Split corrected; total updated"); }}>Save</Button></div></details>;
}

export function HyroxResults({ workout, onUpdate, unit = "kg", history = [] }: { workout: WorkoutSession; history?: WorkoutSession[]; onUpdate?: (workout: WorkoutSession) => void; unit?: Unit }) {
  const session = workout.hyrox;
  if (!session) return null;
  const done = session.segments.filter((s) => s.splitMs !== null);
  return <div className="hyrox-results"><p className="hyrox-muted">{HYROX_DIVISIONS[session.division]} · {session.season}{session.focused ? " · Focused practice" : ""}{session.setupLabel ? ` · ${session.setupLabel}` : ""} · {session.modified ? "Modified setup" : "Division preset"}</p><div className="hyrox-result-total"><span>{session.endedEarly ? "Partial session" : done.length === session.segments.length ? "Total time" : "Recorded splits"}</span><strong>{hyroxTime(done.reduce((sum,s) => sum + s.splitMs!, 0) + (session.endedEarly ? session.segmentElapsedMs : 0))}</strong></div><p className="hyrox-muted">{done.length}/{session.segments.length} segments completed{session.paused ? " · Pauses excluded" : ""}{session.segments.some((s) => s.corrected) ? " · Times manually corrected" : ""}. Transitions included in the next split.</p>{session.endedEarly && session.segmentElapsedMs > 0 && <p className="hyrox-muted">Includes {hyroxTime(session.segmentElapsedMs)} on the unfinished segment; no completion or distance credited.</p>}
    <HyroxComparison workout={workout} history={history} />
    <ol className="hyrox-plan">{session.segments.map((s,index) => <li key={s.id}><div className="hyrox-plan-line"><span>{index+1}</span><div><strong>{s.name}</strong><small>{hyroxPrescription(s, unit)}</small></div><b>{s.splitMs === null ? "—" : hyroxTime(s.splitMs)}</b></div>{onUpdate && s.splitMs !== null && <SplitEdit workout={workout} segment={s} onUpdate={onUpdate} />}</li>)}</ol>
  </div>;
}

export function HyroxWorkout({ saveStatus, workout, onUpdate, onFinish, onBack, onDiscard, unit, history }: { saveStatus?: "saving" | "saved" | "error"; history: WorkoutSession[]; workout: WorkoutSession; onUpdate: (workout: WorkoutSession) => void; onFinish: (workout: WorkoutSession) => Promise<void>; onBack: () => void; onDiscard: () => void; unit: Unit }) {
  const session = workout.hyrox!;
  const index = hyroxCurrentIndex(session);
  const current = session.segments[index];
  const editing = Boolean(workout.completedAt);
  const [saving, setSaving] = useState(false);
  const finish = async (next: WorkoutSession) => { if (saving) return; setSaving(true); try { await onFinish(next); } catch { toast.error("Could not save; your session is retained. Retry when storage is available."); } finally { setSaving(false); } };
  const [now, setNow] = useState(() => Date.now());
  const [awake, setAwake] = useState(false);
  const lastTap = useRef(0);
  useEffect(() => { const handle = window.setInterval(() => setNow(Date.now()), 500); return () => clearInterval(handle); }, []);
  useEffect(() => {
    if (!awake) return;
    let lock: { release: () => Promise<void> } | undefined;
    let disposed = false;
    const acquire = async () => { try { const api = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock; if (!api) throw new Error(); const next = await api.request("screen"); if (disposed) await next.release(); else lock = next; } catch { if (!disposed && document.visibilityState === "visible") { setAwake(false); toast.info("Keep screen awake is unavailable right now"); } } };
    const visible = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire(); document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; document.removeEventListener("visibilitychange", visible); void lock?.release().catch(() => undefined); };
  }, [awake]);
  const act = (action: "start" | "pause" | "complete" | "undo") => { const time = Date.now(); if (time-lastTap.current < 600) return; lastTap.current = time; onUpdate(updateHyrox(workout, action, time)); setNow(time); };
  return <div className="hyrox-workout"><header className="hyrox-header"><Button variant="ghost" size="icon" aria-label="Back to Today" onClick={onBack}><ArrowLeft /></Button><div><strong>{editing ? "Edit HYROX session" : "HYROX simulation"}</strong><small>{HYROX_DIVISIONS[session.division]} · {session.modified ? "Modified" : "Division preset"}</small><small role="status">{saveStatus === "error" ? "Not saved · retry" : saveStatus === "saving" ? "Saving…" : "Saved on this device"}</small></div><Button variant="outline" aria-pressed={awake} onClick={() => setAwake((v) => !v)}>{awake ? "Awake on" : "Keep awake"}</Button></header>
    <main className="hyrox-main">{!editing && current && <section className="hyrox-live"><p className="eyebrow">Segment {index+1} of {session.segments.length}</p><h1>{current.name}</h1><p className="hyrox-requirement">{hyroxPrescription(current, unit)}</p><div className="hyrox-clocks"><div><span>This segment</span><strong>{hyroxTime(hyroxSegmentElapsed(session, now))}</strong></div><div><span>Total</span><strong>{hyroxTime(hyroxTotal(session, now))}</strong></div></div><p className="hyrox-muted">{current.cue}</p>{session.segments[index+1] && <p className="hyrox-next">Next: {session.segments[index+1].name} · {hyroxPrescription(session.segments[index+1], unit)}</p>}<p className="hyrox-muted">{!session.started ? "Tap Start timer when ready." : session.runningSince === null ? "Paused · timer excludes this break." : "Timer continues when you leave this screen."}</p></section>}
    {editing && <label className="field-label">Workout date<Input type="date" max={localDate()} value={workout.date} onChange={(event) => { const date = event.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= localDate()) onUpdate({ ...workout, date }); }} /></label>}
    {(editing || !current) ? <HyroxResults workout={workout} onUpdate={onUpdate} unit={unit} history={history} /> : <details className="hyrox-info"><summary>Full session & recorded splits <ChevronDown size={16} /></summary><HyroxResults workout={workout} onUpdate={onUpdate} unit={unit} history={history} /></details>}
    {!editing && index !== 0 && <Button variant="outline" onClick={() => act("undo")}>Undo last completion</Button>}
    <details className="hyrox-info"><summary>Your notes <ChevronDown size={16} /></summary><Textarea aria-label="HYROX session notes" value={workout.notes} onChange={(event) => onUpdate({ ...workout, notes: event.target.value })} placeholder="Turf, substitutions, interruptions…" /></details>
    {!editing && current && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost">End session early</Button></AlertDialogTrigger><AlertDialogContent className="bg-[#151713] text-white border-white/10"><AlertDialogHeader><AlertDialogTitle>Save a partial session?</AlertDialogTitle><AlertDialogDescription>Only finished segments count as completed. The unfinished segment keeps its elapsed time, but receives no distance credit.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep training</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={() => void finish(updateHyrox(workout, "end"))}>Save partial session</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    {!editing && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="text-red-300 min-h-11">Discard session</Button></AlertDialogTrigger><AlertDialogContent className="bg-[#151713] text-white border-white/10"><AlertDialogHeader><AlertDialogTitle>Discard this HYROX session?</AlertDialogTitle><AlertDialogDescription>This removes this session and all its recorded splits from this device. Nothing will count toward your history or progress. To keep finished segments, use End session early instead.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep session</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onDiscard}>Discard session</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    </main><footer className="hyrox-controls">{editing || !current ? <Button className="hyrox-primary" disabled={saving} onClick={() => void finish(workout)}><Check />{editing ? "Finish editing" : "Save to history"}</Button> : <>{session.runningSince !== null ? <><Button variant="outline" onClick={() => act("pause")}>Pause</Button><Button className="hyrox-primary" onClick={() => act("complete")}><Check />Complete segment</Button></> : <Button className="hyrox-primary" onClick={() => act("start")}><Timer />{session.started ? "Resume timer" : "Start timer"}</Button>}</>}</footer>
  </div>;
}

function HyroxComparison({workout,history}:{workout:WorkoutSession;history:WorkoutSession[]}) {
 const [selected,setSelected]=useState('');
 const matches=comparableHyrox(workout,history);
 const prior=matches.find(w=>w.id===selected)??matches[0];
 if (!workout.hyrox || workout.hyrox.segments.some(s=>s.splitMs===null) || workout.hyrox.endedEarly) return null;
 const delta=(ms:number)=>`${ms<0?'−':ms>0?'+':''}${hyroxTime(Math.abs(ms))}`;
 return <details className="hyrox-info"><summary>Compare matching sessions <ChevronDown size={16}/></summary>{prior ? <><label className="field-label">Compare with<NativeSelect value={prior.id} onChange={e=>setSelected(e.target.value)}>{matches.map(w=><NativeSelectOption key={w.id} value={w.id}>{w.date} · {hyroxTime(hyroxTotal(w.hyrox!))}</NativeSelectOption>)}</NativeSelect></label><p>Total difference: <strong>{delta(hyroxTotal(workout.hyrox)-hyroxTotal(prior.hyrox!))}</strong> · minus means faster</p><p>Same recorded order, loads, distances, division and pause category. Gym conditions are not measured.{!workout.hyrox.setupLabel?' No gym / route label was recorded.':''}</p><div className="hyrox-compare">{workout.hyrox.segments.map((s,i)=><div key={s.id}><span>{s.name}</span><span>{hyroxTime(s.splitMs!)} vs {hyroxTime(prior.hyrox!.segments[i].splitMs!)}</span><strong>{delta(s.splitMs!-prior.hyrox!.segments[i].splitMs!)}</strong></div>)}</div></> : <p>No matching completed session yet. Repeat this setup to build a comparison. Partial sessions and different pause categories are kept separate.</p>}</details>;
}
