import type { TrainingState } from "../domain/training-types";
import { exampleFitlog } from "../interchange/fitlog";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = exampleFitlog;

export function welcomePending(state: TrainingState) {
  return !state.settings.welcomeChoice && !state.workouts.length && !state.goals.some(goal => goal.trim()) && !state.coachProfile.trim();
}

function freshLog(state: TrainingState) {
  return welcomePending(state);
}

export function FirstSteps({ state, view, onStarter, onBlank, onRestore, onDemo, onSample }: {
  state: TrainingState;
  view: MainView;
  onSetup?: (section: "coach-profile" | "training-goals" | "backup") => void;
  onCoach?: () => void;
  onSample?: () => void;
  onImport?: () => void;
  onStarter?: () => void;
  onBlank?: () => void;
  onRestore?: () => void;
  onDemo?: () => void;
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
    <p>Coach Loop is a private workout log. What you finish stays on this phone. There is no account, and no AI inside the app.</p>
    <p>Log a session on Today. When you want a plan, ask your own AI chat, then paste its FITLOG reply here.</p>
    <div className="first-steps-actions">
      <Button onClick={onDemo}>Explore demo</Button>
      <Button variant="outline" onClick={onSample}>See a sample workout</Button>
    </div>
    <p className="first-steps-choice">Explore demo opens a recent sample log in this window. See a sample workout shows one example plan. Neither is added to your History.</p>
    <h3>Set up my log</h3>
    <div className="first-steps-actions">
      <Button variant="outline" onClick={onStarter}>Use example goals</Button>
      <Button variant="outline" onClick={onBlank}>Start blank</Button>
    </div>
    <p className="first-steps-choice">Use example goals adds two goals and a coach profile. It does not create a workout. Start blank leaves those empty, and you can come back. Nothing is logged until you train.</p>
    <Button variant="ghost" className="first-steps-restore" onClick={onRestore}>Restore backup</Button>
  </section>;
}
