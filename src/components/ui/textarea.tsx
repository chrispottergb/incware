import * as React from "react";
import { cn } from "@/lib/utils";
import { useTextExpansion } from "@/hooks/useTextExpansion";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, value, onChange, ...props }, forwardedRef) => {
  const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Merge forwarded ref and internal ref
  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [forwardedRef],
  );

  // Only enable expansion for controlled textareas
  const isControlled = value !== undefined && onChange !== undefined;

  const handleExpansionChange = React.useCallback(
    (newValue: string) => {
      const el = internalRef.current;
      if (!el) return;
      // Use native value setter + input event so React's controlled-input
      // reconciliation picks up the change reliably.
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, newValue);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (onChange) {
        // Fallback: call onChange directly
        const syntheticEvent = {
          target: { value: newValue },
          currentTarget: { value: newValue },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(syntheticEvent);
      }
    },
    [onChange],
  );

  useTextExpansion(
    internalRef,
    isControlled ? String(value) : "",
    handleExpansionChange,
  );

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={setRefs}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
