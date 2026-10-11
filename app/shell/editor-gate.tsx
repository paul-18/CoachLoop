import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useLocalEditorLease } from "../pwa/use-local-editor-lease";
import { loadTrainingState } from "../persistence/training-storage";
import { downloadText } from "../views/shared";

function downloadSavedLog() {
  void loadTrainingState()
    .then(raw => downloadText(JSON.stringify(raw, null, 2), "coach-loop-saved-log.json", "application/json"))
    .catch(() => toast.error("Could not read the saved log"));
}

export function EditorLeaseNotice({ lease, onRetry }: { lease: "busy" | "unsupported" | "interrupted"; onRetry: () => void }) {
  if (lease === "busy") {
    return <div><p>Your log is open in another window.</p><Button className="mt-3 min-h-11" variant="outline" onClick={downloadSavedLog}>Download saved log</Button><p className="mt-2 max-w-sm text-sm leading-6 text-white/60">Finish your edits there, then close that Safari tab or Home Screen app. This window will open automatically when the log is available.</p><details className="mt-4 max-w-sm text-sm text-white/60"><summary className="cursor-pointer py-3">Still waiting?</summary><p>Close the other Coach Loop windows, including Safari and the installed app, then return here. You do not need to clear your training data.</p></details></div>;
  }
  const interrupted = lease === "interrupted";
  return <div className="max-w-sm text-center">
    <p>{interrupted ? "The editor lock stopped. Your saved log is still on this phone." : "This browser cannot safely coordinate multiple editors."}</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <Button className="min-h-11" onClick={onRetry}>Try again</Button>
      <Button className="min-h-11" variant="outline" onClick={downloadSavedLog}>Download saved log</Button>
    </div>
    <p className="mt-3 text-sm leading-6 text-white/60">{interrupted ? "Trying again reopens this log. It does not create a second copy and it does not delete anything." : "Try again after returning to the app. Downloading a copy does not delete the log on this phone."}</p>
  </div>;
}

export function EditorGate({ children }: { children: ReactNode }) {
  const { lease, retry } = useLocalEditorLease();
  if (lease === "checking") return <main className="grid min-h-dvh place-items-center bg-[#10120f] text-white">Opening your log…</main>;
  if (lease === "busy" || lease === "unsupported" || lease === "interrupted") {
    return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white"><EditorLeaseNotice lease={lease} onRetry={retry} /><Toaster position="top-center" /></main>;
  }
  return children;
}