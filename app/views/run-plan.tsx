/** Presentation only: keep the original FITLOG text untouched for editing and export. */
export function runPlanStages(text: string) {
  return text.split(/\s*;\s*|\s*\n\s*/).map((part) => part.trim()).filter(Boolean);
}

export function RunPlan({ text }: { text: string }) {
  const stages = runPlanStages(text);
  return <div className="run-plan" aria-label="Run plan">
    <span className="run-plan-label">Run plan</span>
    {stages.map((stage, index) => <p key={`${index}-${stage}`}><span>{index + 1}</span>{stage}</p>)}
  </div>;
}
