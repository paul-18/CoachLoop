import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readRecoveryData, type RecoveryData } from "../persistence/recovery-export";
import { localDate } from "../domain/training-types";
import { downloadText } from "./shared";

/** Accessible even when the saved log cannot pass validation. Never resets data. */
export function RecoveryDownloads() {
  const [data, setData] = useState<RecoveryData | null>(null);
  useEffect(() => {
    let disposed = false;
    void readRecoveryData().then(result => { if (!disposed) setData(result); });
    return () => { disposed = true; };
  }, []);
  if (!data) return <p role="status">Reading saved recovery data…</p>;
  const download = (value: unknown, name: string) => {
    try { downloadText(JSON.stringify(value, null, 2), name, "application/json"); }
    catch { toast.error("This recovery file could not be downloaded. Keep browser storage and try again."); }
  };
  return <section className="space-y-3" aria-label="Recovery downloads">
    <Button variant="outline" onClick={() => download(data, `coach-loop-recovery-bundle-${localDate()}.json`)}>Download all recovery data</Button>
    {data.rawState !== null && <Button variant="outline" onClick={() => download(data.rawState, "coach-loop-saved-log.json")}>Download saved log separately</Button>}
    {data.errors.map(error => <p key={error} className="text-sm text-amber-200" role="status">{error}. Other readable data is included.</p>)}
    {data.recoveryCopies.length > 0 && <div className="space-y-2"><h2 className="font-bold">Download a recovery checkpoint</h2><p className="text-sm text-white/60">These individual JSON files can be reviewed with Settings → Restore JSON backup on a working installation. The complete bundle is for diagnosis, not direct restore. Save the files privately; do not upload them to GitHub.</p>{data.recoveryCopies.map(copy => <Button key={copy.id} className="h-auto min-h-11 whitespace-normal text-left" variant="outline" onClick={() => download(copy.state, `coach-loop-checkpoint-${copy.id}.json`)}>{new Date(copy.createdAt).toLocaleString()} · {copy.reason}</Button>)}</div>}
  </section>;
}
