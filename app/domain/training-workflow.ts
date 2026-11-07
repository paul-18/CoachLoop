import { makeExercise, makeSet, uid, type WorkoutSession, type TrainingState, type TrainingSet, type Unit } from './training-types';
import { normalizedBlockOrder } from "./block-order";
import { segmentMeasure } from "./activity-segments";
import { hasCompletedActivityWork } from "./completion";
import { exerciseIdentity, performedDistance, performedDuration, convertWeight } from './training-metrics';

/** Copy a result while retaining the destination set's displayed unit. */
export function matchedPreviousSetValues(previous: TrainingSet, target: TrainingSet): Partial<TrainingSet> {
  const weight = previous.actualWeight ?? previous.plannedWeight;
  return {
    actualReps: previous.actualReps || previous.plannedReps,
    actualWeight: weight === null ? null : Number(convertWeight(weight, previous.unit, target.unit).toFixed(4)),
    rpe: previous.rpe,
    rir: previous.rir,
    loadType: previous.loadType,
    weightMode: previous.weightMode,
  };
}

export function moveBlockLater(workout: WorkoutSession, id: string): WorkoutSession {
  const order = [...workout.blockOrder];
  for (const e of workout.exercises) if (!order.some(b => b.id === e.id)) order.push({type:'exercise', id:e.id});
  for (const e of workout.cardio) if (!order.some(b => b.id === e.id)) order.push({type:'activity', id:e.id});
  const block = order.find(b => b.id === id);
  return block ? {...workout, blockOrder:[...order.filter(b => b.id !== id), block], updatedAt:new Date().toISOString()} : workout;
}

/** Move a block one step up or down in the visible (normalized) order.
 *  Repairs missing entries exactly as moveBlockLater does, then swaps the
 *  entry with its adjacent neighbor in the normalized order. The
 *  exercises[]/cardio[] arrays are never reordered. At either end the
 *  workout is returned unchanged (menus disable the button there). */
