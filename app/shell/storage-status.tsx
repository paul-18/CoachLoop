import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AppMark } from "../views/shared";
import { RecoveryDownloads } from "../views/recovery-downloads";

export function StorageStatus({ ready, loadError, updating }: { ready: boolean; loadError: boolean; updating: boolean }) {
  if (ready) return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white" role="status">{updating ? "Applying update… Keep this window open." : "Saving recovery changes… Keep this window open."}</main>;
  if (loadError) return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white"><div className="max-w-md space-y-4"><h1 className="text-xl font-black">Your local log could not be opened</h1><p className="text-sm leading-6 text-white/60">No data has been reset or uploaded. Close other Coach Loop tabs and try again. Don’t clear browser storage; download your recovery data first.</p><Button onClick={() => window.location.reload()}>Try again</Button><RecoveryDownloads /><Toaster position="top-center" /></div></main>;
  return <main className="grid min-h-dvh place-items-center bg-[#10120f] text-white"><div className="flex items-center gap-4"><AppMark compact /><div><p className="font-black">Opening Coach Loop</p><p className="text-sm text-white/35">Loading your local training log…</p></div></div></main>;
}
