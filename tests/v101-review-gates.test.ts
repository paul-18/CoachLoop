import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultState, makeCardio, makeSet, makeWorkout } from "../app/domain/training-types";
import { prepareLoadedState } from "../app/persistence/migrations";
import { HistoryView } from "../app/views/history-view";

function historyMarkup(set: ReturnType<typeof makeSet>) {
  const state = defaultState();
  const workout = makeWorkout("lb", 40);
  workout.status = "completed";
  workout.completedAt = "2026-10-01T12:00:00.000Z";
  workout.exercises[0].sets = [set];
  state.workouts = [workout];
  return renderToStaticMarkup(createElement(HistoryView, {
    state,
    onEdit: () => {},
    onRepeat: () => {},
    onReplan: () => {},
    onDelete: () => {},
  }));
}

test("History does not call an ordinary completed-as-planned set Suggested", () => {
  const accepted = makeSet("lb", {
    completed: true,
    completedAsPlanned: true,
    plannedReps: "5",
    plannedWeight: 135,
    actualReps: "5",
    actualWeight: 135,
    loadType: "weighted",
    weightMode: "total",
  });
  const typed = makeSet("lb", {
    completed: true,
    completedAsPlanned: false,
    plannedReps: "5",
    plannedWeight: 135,
    actualReps: "5",
    actualWeight: 135,
    loadType: "weighted",
    weightMode: "total",
  });
  assert.doesNotMatch(historyMarkup(accepted), /Suggested/);
  assert.doesNotMatch(historyMarkup(typed), /Suggested/);
});

test("an older activity without skipped still loads, and an explicit skip is kept", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 30);
  workout.status = "completed";
  workout.completedAt = "2026-10-01T12:00:00.000Z";
  const activity = makeCardio("bike", "Easy bike");
  workout.cardio = [activity];
  workout.blockOrder = [...workout.blockOrder, { type: "activity", id: activity.id }];
  state.workouts = [workout];
  const legacy = JSON.parse(JSON.stringify(state)) as { workouts: Array<{ cardio: Array<Record<string, unknown>> }> };
  delete legacy.workouts[0].cardio[0].skipped;
  const loaded = prepareLoadedState(legacy);
  assert.equal(loaded.workouts[0]?.cardio[0]?.skipped, undefined);
  assert.equal(loaded.workouts[0]?.cardio[0]?.name, "Easy bike");
  assert.equal(loaded.workouts[0]?.exercises[0]?.name, workout.exercises[0]?.name);
  assert.equal(loaded.goals.length, state.goals.length);
  const marked = structuredClone(legacy);
  marked.workouts[0].cardio[0].skipped = true;
  assert.equal(prepareLoadedState(marked).workouts[0]?.cardio[0]?.skipped, true);
  const invalid = structuredClone(legacy);
  invalid.workouts[0].cardio[0].skipped = "yes";
  assert.throws(() => prepareLoadedState(invalid));
});