export function moveBlock(workout: WorkoutSession, id: string, direction: "up" | "down"): WorkoutSession {
  const order = [...workout.blockOrder];
  for (const e of workout.exercises) if (!order.some(b => b.id === e.id)) order.push({type:'exercise', id:e.id});
  for (const e of workout.cardio) if (!order.some(b => b.id === e.id)) order.push({type:'activity', id:e.id});
  const seen = new Set<string>();
  const normalized = order.filter(b => {
    const exists = b.type === "exercise" ? workout.exercises.some(e => e.id === b.id) : workout.cardio.some(c => c.id === b.id);
    if (!exists || seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
  const index = normalized.findIndex(b => b.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= normalized.length) return workout;
  const next = [...normalized];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return {...workout, blockOrder: next, updatedAt: new Date().toISOString()};
}

// Keep the original prescription and performed sets; replacements get their own identity.
export function substituteExercise(workout: WorkoutSession, id: string, name: string, unit: Unit): WorkoutSession {
  const original = workout.exercises.find(e => e.id === id);
  if (!original || !name.trim()) return workout;
  const remaining = original.sets.filter(s => !s.completed && !s.skipped);
  if (!remaining.length) return workout;
  const now = new Date().toISOString();
  const replacement = {...makeExercise(unit, original.restSec, name.trim()), substitutedFor: original.name,
    sets: remaining.map(s => makeSet(s.unit ?? unit, {plannedReps:s.plannedReps, plannedRpe:s.plannedRpe, plannedRir:s.plannedRir, warmup:s.warmup})), updatedAt:now};
  const exercises = workout.exercises.map(e => e.id === id ? {...e, updatedAt:now, sets:e.sets.map(s => s.completed || s.skipped ? s : {...s, skipped:true, updatedAt:now})} : e);
  exercises.push(replacement);
  const order = [...workout.blockOrder];
  if (!order.some(b => b.id === id)) order.push({type:'exercise', id});
  order.splice(order.findIndex(b => b.id === id)+1, 0, {type:'exercise', id:replacement.id});
  return {...workout, exercises, blockOrder:order, updatedAt:now};
}

/** Pair an exercise with the next exercise in blockOrder as a superset, or unlink an exercise from its superset. */
export function linkSupersetWithNext(workout: WorkoutSession, exerciseId: string): WorkoutSession {
  const order = normalizedBlockOrder(workout).filter(b => b.type === "exercise");
  const idx = order.findIndex(b => b.id === exerciseId);
  const nextBlock = idx >= 0 ? order[idx + 1] : undefined;
  if (!nextBlock) return workout;
  const current = workout.exercises.find(e => e.id === exerciseId);
  const nextEx = workout.exercises.find(e => e.id === nextBlock.id);
  if (!current || !nextEx) return workout;
  const now = new Date().toISOString();
  const groupId = current.supersetId ?? nextEx.supersetId ?? uid("superset");
  return {
    ...workout,
    updatedAt: now,
    exercises: workout.exercises.map(e => (e.id === current.id || e.id === nextEx.id) ? { ...e, supersetId: groupId, updatedAt: now } : e),
  };
}

export function unlinkSuperset(workout: WorkoutSession, exerciseId: string): WorkoutSession {
  const target = workout.exercises.find(e => e.id === exerciseId);
  if (!target?.supersetId) return workout;
  const groupId = target.supersetId;
  const remainingInGroup = workout.exercises.filter(e => e.id !== exerciseId && e.supersetId === groupId);
  const cleanAll = remainingInGroup.length < 2;
  const now = new Date().toISOString();
  return {
    ...workout,
    updatedAt: now,
    exercises: workout.exercises.map(e => {
      if (e.id === exerciseId || (cleanAll && e.supersetId === groupId)) {
        const copy = { ...e, updatedAt: now };
        delete copy.supersetId;
        return copy;
      }
      return e;
    }),
  };
}
export function incrementKey(name: string, unit: Unit, mode: string, aliases: TrainingState['exerciseAliases']) {
  return `${exerciseIdentity(name, aliases)}|${unit}|${mode}`;
}
export const readableNumber = (n:number) => Number(n.toFixed(2)).toLocaleString();
export function activityRows(state:TrainingState, type?:string, from='', to='9999-12-31') {
  return state.workouts.filter(w => w.status==='completed' && w.date>=from && w.date<=to)
    .flatMap(workout => workout.cardio.filter(a => hasCompletedActivityWork(a) && (!type || a.activityType===type)).map(activity => ({workout,activity})))
    .sort((a,b)=>b.workout.date.localeCompare(a.workout.date));
}
export function activityTotals(rows:ReturnType<typeof activityRows>) {
  return rows.reduce((sum, {activity:a}) => {
    const duration = a.segments?.length ? segmentMeasure(a, "duration") : null;
    const distance = a.segments?.length ? segmentMeasure(a, "distance") : null;
    return {minutes:sum.minutes+(performedDuration(a)??0),distance:sum.distance+(performedDistance(a)??0),
      ascent:sum.ascent+(a.elevationM??0),ruckKgKm:sum.ruckKgKm+(a.activityType==='ruck' && a.ruckLoad!==null ? convertWeight(a.ruckLoad,a.ruckLoadUnit,'kg')*(performedDistance(a)??0):0),
      minutesIncomplete: sum.minutesIncomplete || (duration !== null && duration.done > 0 && !duration.fullyRecorded) || (duration === null && performedDuration(a) === null),
      distanceIncomplete: sum.distanceIncomplete || (distance !== null && distance.done > 0 && !distance.fullyRecorded) || (distance === null && performedDistance(a) === null)};
  },{minutes:0,distance:0,ascent:0,ruckKgKm:0,minutesIncomplete:false,distanceIncomplete:false});
}
export const validMeasurementDate = (date:string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date+'T12:00:00Z')) && new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
