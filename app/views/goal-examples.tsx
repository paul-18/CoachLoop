import { Button } from "@/components/ui/button";

export const STARTER_GOALS = [
  "Bench press 225 lb",
  "Run a 5k under 30 minutes",
] as const;

export const GOAL_EXAMPLES = [
  { label: "Bench", text: STARTER_GOALS[0] },
  { label: "5k", text: STARTER_GOALS[1] },
] as const;

/** Drafts only: the existing goal editor owns explicit Save and Cancel. */
export function GoalExamples({ onChoose }: { onChoose: (text: string) => void }) {
  return <details className="rounded-xl border border-white/10 p-3">
    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Need ideas? Example goals</summary>
    <p className="my-3 text-sm leading-6 text-white/60">Two starting goals. Pick one to edit, then Save. Nothing is added until you save.</p>
    <div className="space-y-3">{GOAL_EXAMPLES.map(example => <div key={example.label} className="rounded-xl bg-white/[0.025] p-3">
      <p className="mb-2 text-sm leading-6 text-white/70">{example.text}</p>
      <Button variant="outline" onClick={() => onChoose(example.text)}>Try {example.label.toLowerCase()} goal</Button>
    </div>)}</div>
  </details>;
}
