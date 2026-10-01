"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { benchmarkAttempts, benchmarkDueDate } from "../domain/benchmarks";
import { localDate, uid, type PinnedBenchmark, type TrainingState } from "../domain/training-types";

function BenchmarkRow({ item, onSave }: { item: PinnedBenchmark; onSave: (item: PinnedBenchmark) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [protocol, setProtocol] = useState(item.protocol);
  const [result, setResult] = useState("");
  const [testedOn, setTestedOn] = useState(item.testedOn ?? localDate());
  const [retestDays, setRetestDays] = useState(item.retestDays === null ? "" : String(item.retestDays));
  const due = benchmarkDueDate(item);
  const attempts = benchmarkAttempts(item);
  const save = () => {
    const interval = retestDays.trim() ? Number(retestDays) : null;
    if (interval !== null && (!Number.isInteger(interval) || interval < 7 || interval > 365)) return toast.error("Use 7–365 days for a re-test interval");
    if (!name.trim()) return toast.error("Name the benchmark");
    if (result.trim() && (!/^\d{4}-\d{2}-\d{2}$/.test(testedOn) || testedOn > localDate())) return toast.error("Choose a test date up to today");
    const now = new Date().toISOString();
    const previous = item.attempts?.length ? item.attempts : benchmarkAttempts(item);
    const nextAttempts = result.trim() ? [...previous, { id: uid("test"), date: testedOn, result: result.trim(), protocol: protocol.trim(), updatedAt: now }] : previous;
    const latest = [...nextAttempts].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
    onSave({ ...item, name: name.trim(), protocol: protocol.trim(), result: latest?.result ?? "", testedOn: latest?.date ?? null, attempts: nextAttempts, retestDays: interval, updatedAt: now });
    setResult("");
    setEditing(false);
  };
  return <div className="benchmark-row"><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><strong>{item.name}</strong>{item.protocol && <p className="text-xs text-white/45">{item.protocol}</p>}<p className="text-xs text-white/55">{attempts[0] ? `${attempts[0].result} · ${attempts[0].date}` : "No result yet"}{due ? ` · re-test ${due}` : ""}</p>{attempts[1] && <p className="text-xs text-white/45">Previous: {attempts[1].result} · {attempts[1].date}{attempts[1].protocol !== attempts[0].protocol ? " · different protocol" : ""}</p>}</div><Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}>{editing ? "Close" : "Update"}</Button></div>
    {editing && <div className="benchmark-edit"><label className="field-label">Test name<Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-label">Protocol<Input value={protocol} onChange={(event) => setProtocol(event.target.value)} /></label><label className="field-label">New result<Input value={result} onChange={(event) => setResult(event.target.value)} placeholder="24:30 or 10 strict reps" /></label><label className="field-label">Tested on<Input type="date" max={localDate()} value={testedOn} onChange={(event) => setTestedOn(event.target.value)} /></label><label className="field-label">Re-test every (days)<Input inputMode="numeric" value={retestDays} onChange={(event) => setRetestDays(event.target.value)} placeholder="Optional" /></label><div className="flex gap-2"><Button onClick={save}>Save benchmark</Button><Button variant="ghost" className="text-red-300" onClick={() => { onSave({ ...item, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); setEditing(false); }}>Remove</Button></div></div>}
    {attempts.length > 2 && <details className="mt-2 text-xs text-white/55"><summary>All {attempts.length} tests</summary><div className="mt-2 space-y-1">{attempts.map((attempt) => <p key={attempt.id}>{attempt.date} · {attempt.result}{attempt.protocol !== item.protocol ? ` · ${attempt.protocol}` : ""}</p>)}</div></details>}
  </div>;
}

export function BenchmarkSettings({ state, setState }: { state: TrainingState; setState: React.Dispatch<React.SetStateAction<TrainingState>> }) {
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState("");
  const [interval, setInterval] = useState("");
  const items = (state.benchmarks ?? []).filter((item) => !item.deletedAt);
  const save = (item: PinnedBenchmark) => setState((current) => ({ ...current, benchmarks: (current.benchmarks ?? []).map((entry) => entry.id === item.id ? item : entry) }));
  const add = () => {
    const days = interval.trim() ? Number(interval) : null;
    if (!name.trim()) return toast.error("Name the benchmark");
    if (days !== null && (!Number.isInteger(days) || days < 7 || days > 365)) return toast.error("Use 7–365 days for a re-test interval");
    const item: PinnedBenchmark = { id: uid("benchmark"), name: name.trim(), protocol: protocol.trim(), result: "", testedOn: null, retestDays: days, updatedAt: new Date().toISOString() };
    setState((current) => ({ ...current, benchmarks: [...(current.benchmarks ?? []), item] }));
    setName(""); setProtocol(""); setInterval("");
  };
  return <details className="settings-panel profile-editor"><summary><span><strong>Pinned benchmarks</strong><small>Explicit tests and optional re-test intervals</small></span><ChevronDown /></summary><div className="mt-4 space-y-3"><p className="text-sm text-white/50">Pin a fixed protocol, then update its result here. Ordinary workouts are not treated as tests.</p>{items.map((item) => <BenchmarkRow key={item.id} item={item} onSave={save} />)}<div className="benchmark-edit"><label className="field-label">Test name<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="5K, strict pull-ups, FORCE drag…" /></label><label className="field-label">Protocol<Input value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="Same course, pack load, or test rules" /></label><label className="field-label">Re-test every (days)<Input inputMode="numeric" value={interval} onChange={(event) => setInterval(event.target.value)} placeholder="Optional" /></label><Button onClick={add}><Plus /> Pin benchmark</Button></div></div></details>;
}
