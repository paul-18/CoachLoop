import { Button } from "@/components/ui/button";

export function DemoBar({ onExit }: { onExit: () => void }) {
  return <div className="demo-bar" role="status">
    <strong>Demo mode</strong>
    <span>Sample data only. Refreshing returns to your log.</span>
    <Button type="button" onClick={onExit}>Exit demo</Button>
  </div>;
}
