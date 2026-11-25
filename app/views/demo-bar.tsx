import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function DemoBar({ onExit }: { onExit: () => void }) {
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;
    const updateHeight = () => document.documentElement.style.setProperty("--banner-height", `${banner.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(banner);
    updateHeight();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--banner-height");
    };
  }, []);
  return <div ref={bannerRef} className="demo-bar" role="status">
    <strong>Demo mode</strong>
    <span>Sample data only. Changes are discarded when you exit or refresh.</span>
    <Button type="button" onClick={onExit}>Exit demo</Button>
  </div>;
}
