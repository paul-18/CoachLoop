import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState, makeWorkout,makeCardio,makeExercise,makeSet} from '../app/training-types';
import {moveBlockLater,substituteExercise,activityRows,activityTotals,incrementKey,validMeasurementDate} from '../app/training-workflow';
import {mergeTrainingStates} from '../app/cloud-sync';
import {workoutToText} from '../app/coach-export';
import {workoutLiftingVolume} from '../app/training-metrics';
import {makeHyroxWorkout,hyroxPreset,updateHyrox,comparableHyrox,hyroxTotal} from '../app/hyrox';

test('reorder preserves logged work and substitution never assigns completed bench sets to a replacement',()=>{
 const w=makeWorkout('lb',120);const e=w.exercises[0];e.name='Bench';e.sets=[makeSet('lb',{actualWeight:175,actualReps:'6',loadType:'weighted',completed:true}),makeSet('lb',{plannedWeight:175,plannedReps:'6',loadType:'weighted'})];
 const other=makeExercise('lb',60,'Row');w.exercises.push(other);w.blockOrder.push({type:'exercise',id:other.id});
 const moved=moveBlockLater(w,e.id);assert.equal(moved.blockOrder.at(-1)!.id,e.id);assert.deepEqual(moved.exercises,w.exercises);
 const swapped=substituteExercise(w,e.id,'Dumbbell Bench Press','lb');assert.deepEqual(swapped.exercises[0].sets[0],e.sets[0]);assert.equal(swapped.exercises[0].sets[1].skipped,true);
 const repl=swapped.exercises.at(-1)!;assert.equal(repl.substitutedFor,'Bench');assert.equal(repl.sets.length,1);assert.equal(repl.sets[0].plannedWeight,null);assert.equal(repl.sets[0].actualReps,'');assert.notEqual(repl.id,e.id);
 assert.equal(workoutLiftingVolume(swapped,'lb').volume,1050);assert.match(workoutToText(swapped),/SKIPPED/);assert.match(workoutToText(swapped),/substituted for Bench/);
});

test('moving an activity after lifting retains its measurements and resumes in the new order',()=>{
 const w=makeWorkout('lb',120);const drag={...makeCardio('other'),name:'Sled drag',actualDurationMin:8,completed:false};
 w.cardio=[drag];w.blockOrder=[{type:'activity',id:drag.id},...w.blockOrder];
 const moved=moveBlockLater(w,drag.id);
 assert.equal(moved.blockOrder.at(-1)?.id,drag.id);
 assert.equal(moved.cardio[0],drag);
 assert.equal(w.blockOrder[0].id,drag.id);
});

test('activity history separates types, excludes plans and unfinished segments, and normalizes pack load',()=>{
 const state=defaultState();const w=makeWorkout('lb',60);w.status='completed';w.date='2026-09-24';
 w.cardio=[{...makeCardio('run'),completed:true,actualDurationMin:25,actualDistanceKm:5},{...makeCardio('ruck'),completed:true,actualDistanceKm:10,actualDurationMin:100,ruckLoad:45,ruckLoadUnit:'lb'},makeCardio('run')];
 const planned={...structuredClone(w),id:'planned',status:'planned' as const};state.workouts=[w,planned];
 assert.equal(activityRows(state,'run').length,1);assert.equal(activityTotals(activityRows(state,'run')).distance,5);assert.equal(activityTotals(activityRows(state,'ruck')).minutes,100);assert.ok(Math.abs(activityTotals(activityRows(state,'ruck')).ruckKgKm-204.1165665)<.01);assert.equal(activityRows(state,undefined,'2026-09-25').length,0);
});

test('waist corrections/deletions and equipment preferences survive a stale sync',()=>{
 const old=defaultState();const current=defaultState();old.waistEntries=[{id:'w',date:'2026-09-24',cm:80,updatedAt:'2026-09-24T00:00:00Z'}];current.waistEntries=[{...old.waistEntries[0],cm:79,updatedAt:'2026-09-25T00:00:00Z',deletedAt:'2026-09-25T00:00:00Z'}];
 old.loadIncrements={bench:{value:5,updatedAt:'2026-09-24'}};current.loadIncrements={bench:{value:2.5,updatedAt:'2026-09-25'}};
 for(const merged of [mergeTrainingStates(current,old),mergeTrainingStates(old,current)]){assert.equal(merged.waistEntries!.length,1);assert.ok(merged.waistEntries![0].deletedAt);assert.equal(merged.loadIncrements!.bench.value,2.5);}
 assert.notEqual(incrementKey('Bench','lb','total',{}),incrementKey('Bench','kg','total',{}));assert.notEqual(incrementKey('Bench','lb','total',{}),incrementKey('Bench','lb','per_hand',{}));
 assert.equal(validMeasurementDate('2026-02-30'),false);
});

test('focused HYROX repeats only chosen segments; comparisons reject differing setups or pause categories',()=>{
 const selected=hyroxPreset('men_open').slice(0,4);let a=makeHyroxWorkout('men_open',selected,'Base gym');a.date='2026-09-24';a=updateHyrox(a,'start',1000);for(let i=0;i<4;i++)a=updateHyrox(a,'complete',1000+(i+1)*60000);a.status='completed';a.completedAt='2026-09-24T12:00:00Z';
 assert.equal(a.hyrox!.focused,true);assert.equal(a.cardio.length,4);assert.equal(hyroxTotal(a.hyrox!),240000);
 const repeat=makeHyroxWorkout(a.hyrox!.division,a.hyrox!.segments,a.hyrox!.setupLabel);assert.equal(repeat.hyrox!.segments.length,4);assert.ok(repeat.hyrox!.segments.every(s=>s.splitMs===null));assert.equal(repeat.hyrox!.setupLabel,'Base gym');
 const b=structuredClone(a);b.id='b';b.date='2026-09-25';assert.equal(comparableHyrox(b,[a]).length,1);
 const changed=structuredClone(a);changed.id='changed';changed.hyrox!.segments[0].distanceM=500;assert.equal(comparableHyrox(b,[changed]).length,0);
 changed.hyrox=structuredClone(a.hyrox);changed.hyrox!.paused=true;assert.equal(comparableHyrox(b,[changed]).length,0);
 changed.hyrox=structuredClone(a.hyrox);changed.hyrox!.setupLabel='Other gym';assert.equal(comparableHyrox(b,[changed]).length,0);
 assert.throws(()=>makeHyroxWorkout('men_open',[]));
});
