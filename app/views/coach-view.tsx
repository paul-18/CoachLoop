"use client";

import { useState } from "react";
import { Clipboard, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildQuickTrainingExtract, type QuickTrainingRange } from "../interchange/coach-export";
import { FITLOG_INSTRUCTIONS } from "../interchange/fitlog";
import type { TrainingState } from "../domain/training-types";
import { copyText } from "./shared";

export function CoachView({ state, onBuild, onImport, onEditGoals }: { state: TrainingState; onBuild: () => void; onImport: () => void; onEditGoals?: () => void }) {
  const [range, setRange] = useState<QuickTrainingRange>("last");
  const [manualCopy, setManualCopy] = useState<{ title: string; text: string } | null>(null);
  const copy = async (content: string, success: string) => {
    if (await copyText(content)) {
      toast.success(success);
    } else {
      setManualCopy({ title: success.replace(" copied", ""), text: content });
      toast.error("Automatic copy was blocked. Select the text to copy it.");
    }
  };
  return (
    <div className="page-stack">
      <section className="topline"><h1>Coach</h1></section>
      <section className="coach-goals"><div className="flex items-center justify-between gap-3"><h2>Your priorities</h2>{onEditGoals && <Button variant="ghost" onClick={onEditGoals}>Edit goals</Button>}</div>{state.goals.some(goal => goal.trim()) ? <ol>{state.goals.filter(goal => goal.trim()).map((goal, index) => <li key={index}><span>{index + 1}</span><p>{goal}</p></li>)}</ol> : <p>Add your goals in Settings, with the most important first.</p>}<p className="coach-goals-note">Edit and reorder in Settings → Training goals. Chat with your AI outside the app; nothing is sent automatically.</p></section>
      <section className="coach-action-row"><div><h2>Ask for your next workout</h2><p>Copy your recent training and goals into your preferred AI chat.</p></div><Button onClick={onBuild} className="bg-[var(--lime)] font-black text-[#11140d]"><Copy /> Build coach brief</Button></section>
      <section className="coach-action-row"><div><h2>Bring the workout back</h2><p>Review the FITLOG plan, then start or save it.</p></div><Button onClick={onImport} variant="outline" className="border-white/12 text-white"><Clipboard /> Paste or save workout</Button></section>
      <section className="coach-quick-copy" aria-label="Quick copy for an existing chat">
        <h2>Already in a chat?</h2>
        <div className="coach-quick-row"><div><strong>FITLOG format</strong><small>Only the import layout and instructions</small></div><Button type="button" variant="outline" onClick={() => copy(FITLOG_INSTRUCTIONS, "FITLOG format copied")}><Copy /> Copy format</Button></div>
        <div className="coach-quick-row"><div><strong>Recent training</strong><small>Completed sessions and logged results only</small></div><div className="coach-quick-controls"><NativeSelect value={range} onChange={(event) => setRange(event.target.value as QuickTrainingRange)} aria-label="Training to copy"><NativeSelectOption value="last">Last workout</NativeSelectOption><NativeSelectOption value="today">Today</NativeSelectOption><NativeSelectOption value="two-days">Last 2 days</NativeSelectOption></NativeSelect><Button type="button" variant="outline" onClick={() => copy(buildQuickTrainingExtract(state, range), "Training copied")}><Copy /> Copy</Button></div></div>
      </section>
      <Dialog open={Boolean(manualCopy)} onOpenChange={(open) => { if (!open) setManualCopy(null); }}><DialogContent className="max-h-[85dvh] border-white/10 bg-[#151713] text-white sm:max-w-lg"><DialogHeader><DialogTitle>{manualCopy?.title}</DialogTitle><DialogDescription className="text-white/55">Select and copy this text into your existing chat.</DialogDescription></DialogHeader><pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-5 select-text">{manualCopy?.text}</pre></DialogContent></Dialog>
    </div>
  );
}
