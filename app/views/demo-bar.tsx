import { Button } from "@/components/ui/button";

export function DemoBar({ onExit, onSample }: { onExit: () => void; onSample?: () => void }) {
  return <div className="demo-bar" role="status">
    <strong>Demo mode</strong>
    <span>Sample data only. Refreshing returns to your log.</span>
    {onSample && <Button type="button" variant="outline" onClick={onSample}>See a sample workout</Button>}
    <Button type="button" onClick={onExit}>Exit demo</Button>
  </div>;
}
