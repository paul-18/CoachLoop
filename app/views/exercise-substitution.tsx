'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type TrainingState, type ExerciseBlock } from '../domain/training-types';
import { exerciseIdentity, formatPerformedSet } from '../domain/training-metrics';
export function ExerciseSubstitution({exercise,state,onClose,onSelect}:{exercise:ExerciseBlock|null;state:TrainingState;onClose:()=>void;onSelect:(name:string)=>void}){
 const [name,setName]=useState('');
 const names=[...new Set(state.workouts.flatMap(w=>w.exercises.map(e=>e.name)).filter(n=>n!==exercise?.name))].sort();
 const latest=[...state.workouts].filter(w=>w.status==='completed').sort((a,b)=>b.date.localeCompare(a.date)|| (b.completedAt??'').localeCompare(a.completedAt??'')).flatMap(w=>w.exercises.filter(e=>exerciseIdentity(e.name,state.exerciseAliases)===exerciseIdentity(name,state.exerciseAliases)&&e.sets.some(s=>s.completed)).map(e=>({date:w.date,exercise:e})))[0];
 return <Dialog open={!!exercise} onOpenChange={v=>{if(!v){setName('');onClose();}}}><DialogContent className="border-white/10 bg-[#151713] text-white"><DialogHeader><DialogTitle>Substitute {exercise?.name}</DialogTitle><DialogDescription>Completed sets stay under the original exercise. Remaining sets are skipped there and added to your replacement with blank loads. Check the reps before training.</DialogDescription></DialogHeader><label className="field-label">Replacement exercise<Input list="replacement-exercises" value={name} onChange={e=>setName(e.target.value)} placeholder="Choose or type an exercise" /></label><datalist id="replacement-exercises">{names.map(n=><option key={n} value={n}/>)}</datalist><div className="feature-note">{latest ? <><strong>Last · {latest.date}</strong>{latest.exercise.sets.filter(s=>s.completed).map(s=><p key={s.id}>{formatPerformedSet(s)}</p>)}</> : 'No completed history for this exercise.'}</div><Button disabled={!name.trim() || exerciseIdentity(name,state.exerciseAliases)===exerciseIdentity(exercise?.name??'',state.exerciseAliases)} onClick={()=>{onSelect(name.trim());setName('');}} className="bg-[var(--lime)] text-black">Use replacement</Button></DialogContent></Dialog>;
}
