import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COLOR_THEMES, DEFAULT_PROGRESS_SECTIONS, DEFAULT_WEEKLY_CARDS, toggleChoice } from "../app/domain/display-preferences";
import { weeklyCards } from "../app/domain/weekly-cards";
import { defaultState, localDate, makeCardio, makeWorkout } from "../app/domain/training-types";
import { prepareLoadedState } from "../app/persistence/migrations";
import { mergeRestoredState } from "../app/persistence/cloud-sync";
import { ActivityBreakdown, ProgressView } from "../app/views/progress-view";
import { DisplayPreferences } from "../app/views/display-preferences";

const noop = () => {};
test("one or two chosen weekly cards render without showing unselected categories", () => {
  const state = defaultState();
  state.settings.weeklyCards = ["run"];
  let html = renderToStaticMarkup(createElement(ActivityBreakdown, { state }));
  assert.match(html, /<span>Runs<\/span>/); assert.doesNotMatch(html, /<span>Strength<\/span>|<span>Rucks<\/span>/);
  state.settings.weeklyCards = ["water_polo", "circuit"];
  assert.deepEqual(weeklyCards(state).map(card => card.id), ["water_polo", "circuit"]);
  html = renderToStaticMarkup(createElement(ActivityBreakdown, { state }));
  assert.match(html, /<span>Water polo<\/span>/); assert.match(html, /<span>Circuits<\/span>/); assert.doesNotMatch(html, /<span>Runs<\/span>/);
});

test("additional weekly activity cards use completed evidence only and exclude future dates", () => {
  const state = defaultState(); state.settings.weeklyCards = ["bike"];
  const workout = makeWorkout("lb", 120);workout.exercises=[];workout.status="completed";
  const bike = makeCardio("bike");bike.completed=true;bike.actualDurationMin=25;bike.actualDistanceKm=8;workout.cardio=[bike];
  const unfinished=makeCardio("bike");unfinished.plannedDistanceKm=100;unfinished.actualDurationMin=20;workout.cardio.push(unfinished);
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  state.workouts=[workout,{...workout,id:"future",date:localDate(tomorrow)}];
  const cards=weeklyCards(state);assert.equal(cards[0].value,"8 km");assert.equal(cards[0].detail,"1 session · 25 min");
  assert.deepEqual(cards[0].dates,[localDate()]);
});

test("hidden Progress sections disappear while Modify Progress always remains available", () => {
  const state=defaultState();
  const draw=()=>renderToStaticMarkup(createElement(ProgressView,{state,onUpdateSettings:noop,onLogBodyweight:noop,onSaveWaist:noop,onChangeActivityType:noop}));
  assert.match(draw(),/Lift balance/);
  state.settings.progressSections=["weekly"];
  let html=draw();assert.doesNotMatch(html,/Lift balance|Strength coverage|Exercise trend|Waist tracking|Monthly review/);assert.match(html,/Modify Progress/);
  state.settings.progressSections=[];html=draw();assert.match(html,/Modify Progress/);assert.doesNotMatch(html,/Last 7 days/);
});

test("theme and display selections round-trip through backups including intentionally empty lists", () => {
  const state=defaultState();state.settings.colorTheme="peach";state.settings.weeklyCards=[];state.settings.progressSections=["coverage"];
  state.settingsUpdatedAt=new Date().toISOString();const before=JSON.stringify(state.workouts);
  const restored=mergeRestoredState(defaultState(),prepareLoadedState(JSON.parse(JSON.stringify(state))));
  assert.equal(restored.settings.colorTheme,"peach");assert.deepEqual(restored.settings.weeklyCards,[]);assert.deepEqual(restored.settings.progressSections,["coverage"]);assert.equal(JSON.stringify(restored.workouts),before);
  const old=prepareLoadedState(defaultState());assert.deepEqual(weeklyCards(old).map(card=>card.id),DEFAULT_WEEKLY_CARDS);
  assert.ok(DEFAULT_PROGRESS_SECTIONS.includes("balance"));
  for(const change of [{colorTheme:"unknown"},{weeklyCards:["unknown"]},{progressSections:["unknown"]},{weeklyCards:["run","run"]}]) assert.throws(()=>prepareLoadedState({...state,settings:{...state.settings,...change}}));
});

test("display control toggles save preferences without rewriting workouts or shortcut selections", () => {
  const state=defaultState();state.workouts=[makeWorkout("lb",120)];const before=JSON.stringify(state.workouts),quick=JSON.stringify(state.settings.quickLogActivities);
  assert.deepEqual(toggleChoice(["run"],"run",true),["run"]);assert.deepEqual(toggleChoice(["run"],"run",false),[]);
  const tree=DisplayPreferences({settings:state.settings,onUpdate:update=>{state.settings=update(state.settings);}});
  // Invoke the actual color selector's handler from the rendered element tree.
  const colors=tree.props.children[0].props.children[2].props.children;
  colors[1].props.onClick();assert.equal(state.settings.colorTheme,"peach");
  assert.equal(JSON.stringify(state.workouts),before);assert.equal(JSON.stringify(state.settings.quickLogActivities),quick);
});

test("all eight accent presets keep readable contrast against primary button text", () => {
  const luminance=(hex:string)=>{const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;};
  for(const theme of COLOR_THEMES) assert.ok((luminance(theme.color)+0.05)/(luminance("#11140d")+0.05)>4.5,theme.label);
});

test("all eight themes survive strict backup loading and new choices do not mutate workouts",()=>{
 assert.equal(COLOR_THEMES.length,8);assert.equal(new Set(COLOR_THEMES.map(t=>t.id)).size,8);
 for(const theme of COLOR_THEMES){const state=defaultState();state.settings.colorTheme=theme.id;state.workouts=[makeWorkout("lb",120)];const loaded=prepareLoadedState(JSON.parse(JSON.stringify(state)));assert.equal(loaded.settings.colorTheme,theme.id);assert.deepEqual(loaded.workouts,state.workouts);}
});
