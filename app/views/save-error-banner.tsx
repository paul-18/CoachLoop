import { Button } from "@/components/ui/button";

/** Fixed warnings sit outside the padded app shell and need their own insets. */
export function SaveErrorBanner({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="fixed z-[100] overflow-y-auto rounded-xl border border-red-300/30 bg-[#371f20] p-3 text-sm text-white" style={{
    top: "calc(var(--app-safe-top, 0px) + 8px)",
    left: "max(12px, env(safe-area-inset-left, 0px))",
    right: "max(12px, env(safe-area-inset-right, 0px))",
    maxHeight: "calc(100dvh - var(--app-safe-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px)",
  }}>Latest changes are not saved on this device. <Button size="sm" onClick={onRetry}>Retry save</Button></div>;
}
