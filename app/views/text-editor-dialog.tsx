"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function TextEditorDialog({ title, description, value, onChange, onSave, onClose, allowEmpty = false }: {
  title: string; description: string; value: string; onChange: (value: string) => void;
  onSave: () => void; onClose: () => void; allowEmpty?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const visual = window.visualViewport;
      const height = visual?.height ?? window.innerHeight;
      setViewport({ height: Math.min(window.innerWidth < 640 ? height - 24 : 680, height - 24), top: (visual?.offsetTop ?? 0) + height / 2 });
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} className="long-text-dialog" style={viewport ? { height: viewport.height, top: viewport.top } : undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus(); }}
      onInteractOutside={(event) => event.preventDefault()}>
      <DialogHeader><DialogTitle ref={heading} tabIndex={-1}>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <Textarea aria-label={title} value={value} onChange={(event) => onChange(event.target.value)} className="long-text-input" />
      <div className="flex shrink-0 justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!allowEmpty && !value.trim()} onClick={onSave} className="bg-[var(--lime)] text-[#11140d]">Save</Button></div>
    </DialogContent>
  </Dialog>;
}
