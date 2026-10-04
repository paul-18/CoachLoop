import { Button } from "@/components/ui/button";

export const GOAL_EXAMPLES = [
  { label: "Consistency", text: "Train consistently for the next 8 weeks. Choose a realistic number of sessions per week for my schedule." },
  { label: "Strength", text: "Improve strength in my main lifts with controlled technique. Set a realistic target from my current ability." },
  { label: "Cardio", text: "Build aerobic fitness so I can sustain comfortable activity longer. Choose a target duration from my current fitness." },
] as const;

/** Drafts only: the existing goal editor owns explicit Save and Cancel. */
export function GoalExamples({ onChoose }: { onChoose: (text: string) => void }) {
  return <details className="rounded-xl border border-white/10 p-3">
    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Need ideas? Example goals</summary>
    <p className="my-3 text-sm leading-6 text-white/55">Choose an example to edit. Pick a target that fits you, then Save. Nothing is added automatically; existing goals stay in place.</p>
    <div className="space-y-3">{GOAL_EXAMPLES.map(example => <div key={example.label} className="rounded-xl bg-white/[0.025] p-3">
      <p className="mb-2 text-sm leading-6 text-white/70">{example.text}</p>
      <Button variant="outline" onClick={() => onChoose(example.text)}>Try {example.label.toLowerCase()} goal</Button>
    </div>)}</div>
  </details>;
}
