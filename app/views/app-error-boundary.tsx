import { Component, type ReactNode } from "react";
import { loadTrainingState } from "../persistence/training-storage";
import { downloadText } from "./shared";
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="grid min-h-dvh place-items-center bg-[#10120f] p-6 text-white"><div className="max-w-md space-y-4"><h1>Coach Loop encountered a problem</h1><p>Your saved log has not been erased. Unsaved edits may not have committed. Download the saved log before restarting; do not clear browser storage.</p><button className="min-h-11 rounded border p-3" onClick={() => { void loadTrainingState().then(state => downloadText(JSON.stringify(state, null, 2), "coach-loop-recovery.json", "application/json")).catch(() => alert("Saved log could not be read. Keep browser storage and try again.")); }}>Download saved log</button><button className="min-h-11 rounded border p-3" onClick={() => window.location.reload()}>Restart</button></div></main>;
  }
}
