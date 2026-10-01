"use client";

import { MALE_BACK, MALE_FRONT } from "@musclemap/assets";
import type { BodyDiagram } from "@musclemap/assets";
import type { MuscleCoverage, MuscleGroup } from "../domain/training-coverage";

export const coverageColor = (entry: MuscleCoverage) => {
  if (!entry.effectiveSets) return "#323b3b";
  const level = Math.min(1, entry.effectiveSets / 10);
  return `hsl(${203 - level * 113} 52% ${31 + level * 23}%)`;
};

// Keep labels tied to Coach Loop's existing strength-only mapping.
const front: Record<string, MuscleGroup> = {
  CHEST: "Chest", SHOULDERS_FRONT: "Front delts", SHOULDERS_SIDE: "Side delts",
  BICEPS: "Biceps", TRICEPS: "Triceps", CORE: "Abs", OBLIQUES: "Abs",
  QUADS: "Quads", CALVES: "Calves",
};
const back: Record<string, MuscleGroup> = {
  SHOULDERS_REAR: "Rear delts", SHOULDERS_SIDE: "Side delts", TRAPEZIUS: "Upper back",
  RHOMBOIDS: "Upper back", LATS: "Lats", TRICEPS: "Triceps",
  GLUTES: "Glutes", HAMSTRINGS: "Hamstrings", CALVES: "Calves",
};

export function BodyCoverageMap({ coverage, selected, onSelect }: { coverage: MuscleCoverage[]; selected: MuscleGroup; onSelect: (muscle: MuscleGroup) => void }) {
  const byMuscle = new Map(coverage.map((entry) => [entry.muscle, entry]));
  const draw = (diagram: BodyDiagram, mapping: Record<string, MuscleGroup>, x: number, label: string) => {
    const mirror = `translate(${diagram.centerX * 2} 0) scale(-1 1)`;
    return <g key={label}>
      <text x={x + 82} y="13" textAnchor="middle">{label}</text>
      <svg x={x} y="18" width="164" height="246" viewBox={diagram.viewBox} aria-label={`${label.toLowerCase()} muscle groups`}>
        {diagram.outline.map((path, index) => <g key={`outline-${index}`}>
          <path className="anatomy-silhouette" d={path.d} />
          {path.side === "LEFT" && <path className="anatomy-silhouette" d={path.d} transform={mirror} />}
        </g>)}
        {diagram.muscles.map((path, index) => {
          const muscle = mapping[path.group];
          const entry = muscle && byMuscle.get(muscle);
          const fill = muscle ? coverageColor(entry ?? { muscle, effectiveSets: 0, days: 0 }) : "#323b3b";
          return <g key={`muscle-${index}`}>
            {[undefined, ...(path.side === "LEFT" ? [mirror] : [])].map((transform, side) => <path key={side} d={path.d} transform={transform} fill={fill}
              className={muscle ? `anatomy-muscle${selected === muscle ? " selected" : ""}` : "anatomy-neutral"}
              onClick={muscle ? () => onSelect(muscle) : undefined}
              onKeyDown={muscle ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(muscle); } } : undefined}
              role={muscle ? "button" : undefined} tabIndex={muscle ? 0 : undefined}
              aria-label={muscle ? `Show ${muscle} coverage` : undefined} />)}
          </g>;
        })}
      </svg>
    </g>;
  };

  return <svg className="coverage-body-map" viewBox="0 0 360 270" role="img" aria-label="Front and back strength coverage from completed lifting sets">
    {draw(MALE_FRONT, front, 10, "FRONT")}
    {draw(MALE_BACK, back, 186, "BACK")}
  </svg>;
}
