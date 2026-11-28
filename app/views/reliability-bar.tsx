import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** "Last imported plan" bar with an Undo action. It reports its own height so
 * top toasts sit below it instead of covering the Undo button. */
export function ReliabilityBar({ disabled, onUndo }: { disabled?: boolean; onUndo: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const updateHeight = () => document.documentElement.style.setProperty("--reliability-bar-height", `${bar.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);
    updateHeight();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--reliability-bar-height");
    };
  }, []);
  return <div ref={barRef} className="reliability-bar"><span>Last imported plan</span><Button size="sm" variant="outline" disabled={disabled} onClick={onUndo}>Undo import</Button></div>;
}
