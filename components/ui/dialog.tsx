"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

const isDateOrTimeInput = (target: EventTarget | null): target is HTMLInputElement =>
  target instanceof HTMLInputElement && (target.type === "date" || target.type === "time");
// Focus falling back to the body (or nowhere) is what a native picker does
// when it takes over; focus landing on a real element is a genuine move.
const focusLeftForNowhere = (relatedTarget: EventTarget | null) =>
  !(relatedTarget instanceof HTMLElement) || relatedTarget === document.body || relatedTarget === document.documentElement;

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const returnFocus = React.useRef<HTMLElement | null>(null);
  // A native date/time picker lives outside the DOM: when it opens, focus can
  // leave the input for nowhere and a click on a day can arrive as an outside
  // pointerdown/click. Track whether a date/time input in this dialog is the
  // focused one (or just lost focus to nowhere, i.e. the picker took over)
  // so those interactions never dismiss the dialog. The flag clears when a
  // value is picked, or when focus lands on a real element.
  const datePickerActive = React.useRef(false);
  const suppressForDatePicker = (event: { target: EventTarget | null }, consume: boolean) => {
    if (datePickerActive.current) {
      // A suppressed outside pointer interaction is the picker's own click;
      // consume the guard so the next genuine outside click still closes.
      if (consume) datePickerActive.current = false;
      return true;
    }
    const isDateOrTime = document.activeElement instanceof HTMLInputElement && (document.activeElement.type === "date" || document.activeElement.type === "time");
    return isDateOrTime || (event.target instanceof HTMLElement && event.target.closest('input[type="date"], input[type="time"]') !== null);
  };
  // Native listeners attached via a callback ref, not React synthetic ones
  // and not a mount effect: the dialog content mounts only while the dialog
  // is open, so a mount effect runs while there is no node yet, and React's
  // focus capture did not fire for a programmatic focus on the date input.
  // A focusin/focusout listener on the content node itself sees every
  // descendant focus change.
  const datePickerCleanup = React.useRef<(() => void) | null>(null);
  const contentRef = React.useCallback((node: HTMLDivElement | null) => {
    datePickerCleanup.current?.();
    datePickerCleanup.current = null;
    if (!node) return;
    const onFocusIn = (event: FocusEvent) => {
      if (isDateOrTimeInput(event.target)) datePickerActive.current = true;
      else if (event.target instanceof HTMLElement) datePickerActive.current = false;
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!isDateOrTimeInput(event.target)) return;
      if (!focusLeftForNowhere(event.relatedTarget)) datePickerActive.current = false;
    };
    const onChange = (event: Event) => {
      if (isDateOrTimeInput(event.target)) datePickerActive.current = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      // The tap that opens the picker: focusin does not reliably fire for a
      // date input in WebKit, so the pointerdown on the input itself is the
      // dependable signal that the picker is about to open.
      if (isDateOrTimeInput(event.target)) datePickerActive.current = true;
    };
    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("focusout", onFocusOut);
    node.addEventListener("change", onChange);
    node.addEventListener("pointerdown", onPointerDown);
    datePickerCleanup.current = () => {
      node.removeEventListener("focusin", onFocusIn);
      node.removeEventListener("focusout", onFocusOut);
      node.removeEventListener("change", onChange);
      node.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
        onOpenAutoFocus={event => {
          const active = document.activeElement;
          returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
          onOpenAutoFocus?.(event);
        }}
        onPointerDownOutside={event => {
          if (suppressForDatePicker(event, true)) {
            event.preventDefault();
            return;
          }
          props.onPointerDownOutside?.(event);
        }}
        onInteractOutside={event => {
          if (suppressForDatePicker(event, false)) {
            event.preventDefault();
            return;
          }
          props.onInteractOutside?.(event);
        }}
        onCloseAutoFocus={event => {
          onCloseAutoFocus?.(event);
          const target = returnFocus.current;
          if (!event.defaultPrevented && target?.isConnected && !target.matches(":disabled") && !target.closest('[aria-hidden="true"], [inert]')) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 -m-2 rounded-xs p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
