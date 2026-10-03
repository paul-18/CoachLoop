import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeWorkout, localDate } from "../app/domain/training-types";
import { restoredState } from "../app/persistence/backup-tools";
import { orderedQuickLogOptions } from "../app/domain/quick-log-order";
import { weeklyCards } from "../app/domain/weekly-cards";
import { coverageColor } from "../app/views/body-coverage-map";

test("complete restore uses the backup goals, profile, measurements and preferences despite newer local values", () => {
 const current=defaultState(), backup=defaultState();
 current.goals=["Local goal"];current.goalsUpdatedAt="2026-10-03T12:00:00.000Z";current.coachProfile="Local profile";current.coachProfileUpdatedAt=current.goalsUpdatedAt;
 backup.goals=["Backup goal"];backup.goalsUpdatedAt="2026-09-01T12:00:00.000Z";backup.coachProfile="Backup profile";backup.coachProfileUpdatedAt=backup.goalsUpdatedAt;
 current.bodyweightEntries=[{id:"weight-local",date:"2026-10-02",weight:190,unit:"lb",updatedAt:current.goalsUpdatedAt}];backup.bodyweightEntries=[{id:"weight-backup",date:"2026-09-01",weight:170,unit:"lb",updatedAt:backup.goalsUpdatedAt}];
 current.settings.colorTheme="lime";backup.settings.colorTheme="peach";current.settingsUpdatedAt=current.goalsUpdatedAt;backup.settingsUpdatedAt=backup.goalsUpdatedAt;
 const workout=makeWorkout("lb",120);current.workouts=[workout];current.deletedWorkoutIds=["old"];
 const merged=restoredState(current,backup,"merge");assert.deepEqual(merged.goals,current.goals);assert.equal(merged.coachProfile,current.coachProfile);assert.equal(merged.workouts.length,1);
 const replaced=restoredState(current,backup,"replace");assert.deepEqual(replaced,backup);assert.equal(replaced.workouts.length,0);assert.deepEqual(replaced.bodyweightEntries,backup.bodyweightEntries);assert.equal(replaced.settings.colorTheme,"peach");
 replaced.goals.push("changed copy");assert.deepEqual(backup.goals,["Backup goal"]);assert.deepEqual(current.goals,["Local goal"]);
});
test("complete restore rejects unsupported/corrupt data before changing anything", () => {
 const current=defaultState();current.goals=["Keep"];
 assert.throws(()=>restoredState(current,{...defaultState(),evidenceVersion:999} as never,"replace"));assert.deepEqual(current.goals,["Keep"]);
});
test("visible shortcut order follows the selected order, with hidden options after it", () => {
 const order=orderedQuickLogOptions(["water_polo","run","yoga"]);assert.deepEqual(order.slice(0,3).map(x=>x.type),["water_polo","run","yoga"]);assert.equal(new Set(order.map(x=>x.type)).size,order.length);
});
test("strength weekly total is load times reps rather than plain pounds",()=>{
 const state=defaultState(),w=makeWorkout("lb",120);w.date=localDate();w.status="completed";const s=w.exercises[0].sets[0];s.completed=true;s.actualReps="5";s.actualWeight=100;s.loadType="weighted";w.exercises[0].sets=[s];state.workouts=[w];state.settings.weeklyCards=["strength"];
 const card=weeklyCards(state)[0];assert.match(card.value,/500 lb × reps/);assert.match(card.detail,/excludes BW/);
});
test("coverage uses a consistent blue scale whose brightness increases with evidence",()=>{
 const low=coverageColor({muscle:"Chest",effectiveSets:1,days:1}),high=coverageColor({muscle:"Chest",effectiveSets:10,days:1});assert.match(low,/hsl\(203 /);assert.match(high,/hsl\(203 /);assert.notEqual(low,high);assert.equal(coverageColor({muscle:"Chest",effectiveSets:0,days:0}),"#323b3b");
});
