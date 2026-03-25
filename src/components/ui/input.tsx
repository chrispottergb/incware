import * as React from "react";

import { cn } from "@/lib/utils";
import { useTextExpansion } from "@/hooks/useTextExpansion";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, autoComplete, ...props }, forwardedRef) => {
    // Default autoComplete to "off" for address-prone fields, but preserve explicit overrides
    // and keep browser defaults for email/password/tel fields
    const resolvedAutoComplete = autoComplete !== undefined
      ? autoComplete
      : (type === "email" || type === "password" || type === "tel")
        ? undefined
        : "off";
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef)
          (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [forwardedRef],
    );

    const isControlled = value !== undefined && onChange !== undefined;

    const handleExpansionChange = React.useCallback(
      (newValue: string) => {
        const el = internalRef.current;
        if (!el) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(el, newValue);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (onChange) {
          const syntheticEvent = {
            target: { value: newValue },
            currentTarget: { value: newValue },
          } as React.ChangeEvent<HTMLInputElement>;
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
      <input
        type={type}
        autoComplete={resolvedAutoComplete}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={setRefs}
        value={value}
        onChange={onChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
