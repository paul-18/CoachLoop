"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { coverageExerciseKey, exerciseMappingEntries, MUSCLE_GROUPS, targetForCoverage, type MuscleGroup } from "../domain/training-coverage";
import type { TrainingState } from "../domain/training-types";

export function MuscleMappingSettings({ state, setState }: { state: TrainingState; setState: Dispatch<SetStateAction<TrainingState>> }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [primary, setPrimary] = useState<MuscleGroup[]>([]);
  const [secondary, setSecondary] = useState<MuscleGroup[]>([]);
  const entries = exerciseMappingEntries(state);
  const reviewedCount = entries.filter((entry) => entry.reviewed).length;
  const openEditor = (name: string) => {
    const target = targetForCoverage(name, state.exerciseMuscleOverrides);
    setPrimary([...(target?.primary ?? [])]);
    setSecondary([...(target?.secondary ?? [])]);
    setEditing(name);
  };
  const save = (name: string, reset = false) => {
    const now = new Date().toISOString();
    setState((current) => ({ ...current, exerciseMuscleOverrides: {
      ...current.exerciseMuscleOverrides,
      [coverageExerciseKey(name)]: reset ? { primary: [], updatedAt: now, deletedAt: now } : { primary, secondary: secondary.filter((muscle) => !primary.includes(muscle)), updatedAt: now },
    } }));
    setEditing(null);
  };
  return <details className="settings-panel profile-editor muscle-mapping-panel">
    <summary><span><strong>Exercise muscle mapping</strong><small>{entries.length} exercises · {reviewedCount} reviewed · {entries.length - reviewedCount} to review</small></span><ChevronDown /></summary>
    <div className="mapping-content">
      <p>Review the automatic matches or choose your own. Changes apply to this exercise throughout your history and future workouts.</p>
      <Input aria-label="Search exercise muscle mappings" placeholder="Find an exercise…" value={query} onChange={(event) => setQuery(event.target.value)} />
      {([false, true] as const).map((reviewed) => {
        const group = entries.filter((entry) => entry.reviewed === reviewed);
        const visible = group.filter((entry) => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
        return <details key={String(reviewed)} className="mapping-group">
          <summary><strong>{reviewed ? "Reviewed" : "Not reviewed yet"}</strong><span>{query ? `${visible.length} / ` : ""}{group.length}</span><ChevronDown size={16} /></summary>
          <div className="mapping-entries">{visible.map((entry) => <article className="mapping-entry" key={entry.key}>
            <div className="mapping-entry-heading"><strong>{entry.name}</strong><Button variant="outline" size="sm" onClick={() => openEditor(entry.name)}>{reviewed ? "Edit" : "Review"}</Button></div>
            <dl><div><dt>Primary</dt><dd>{entry.target?.primary.join(", ") || "Not assigned"}</dd></div><div><dt>Secondary</dt><dd>{entry.target?.secondary?.join(", ") || "None"}</dd></div></dl>
            {!reviewed && <small>{entry.target ? "Automatic match · needs your review" : "Unmapped · excluded from strength coverage"}</small>}
          </article>)}{!visible.length && <p>{query ? "No matching exercises in this group." : reviewed ? "Mappings you confirm or edit will appear here." : "All your exercise mappings have been reviewed."}</p>}</div>
        </details>;
      })}
      {!entries.length && <p>Exercises from saved plans and your training log will appear here.</p>}
      <p className="mapping-help">Each completed working set counts as 1 set for each primary muscle and 0.5 for each secondary muscle. This describes logged strength work, not recovery.</p>
    </div>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
      <DialogContent className="mapping-dialog border-white/10 bg-[#151713] text-white">
        <DialogHeader><DialogTitle>{editing}</DialogTitle><DialogDescription>Choose one or more primary muscles and optional secondary muscles. Save to mark this exercise reviewed.</DialogDescription></DialogHeader>
        <div className="mapping-editor-body">{(["primary", "secondary"] as const).map((part) => <fieldset key={part}><legend>{part === "primary" ? "Primary muscles · 1 set each" : "Secondary muscles · 0.5 set each"}</legend><div className="mapping-muscle-options">{MUSCLE_GROUPS.map((muscle) => <label key={muscle}>
          <Checkbox checked={(part === "primary" ? primary : secondary).includes(muscle)} disabled={part === "secondary" && primary.includes(muscle)} onCheckedChange={(checked) => {
            if (part === "primary") { setPrimary((values) => checked ? [...values, muscle] : values.filter((value) => value !== muscle)); if (checked) setSecondary((values) => values.filter((value) => value !== muscle)); }
            else setSecondary((values) => checked ? [...values, muscle] : values.filter((value) => value !== muscle));
          }} /><span>{muscle}</span>
        </label>)}</div></fieldset>)}</div>
        {!primary.length && <p className="text-sm text-white/65">Choose at least one primary muscle to save.</p>}
        <div className="mapping-editor-actions"><Button variant="ghost" onClick={() => { if (editing) save(editing, true); }}>Reset to automatic</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={!primary.length} className="bg-[var(--lime)] text-[#11140d]" onClick={() => { if (editing) save(editing); }}>Save reviewed</Button></div>
      </DialogContent>
    </Dialog>
  </details>;
}
