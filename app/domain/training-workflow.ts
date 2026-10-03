import { makeExercise, makeSet, type WorkoutSession, type TrainingState, type TrainingSet, type Unit } from './training-types';
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

// Keep the original prescription and performed sets; replacements get their own identity.
export function substituteExercise(workout: WorkoutSession, id: string, name: string, unit: Unit): WorkoutSession {
  const original = workout.exercises.find(e => e.id === id);
  if (!original || !name.trim()) return workout;
  const remaining = original.sets.filter(s => !s.completed && !s.skipped);
  if (!remaining.length) return workout;
  const now = new Date().toISOString();
  const replacement = {...makeExercise(unit, original.restSec, name.trim()), substitutedFor: original.name,
    sets: remaining.map(s => makeSet(unit, {plannedReps:s.plannedReps, warmup:s.warmup})), updatedAt:now};
  const exercises = workout.exercises.map(e => e.id === id ? {...e, updatedAt:now, sets:e.sets.map(s => s.completed || s.skipped ? s : {...s, skipped:true, updatedAt:now})} : e);
  exercises.push(replacement);
  const order = [...workout.blockOrder];
  if (!order.some(b => b.id === id)) order.push({type:'exercise', id});
  order.splice(order.findIndex(b => b.id === id)+1, 0, {type:'exercise', id:replacement.id});
  return {...workout, exercises, blockOrder:order, updatedAt:now};
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
  return rows.reduce((sum, {activity:a}) => ({minutes:sum.minutes+(performedDuration(a)??0),distance:sum.distance+(performedDistance(a)??0),
    ascent:sum.ascent+(a.elevationM??0),ruckKgKm:sum.ruckKgKm+(a.activityType==='ruck' && a.ruckLoad!==null ? convertWeight(a.ruckLoad,a.ruckLoadUnit,'kg')*(performedDistance(a)??0):0)}),{minutes:0,distance:0,ascent:0,ruckKgKm:0});
}
export const validMeasurementDate = (date:string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date+'T12:00:00Z')) && new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
