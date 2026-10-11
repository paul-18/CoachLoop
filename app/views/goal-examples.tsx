import { Button } from "@/components/ui/button";
import type { Unit } from "../domain/training-types";

export function starterGoals(unit: Unit = "lb") {
  return unit === "kg"
    ? ["Bench press 100 kg", "Run a 5k under 30 minutes"]
    : ["Bench press 225 lb", "Run a 5k under 30 minutes"];
}

export const STARTER_GOALS = starterGoals("lb");

export function goalsAreStarter(goals: string[], unit: Unit = "lb") {
  const expected = starterGoals(unit);
  return goals.length === expected.length && goals.every((goal, index) => goal === expected[index]);
}

export const GOAL_EXAMPLES = [
  { label: "Bench", text: STARTER_GOALS[0] },
  { label: "5k", text: STARTER_GOALS[1] },
] as const;

/** Drafts only: the existing goal editor owns explicit Save and Cancel. */
export function GoalExamples({ unit = "lb", onChoose }: { unit?: Unit; onChoose: (text: string) => void }) {
  const examples = starterGoals(unit).map((text, index) => ({ label: index === 0 ? "Bench" : "5k", text }));
  return <details className="rounded-xl border border-white/10 p-3">
    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Need ideas? Example goals</summary>
    <p className="my-3 text-sm leading-6 text-white/60">Two starting goals. Pick one to edit, then Save. Nothing is added until you save.</p>
    <div className="space-y-3">{examples.map(example => <div key={example.label} className="rounded-xl bg-white/[0.025] p-3">
      <p className="mb-2 text-sm leading-6 text-white/70">{example.text}</p>
      <Button variant="outline" onClick={() => onChoose(example.text)}>Try {example.label.toLowerCase()} goal</Button>
    </div>)}</div>
  </details>;
}
