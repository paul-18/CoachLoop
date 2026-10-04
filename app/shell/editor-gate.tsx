import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useLocalEditorLease } from "../pwa/use-local-editor-lease";
import { loadTrainingState } from "../persistence/training-storage";
import { downloadText } from "../views/shared";

export function EditorGate({ children }: { children: ReactNode }) {
  const lease = useLocalEditorLease();
  if (lease === "checking") return <main className="grid min-h-dvh place-items-center bg-[#10120f] text-white">Opening your log…</main>;
  if (lease === "busy") return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white"><div><p>Your log is open in another window.</p><Button className="mt-3" variant="outline" onClick={() => void loadTrainingState().then(raw => downloadText(JSON.stringify(raw, null, 2), "coach-loop-saved-log.json", "application/json")).catch(() => toast.error("Could not read the saved log"))}>Download saved log</Button><p className="mt-2 max-w-sm text-sm leading-6 text-white/60">Finish your edits there, then close that Safari tab or Home Screen app. This window will open automatically when the log is available.</p><details className="mt-4 max-w-sm text-sm text-white/60"><summary className="cursor-pointer py-3">Still waiting?</summary><p>Close the other Coach Loop windows, including Safari and the installed app, then return here. You do not need to clear your training data.</p></details><Toaster position="top-center" /></div></main>;
  if (lease === "unsupported") return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white">This browser cannot safely coordinate multiple editors.<Button onClick={() => void loadTrainingState().then(raw => downloadText(JSON.stringify(raw, null, 2), "coach-loop-saved-log.json", "application/json")).catch(() => toast.error("Could not read the saved log"))}>Download saved log</Button><Toaster position="top-center" /></main>;
  return children;
}
