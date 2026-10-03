import type { ReactNode } from "react";

/** Compact activity pictograms sharing the same grid and stroke as the app's line icons. */
function SportIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}
export function RunningIcon() {
  return <SportIcon><circle cx="16" cy="4" r="2" /><path d="m13 8-3 5 5 2-1 6M13 8l4 3h4M13 8 9 7l-3 3M10 13l-3 5H3" /></SportIcon>;
}
export function SwimmingIcon() {
  return <SportIcon><circle cx="17" cy="5" r="2" /><path d="m4 12 4-5 5 5 3-3M2 17q2-2 4 0t4 0t4 0t4 0t4 0M2 21q2-2 4 0t4 0t4 0t4 0t4 0" /></SportIcon>;
}
export function GrapplingIcon() {
  return <SportIcon><circle cx="8" cy="4" r="2" /><circle cx="16" cy="4" r="2" /><path d="m7 8 1 5-3 7H2M8 13l3 7M17 8l-1 5 3 7h3M16 13l-3 7M7 8l4 3 6-3M17 8l-4 2-6-2" /></SportIcon>;
}
export function YogaIcon() {
  return <SportIcon><circle cx="12" cy="5" r="2" /><path d="M12 8v5M12 9l-4 3-3-1M12 9l4 3 3-1M12 13l-6 4q-2 2 2 2h8q4 0 2-2l-6-4ZM8 19l8-2" /></SportIcon>;
}

export function SoccerBallIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" />
    <path d="m12 7.4 4.3 3.1-1.6 5.1H9.3l-1.6-5.1L12 7.4Z" />
    <path d="M12 7.4V2.6M16.3 10.5l4.5-1.4m-6.1 6.5 2.6 3.7m-8-3.7-2.6 3.7m1-8.8L3.2 9.1" />
  </svg>;
}
