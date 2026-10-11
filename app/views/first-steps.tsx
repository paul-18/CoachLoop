import type { TrainingState } from "../domain/training-types";
import { exampleFitlog } from "../interchange/fitlog";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = exampleFitlog;

function freshLog(state: TrainingState) {
  return !state.settings.welcomeChoice && !state.workouts.length && !state.goals.some(goal => goal.trim()) && !state.coachProfile.trim();
}

export function FirstSteps({ state, view, onStarter, onBlank }: {
  state: TrainingState;
  view: MainView;
  onSetup?: (section: "coach-profile" | "training-goals") => void;
  onCoach?: () => void;
  onSample?: () => void;
  onImport?: () => void;
  onStarter?: () => void;
  onBlank?: () => void;
}) {
  if (view === "settings" || state.workouts.some(workout => workout.status === "completed")) return null;
  if (!freshLog(state)) {
    if (view === "today") return null;
    const note = view === "history"
      ? "Completed workouts show up here. Start on Today."
      : view === "progress"
        ? "Charts use completed results. Start on Today."
        : "Ask for a plan from Today once a goal and profile are saved.";
    return <p className="first-steps-elsewhere">{note}</p>;
  }
  if (view !== "today") return <p className="first-steps-elsewhere">Start on Today.</p>;
  return <section className="first-steps" aria-label="Welcome">
    <h2>Welcome to Coach Loop.</h2>
    <p>Everything stays on this phone. No account, no cloud.</p>
    <div className="first-steps-actions">
      <Button onClick={onStarter}>Try the starter plan</Button>
      <Button variant="outline" onClick={onBlank}>Start blank</Button>
    </div>
    <p className="first-steps-choice"><strong>Try the starter plan</strong> adds a 225 lb bench goal, a 5k under 30 minutes, a coach profile, and an example workout. All editable.</p>
    <p className="first-steps-choice"><strong>Start blank</strong> leaves the log empty.</p>
  </section>;
}
