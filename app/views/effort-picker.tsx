"use client";

import { useEffect, useId, useRef } from "react";

/** Inline scroll-snap wheel: no keyboard, modal, or dropdown required. */
export function EffortPicker({ value, onChange, label, includeZero = false }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  includeZero?: boolean;
}) {
  const options = ["", ...Array.from({ length: includeZero ? 11 : 10 }, (_, index) => String(index + (includeZero ? 0 : 1)))];
  // Keep historical/imported fractional or range values visible until explicitly changed.
  if (!options.includes(value)) options.push(value);
  const selected = options.indexOf(value);
  const optionKey = options.join("|");
  const id = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const interacting = useRef(false);
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    // Parent updates from this wheel must not interrupt native touch momentum.
    if (emitted.current === value) { emitted.current = null; return; }
    const node = scroller.current;
    if (!node) return;
    interacting.current = false;
    node.scrollTop = selected * (node.firstElementChild?.getBoundingClientRect().height || 24);
  }, [value, selected, optionKey]);

  const choose = (index: number) => {
    const next = Math.max(0, Math.min(options.length - 1, index));
    const node = scroller.current;
    interacting.current = false;
    if (node) node.scrollTop = next * (node.firstElementChild?.getBoundingClientRect().height || 24);
    if (options[next] !== value) { emitted.current = options[next]; onChange(options[next]); }
  };

  return (
    <div className="effort-picker effort-wheel">
      <div className="effort-wheel-selection" aria-hidden="true" />
      <div
        ref={scroller}
        className="effort-wheel-scroll"
        role="listbox"
        tabIndex={0}
        aria-label={`${label}. Swipe up or down to choose.`}
        aria-activedescendant={`${id}-${selected}`}
        onTouchStart={() => { interacting.current = true; }}
        onPointerDown={() => { interacting.current = true; }}
        onWheel={() => { interacting.current = true; }}
        onScroll={(event) => {
          if (!interacting.current) return;
          const node = event.currentTarget;
          if (!node.clientHeight) return;
          const index = Math.max(0, Math.min(options.length - 1, Math.round(node.scrollTop / (node.firstElementChild?.getBoundingClientRect().height || 24))));
          const next = options[index];
          if (next !== value && next !== emitted.current) { emitted.current = next; onChange(next); }
        }}
        onKeyDown={(event) => {
          const index = event.key === "ArrowDown" ? selected + 1 : event.key === "ArrowUp" ? selected - 1 : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
          if (index !== null) { event.preventDefault(); choose(index); }
        }}
      >
        {options.map((option, index) => (
          <div key={option} id={`${id}-${index}`} role="option" aria-selected={option === value}
            aria-label={option || "Not recorded"} className="effort-wheel-option"
            onClick={() => choose(index)}>{option || "—"}</div>
        ))}
      </div>
    </div>
  );
}
