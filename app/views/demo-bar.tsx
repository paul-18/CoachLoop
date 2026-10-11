import { Button } from "@/components/ui/button";

export function DemoBar({ onExit }: { onExit: () => void }) {
  return <div className="demo-bar" role="status">
    <strong>Demo mode</strong>
    <span>Sample data only. Changes are discarded when you exit or refresh.</span>
    <Button type="button" onClick={onExit}>Exit demo</Button>
  </div>;
}
