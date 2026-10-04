import { Component, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export class ViewErrorBoundary extends Component<{ label: string; resetKey: string; children: ReactNode; onReload?: () => Promise<void> }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (this.state.failed) {
      return <main className="page-stack"><section className="settings-panel"><h1 className="text-xl font-black">{this.props.label} could not load</h1><p className="mt-2 text-sm leading-6 text-white/55">Try this view again. Restart saves your latest changes first; if saving fails, download a backup before closing.</p><Button className="mt-4" onClick={() => this.setState({ failed: false })}>Try again</Button><Button variant="outline" onClick={() => void this.props.onReload?.().catch(() => toast.error("Cannot restart until saving succeeds; download a backup"))}>Save and restart</Button></section></main>;
    }
    return this.props.children;
  }
}
