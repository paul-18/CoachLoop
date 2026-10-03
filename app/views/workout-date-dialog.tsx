"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { localDate, type WorkoutSession } from "../domain/training-types";
import { changeWorkoutDate } from "../domain/plan-review";

export function WorkoutDateDialog({ workout, open, onOpenChange, onUpdate }: { workout: WorkoutSession; open: boolean; onOpenChange: (open: boolean) => void; onUpdate: (workout: WorkoutSession) => void }) {
  const [date, setDate] = useState(workout.date);
  const save = () => {
    try { onUpdate(changeWorkoutDate(workout, date)); }
    catch { toast.error("Choose a valid workout date up to today"); return; }
    onOpenChange(false);
    toast.success("Workout date updated");
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="border-white/10 bg-[#151713] text-white sm:max-w-sm"><DialogHeader><DialogTitle>Change workout date</DialogTitle><DialogDescription className="text-white/70">Choose the day you trained. History, the calendar and weekly totals use this date.</DialogDescription></DialogHeader><label className="field-label">Workout date<Input type="date" max={workout.status === "planned" ? undefined : localDate()} value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-w-0 border-white/10 bg-black/20" /></label><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} className="bg-[var(--lime)] text-[#11140d]">Save date</Button></DialogFooter></DialogContent></Dialog>;
}
