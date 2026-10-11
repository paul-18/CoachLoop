import { Button } from "@/components/ui/button";
import type { Unit } from "../domain/training-types";
import { samplePlan } from "./starter-plan";
import { countLabel } from "./shared";

export function SampleWorkoutPreview({ unit, onClose, onAdd }: { unit: Unit; onClose: () => void; onAdd?: () => void }) {
  const workout = samplePlan(unit);
  return <section className="starter-guide" aria-label="Sample workout">
    <h2>Sample workout</h2>
    <p>This is an example plan, not a finished workout. It is not in your History. Nothing is saved unless you add it to your log.</p>
    <p>The short bike block is part of the example. It is listed here so you can read it. It is not opened as a workout to fill in.</p>
    <ol>
      {workout.blockOrder.map((block) => {
        if (block.type === "activity") {
          const activity = workout.cardio.find((item) => item.id === block.id);
          if (!activity) return null;
          return <li key={block.id}><strong>{activity.name}</strong> — example {activity.activityType}{activity.plannedDurationMin ? `, ${activity.plannedDurationMin} min` : ""}</li>;
        }
        const exercise = workout.exercises.find((item) => item.id === block.id);
        if (!exercise) return null;
        return <li key={block.id}><strong>{exercise.name}</strong> — {countLabel(exercise.sets.length, "planned set")}</li>;
      })}
    </ol>
    <div className="first-steps-actions">
      <Button type="button" variant="outline" onClick={onClose}>Back</Button>
      {onAdd && <Button type="button" onClick={onAdd}>Add this plan to my log</Button>}
    </div>
  </section>;
}
