import type { TrainingState } from "../domain/training-types";
import { exampleFitlog } from "../interchange/fitlog";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = exampleFitlog;

function freshLog(state: TrainingState) {
  return !state.settings.welcomeChoice && !state.workouts.length && !state.goals.some(goal => goal.trim()) && !state.coachProfile.trim();
}

export function FirstSteps({ state, view, onStarter, onBlank, onRestore }: {
  state: TrainingState;
  view: MainView;
  onSetup?: (section: "coach-profile" | "training-goals" | "backup") => void;
  onCoach?: () => void;
  onSample?: () => void;
  onImport?: () => void;
  onStarter?: () => void;
  onBlank?: () => void;
  onRestore?: () => void;
}) {
  if (view === "settings" || state.workouts.some(workout => workout.status === "completed")) return null;
  if (!freshLog(state)) {
    if (view === "today" || view === "coach") return null;
    const note = view === "history"
      ? "Finished workouts are listed here. A plan stays on Today until you complete it."
      : "Charts use sets you mark complete.";
    return <p className="first-steps-elsewhere">{note}</p>;
  }
  if (view !== "today") return <p className="first-steps-elsewhere">Choose how to start on Today.</p>;
  return <section className="first-steps" aria-label="Welcome">
    <h2>Welcome to Coach Loop.</h2>
    <p>Your log stays on this phone. No account. When you want a plan, copy a brief into your AI chat, then paste its FITLOG reply back here.</p>
    <div className="first-steps-actions">
      <Button onClick={onStarter}>Start with an example</Button>
      <Button variant="outline" onClick={onBlank}>Start blank</Button>
    </div>
    <p className="first-steps-choice">The example adds two goals, a coach profile, and a Starter session. Nothing is logged until you train.</p>
    <Button variant="ghost" className="first-steps-restore" onClick={onRestore}>Restore backup</Button>
  </section>;
}
