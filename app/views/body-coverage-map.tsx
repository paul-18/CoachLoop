"use client";

import { useId } from "react";
import { FEMALE_BACK, FEMALE_FRONT, MALE_BACK, MALE_FRONT } from "@musclemap/assets";
import type { BodyDiagram } from "@musclemap/assets";
import type { MuscleCoverage, MuscleGroup } from "../domain/training-coverage";

export const coverageColor = (entry: MuscleCoverage) => {
  if (!entry.effectiveSets) return "#323b3b";
  const level = Math.min(1, entry.effectiveSets / 10);
  return `hsl(203 60% ${31 + level * 34}%)`;
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

// Reshape the silhouette and its hit regions together. The source assets use
// absolute M/C coordinates, so the same gentle taper keeps every region aligned.
const tonedDiagram = (diagram: BodyDiagram): BodyDiagram => {
  const stops = [[290, .83], [450, .85], [650, .95], [800, .98], [1050, .90], [1536, .90]];
  const taper = (y: number) => {
    if (y <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (y <= stops[i][0]) {
        const [fromY, fromScale] = stops[i - 1];
        const [toY, toScale] = stops[i];
        const t = (y - fromY) / (toY - fromY);
        const smooth = t * t * (3 - 2 * t);
        return fromScale + (toScale - fromScale) * smooth;
      }
    }
    return stops[stops.length - 1][1];
  };
  const path = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) =>
    `${(diagram.centerX + (Number(x) - diagram.centerX) * taper(Number(y))).toFixed(2)} ${y}`);
  return { ...diagram, outline: diagram.outline.map((item) => ({ ...item, d: path(item.d) })), muscles: diagram.muscles.map((item) => ({ ...item, d: path(item.d) })) };
};
const TONED_FRONT = tonedDiagram(FEMALE_FRONT);
const TONED_BACK = tonedDiagram(FEMALE_BACK);

export function BodyCoverageMap({ coverage, selected, onSelect, bodyDiagram = "male" }: { bodyDiagram?: "male" | "female"; coverage: MuscleCoverage[]; selected: MuscleGroup; onSelect: (muscle: MuscleGroup) => void }) {
  const mapId = useId();
  const byMuscle = new Map(coverage.map((entry) => [entry.muscle, entry]));
  const draw = (diagram: BodyDiagram, mapping: Record<string, MuscleGroup>, x: number, label: string) => {
    const mirror = `translate(${diagram.centerX * 2} 0) scale(-1 1)`;
    const female = diagram.id.startsWith("female");
    const isFront = diagram.id === "female-front";
    const bodyClip = `${mapId}-${diagram.id}-body`;
    return <g key={label}>
      <text x={x + 82} y="13" textAnchor="middle">{label}</text>
      <svg x={x} y="18" width="164" height="246" viewBox={diagram.viewBox} aria-label={`${label.toLowerCase()} muscle groups`}>
        {female && <defs><clipPath id={bodyClip}><rect x="0" y="290" width="1024" height="1246" /></clipPath></defs>}
        {/* Keep the anatomical overlay and silhouette in the same coordinate system. */}
        <g clipPath={female ? `url(#${bodyClip})` : undefined}>
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
        </g>
        {/* Cover the source neck fragments so they cannot overlap the new head. */}
        {female && <g className="anatomy-head" aria-hidden="true" pointerEvents="none">
          <path className="anatomy-neck" d="M483 244 L483 278 Q480 294 457 302 L429 312 Q470 321 512 318 Q554 321 595 312 L567 302 Q544 294 541 278 L541 244 Z" />
          <ellipse className="anatomy-hair" cx="512" cy="100" rx="27" ry="25" />
          <path className={isFront ? "anatomy-face" : "anatomy-hair"} d="M512 106 C472 106 449 133 449 175 L452 215 Q458 244 482 263 Q499 276 512 276 Q525 276 542 263 Q566 244 572 215 L575 175 C575 133 552 106 512 106 Z" />
          {isFront && <path className="anatomy-hair" d="M450 210 Q438 173 453 141 Q467 103 511 102 Q555 100 572 135 Q586 163 574 207 L567 187 Q565 158 552 144 Q518 158 483 140 Q462 155 457 185 Z" />}
        </g>}
      </svg>
    </g>;
  };

  return <svg className="coverage-body-map" viewBox="0 0 360 270" role="group" aria-label="Front and back strength coverage from completed lifting sets">
    {draw(bodyDiagram === "female" ? TONED_FRONT : MALE_FRONT, front, 10, "FRONT")}
    {draw(bodyDiagram === "female" ? TONED_BACK : MALE_BACK, back, 186, "BACK")}
  </svg>;
}
