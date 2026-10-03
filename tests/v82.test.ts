import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultState } from "../app/domain/training-types";
import { CoachView } from "../app/views/coach-view";
import { COLOR_THEMES } from "../app/domain/display-preferences";
import { COVERAGE_LEVELS, coverageColor } from "../app/views/body-coverage-map";

test("collapsed Coach priorities retain complete long goal text and rank order",()=>{
 const state=defaultState();state.goals=["First very long goal "+"detail ".repeat(150),"Second goal"];
 const html=renderToStaticMarkup(createElement(CoachView,{state,onBuild(){},onImport(){}}));
 assert.match(html,/<details class="coach-goals">/);assert.match(html,/2 goals/);assert.ok(html.includes(state.goals[0]));assert.ok(html.indexOf(state.goals[0])<html.indexOf("Second goal"));
});
test("gold coverage spans distinct ordered brightness levels and saturates at high coverage",()=>{
 const inputs=[0,.5,4,7,10,20];const colors=inputs.map(effectiveSets=>coverageColor({muscle:"Chest",effectiveSets,days:1}));
 assert.deepEqual(colors.slice(0,5),COVERAGE_LEVELS.map(level=>level.color));assert.equal(colors[4],colors[5]);
 const brightness=(hex:string)=>parseInt(hex.slice(1,3),16)+parseInt(hex.slice(3,5),16)+parseInt(hex.slice(5,7),16);
 for(let i=1;i<5;i++)assert.ok(brightness(colors[i])-brightness(colors[i-1])>=100,"visible spacing between coverage levels");
});
test("theme names are short without changing saved identifiers",()=>{
 assert.deepEqual(COLOR_THEMES.slice(0,4).map(t=>[t.id,t.label]),[["lime","Lime"],["peach","Peach"],["sky","Sky Blue"],["violet","Soft Violet"]]);
});

import { SaveErrorBanner } from "../app/views/save-error-banner";
test("fixed save-failure warning clears top and landscape side safe areas without losing retry",()=>{
 let retries=0;const tree=SaveErrorBanner({onRetry:()=>retries++});
 assert.equal(tree.props.role,"alert");assert.equal(tree.props.style.top,"calc(var(--app-safe-top, 0px) + 8px)");
 assert.match(tree.props.style.left,/safe-area-inset-left/);assert.match(tree.props.style.right,/safe-area-inset-right/);
 const retry=tree.props.children[1];retry.props.onClick();assert.equal(retries,1);
 const html=renderToStaticMarkup(tree);assert.match(html,/Latest changes are not saved/);assert.match(html,/Retry save/);assert.doesNotMatch(html,/top-2/);
});
