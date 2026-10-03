import assert from "node:assert/strict";
import test from "node:test";
import { defaultState, makeWorkout, makeCardio, makeSet } from "../app/domain/training-types";
import { validateSyncedState } from "../app/persistence/training-validation";
import { parseBackup, recoverDeleted, backupChanges } from "../app/persistence/backup-tools";
import { prepareLoadedState } from "../app/persistence/migrations";
import { mergeRestoredState } from "../app/persistence/cloud-sync";
import { parseFitlog } from "../app/interchange/fitlog";
import { completedSetValues } from "../app/domain/completion";
import { estimatedOneRepMax } from "../app/domain/training-metrics";
import { workoutToText } from "../app/interchange/coach-export";
import { trainingCsvRows } from "../app/interchange/training-csv";
import { weeklyTrainingSignals } from "../app/domain/training-snapshot";
import { localDateDaysEarlier } from "../app/domain/training-insights";
const block = (text: string) => `[FITLOG:1]\nWORKOUT|QC|2026-10-02\n${text}\n[/FITLOG]`;

test("backup rejects newer schemas, invalid timestamps, broken references and duplicate IDs", () => {
  const state = defaultState(), w = makeWorkout("lb", 120); state.workouts = [w];
  for (const version of [0, 3, 999]) assert.throws(() => parseBackup(JSON.stringify({ ...state, evidenceVersion: version })), /version/);
  assert.throws(() => prepareLoadedState({ ...state, evidenceVersion: 999 }));
  assert.throws(() => parseBackup(JSON.stringify({ ...state, goalsUpdatedAt: "not-a-date" })), /invalid data/);
  assert.throws(() => validateSyncedState({ ...state, activeWorkoutId: "missing" }), /reference/);
  assert.throws(() => validateSyncedState({ ...state, workouts: [w, w] }), /Duplicate/);
  assert.throws(() => validateSyncedState({ ...state, workouts: [{ ...w, blockOrder: [{ type: "exercise", id: "missing" }] }] }), /reference/);
});
test("corrupt backup and invalid measurement do not silently become empty or lose rows", () => {
  assert.throws(() => parseBackup('{"version":1'), /corrupt/);
  assert.throws(() => parseBackup('{}'), /Coach Loop/);
  assert.throws(() => parseBackup(JSON.stringify({ ...defaultState(), bodyweightEntries: [{ id: "bad", date: "2026-10-02", weight: -10, unit: "lb", updatedAt: new Date().toISOString() }] })), /bodyweight/);
  const state=defaultState(),w=makeWorkout("lb",120),c=makeCardio("run");c.actualDurationMin=-30;w.cardio=[c];state.workouts=[w];assert.throws(()=>validateSyncedState(state));
});
test("valid offset timestamps normalize before newest-record merge", () => {
  const s = defaultState(); s.goalsUpdatedAt = "2026-10-02T10:00:00-03:00";
  assert.equal(validateSyncedState(s).goalsUpdatedAt, "2026-10-02T13:00:00.000Z");
});
test("ordinary restore respects deletes; explicit recovery restores deleted evidence with fresh IDs", () => {
  const backup=defaultState(),w=makeWorkout("lb",120); w.status="completed";w.completedAt=new Date().toISOString();w.exercises[0].sets[0]=makeSet("lb",{completed:true,actualReps:"6",actualWeight:100});backup.workouts=[w];
  const current=defaultState();current.deletedWorkoutIds=[w.id];
  assert.equal(mergeRestoredState(current,backup).workouts.length,0);
  const merged=mergeRestoredState(current,recoverDeleted(current,backup));assert.equal(merged.workouts.length,1);assert.notEqual(merged.workouts[0].id,w.id);assert.equal(merged.workouts[0].exercises[0].sets[0].actualWeight,100);assert.ok(merged.deletedWorkoutIds.includes(w.id));validateSyncedState(merged);
});
test("explicit recovery restores deleted nested blocks and sets without removing tombstones",()=>{
  const backup=defaultState(),w=makeWorkout("lb",120);w.status="completed";backup.workouts=[w];
  const current=structuredClone(backup), e=current.workouts[0].exercises[0], id=e.sets[0].id;e.deletedSetIds=[id];e.sets=e.sets.slice(1);
  const merged=mergeRestoredState(current,recoverDeleted(current,backup));assert.equal(merged.workouts[0].exercises[0].sets.length,w.exercises[0].sets.length);assert.ok(merged.workouts[0].exercises[0].deletedSetIds?.includes(id));
});
test("restore preview exposes changed existing results and preferences",()=>{
  const a=defaultState(),w=makeWorkout("lb",120);a.workouts=[w];const b=structuredClone(a);b.workouts[0].notes="Correction";b.goals=["Bench"];
  const changes=backupChanges(a,b);assert.equal(changes.changed,1);assert.ok(changes.sections.includes("goals"));
});
test("stale same-ID benchmark attempt cannot overwrite a newer correction",()=>{
  const a=defaultState();a.benchmarks=[{id:"bench",name:"Test",protocol:"",result:"new",testedOn:"2026-10-02",retestDays:null,updatedAt:"2026-10-03T00:00:00.000Z",attempts:[{id:"attempt",date:"2026-10-02",result:"new",protocol:"",updatedAt:"2026-10-03T00:00:00.000Z"}]}];const b=structuredClone(a);b.benchmarks![0].result="old";b.benchmarks![0].attempts![0].result="old";b.benchmarks![0].attempts![0].updatedAt="2026-10-02T00:00:00.000Z";
  assert.equal(mergeRestoredState(a,b).benchmarks![0].attempts![0].result,"new");
});
test("new FITLOG rejects nonsense reps, unknown explicit types and contradictory ruck fields",()=>{
  for (const reps of ["banana","0","-5","6.5","8-6"]) assert.throws(()=>parseFitlog(block(`EXERCISE|Bench\nSET|${reps}|100 lb|RPE 7`),"lb",{}),/rep target/);
  for(const type of ["brunch","waterr_polo"])assert.throws(()=>parseFitlog(block(`CARDIO|Test\nTYPE|${type}\nDURATION|30`),"lb",{}),/TYPE/);
  assert.throws(()=>parseFitlog(block("CARDIO|Water polo\nTYPE|water_polo\nRUCKLOAD|40 lb"),"lb",{}),/RUCKLOAD/);
  const w=parseFitlog(block("EXERCISE|Bench\nSET|6-8|100 lb|RIR 2|WARMUP"),"lb",{});assert.equal(w.exercises[0].sets[0].warmup,true);
});
test("completion requires positive exact actual reps, including non-range targets",()=>{
  assert.throws(()=>completedSetValues(makeSet("lb",{actualReps:"banana"})),/reps/);
  assert.throws(()=>completedSetValues(makeSet("lb",{plannedReps:"banana"})),/reps/);
  assert.equal(completedSetValues(makeSet("lb",{plannedReps:"6",plannedWeight:100})).actualReps,"6");
});
test("AI export preserves actual cardio after its old prescription changes",()=>{
  const w=makeWorkout("lb",120),c=makeCardio("run");w.status="completed";c.completed=true;c.completedAsPlanned=true;c.actualDurationMin=30;c.plannedDurationMin=60;c.actualDistanceKm=5;c.plannedDistanceKm=10;w.cardio=[c];
  const text=workoutToText(w);assert.match(text,/Duration: 30 min/);assert.match(text,/Distance: 5 km/);assert.doesNotMatch(text,/Duration: 60 min/);
});
test("CSV columns align for skipped, warm-up and partial repeated-effort records",()=>{
  const state=defaultState(),w=makeWorkout("lb",120);w.status="completed";w.exercises[0].sets[0].warmup=true;
  const c=makeCardio("circuit");c.loggingStyle="efforts";c.efforts=[{id:"effort",plannedDistanceM:50,actualDistanceM:20,plannedDurationSec:60,actualDurationSec:30,plannedLoad:null,actualLoad:null,completed:true}];w.cardio=[c];
  const skipped=makeWorkout("lb",120);skipped.status="skipped";skipped.notes="My notes";skipped.skipReason="Recovery";state.workouts=[w,skipped];const rows=trainingCsvRows(state),h=rows[0];assert.ok(rows.every(row=>row.length===h.length));
  assert.equal(rows[1][h.indexOf("warmup")],"true");const effort=rows.find(row=>row[h.indexOf("type")] === "circuit")!;assert.equal(effort[h.indexOf("duration_min")],"0.5");assert.equal(effort[h.indexOf("distance_km")],"0.02");assert.equal(effort[h.indexOf("record_status")],"partial");const last=rows.at(-1)!;assert.equal(last[h.indexOf("notes")],"My notes");assert.equal(last[h.indexOf("skip_reason")],"Recovery");
});
test("planned hard intensity never claims actual hard-session overlap",()=>{
  const s=defaultState(),run=makeWorkout("lb",120),lift=makeWorkout("lb",120);run.status="completed";lift.status="completed";run.cardio=[{...makeCardio("run"),completed:true,intensity:"hard",effort:"2"}];lift.exercises[0].name="Back squat";lift.exercises[0].sets[0]=makeSet("lb",{completed:true,actualReps:"5"});s.workouts=[run,lift];assert.equal(weeklyTrainingSignals(s).overlap,false);run.cardio[0].effort="8";assert.equal(weeklyTrainingSignals(s).overlap,true);
});
test("single-rep estimate equals observed load and high reps remain excluded",()=>{
  assert.equal(estimatedOneRepMax(315,1),315);assert.equal(estimatedOneRepMax(100,6),120);assert.equal(estimatedOneRepMax(100,11),null);
});
test("calendar-date windows cross DST with calendar arithmetic",()=>{
  assert.equal(localDateDaysEarlier(1,"2026-03-09"),"2026-03-08");assert.equal(localDateDaysEarlier(1,"2026-11-02"),"2026-11-01");
});
