import type { TrainingState } from "../domain/training-types";
import { exampleFitlog } from "../interchange/fitlog";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = exampleFitlog;

export function FirstSteps({ state, view, onSetup, onCoach, onSample, onImport }: {
  state: TrainingState;
  view: MainView;
  onSetup: (section: "coach-profile" | "training-goals") => void;
  onCoach: () => void;
  onSample: () => void;
  onImport?: () => void;
}) {
  if (view === "settings" || state.workouts.some(workout => workout.status === "completed")) return null;
  if (view !== "today") {
    const note = view === "history"
      ? "Completed workouts show up here. Start on Today."
      : view === "progress"
        ? "Charts use completed results. Start on Today."
        : "Copy a brief when you want a plan. You can also start from Today.";
    return <p className="first-steps-elsewhere">{note}</p>;
  }
  const profileReady = Boolean(state.coachProfile.trim());
  const goalsReady = state.goals.some(goal => goal.trim());
  return <section className="first-steps" aria-label="Start here">
    <p className="eyebrow">Start here</p>
    <h2>One workout at a time</h2>
    <p>Paste a plan from your AI, or open a short example and review the list. Nothing is saved until you choose to start or save it.</p>
    <div className="first-steps-actions">
      <Button onClick={onSample}>Try a safe example</Button>
      {onImport && <Button variant="outline" onClick={onImport}>Paste a workout</Button>}
      <Button variant="outline" onClick={onCoach}>Ask your AI</Button>
    </div>
    <details className="first-steps-how">
      <summary>How this works</summary>
      <ol>
        <li><span className="step-number">1</span><div><strong>Optional: profile and goals{profileReady && goalsReady ? " · Added" : ""}</strong><small>Rank your training goals when you want the AI brief to know them. Nothing is required before the first workout.</small></div><Button variant="outline" onClick={() => onSetup("training-goals")}>{goalsReady ? "Edit goals" : "Add goals"}</Button></li>
        <li><span className="step-number">2</span><div><strong>Ask any AI you choose</strong><small>Build a brief, paste it into a new chat, and ask for one FITLOG block.</small></div></li>
        <li><span className="step-number">3</span><div><strong>Review the list, then log</strong><small>Planned numbers are targets. Enter what you actually did, then Finish workout. Or skip the AI and use Blank workout or Quick log below.</small></div></li>
      </ol>
      <p>On iPhone, add this app from Safari’s Share → Add to Home Screen. The log stays on this phone. In Settings, use Share backup to keep a copy in Files.</p>
      <small className="first-steps-note">This note goes away after your first completed workout.</small>
    </details>
  </section>;
}