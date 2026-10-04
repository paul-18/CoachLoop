import { useEffect, useRef, useState } from "react";
import { FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_BACKUP_BYTES } from "../persistence/backup-tools";
import { verifyBackup } from "../persistence/backup-verification";

export function BackupVerification() {
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<ReturnType<typeof verifyBackup> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { request.current++; }, []);
  const inspect = async (file: File) => {
    const id = ++request.current;
    setFilename(file.name); setResult(null); setError(""); setReading(true); setOpen(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 50 MB limit. Keep the file and your current log.");
      const checked = verifyBackup(await file.text());
      if (id === request.current) setResult(checked);
    } catch (failure) {
      if (id === request.current) setError(failure instanceof Error ? failure.message : "This file could not be read.");
    } finally { if (id === request.current) setReading(false); }
  };
  return <>
    <Button ref={trigger} variant="outline" className="mt-3 min-h-11" disabled={reading} onClick={() => input.current?.click()}><FileCheck /> Verify saved backup</Button>
    <input ref={input} type="file" accept="application/json,.json" aria-label="Choose saved backup to verify" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void inspect(file); }} />
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { request.current++; setReading(false); } }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#151713] text-white sm:max-w-lg">
        <DialogHeader><DialogTitle>Verify saved backup</DialogTitle><DialogDescription>Inspection only. Your current log stays unchanged.</DialogDescription></DialogHeader>
        <p className="break-all text-sm text-white/70">{filename}</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          {reading && <p>Reading and checking file…</p>}
          {error && <p className="text-amber-100">Could not verify: {error}</p>}
          {result && <><h3 className="font-bold">Readable, compatible backup</h3><p className="mt-2 text-sm text-white/70">Backup format {result.version}; compatible with this app after supported migrations. This does not prove the file matches your latest export or that every training value is correct.</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><dt>Sessions</dt><dd>{result.workouts}</dd><dt>Completed / planned</dt><dd>{result.completed} / {result.planned}</dd><dt>Active / skipped</dt><dd>{result.active} / {result.skipped}</dd><dt>Sets / activities</dt><dd>{result.sets} / {result.activities}</dd><dt>Session dates</dt><dd>{result.firstDate ? `${result.firstDate} to ${result.lastDate}` : "No sessions"}</dd><dt>Goals</dt><dd>{result.goals}</dd><dt>Coach profile</dt><dd>{result.profilePresent ? "Present" : "Empty"}</dd><dt>Bodyweight / waist</dt><dd>{result.bodyweightEntries} / {result.waistEntries}</dd><dt>Benchmarks</dt><dd>{result.benchmarks}</dd></dl>
          </>}
        </div>
        <Button variant="outline" onClick={() => { request.current++; setReading(false); setOpen(false); }}>Done</Button>
      </DialogContent>
    </Dialog>
  </>;
}
