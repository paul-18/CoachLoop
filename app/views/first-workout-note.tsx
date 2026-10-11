import { Button } from "@/components/ui/button";

export function FirstWorkoutNote({ onDismiss }: { onDismiss?: () => void }) {
  return <section className="first-workout-note" role="status">
    <p>Saved on this phone. Next: back up once from Settings, or ask your AI for a plan.</p>
    <Button type="button" variant="ghost" onClick={onDismiss}>Got it</Button>
  </section>;
}
