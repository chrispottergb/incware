import * as React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  className,
  disabled = false,
}: DatePickerFieldProps) {
  // Track raw text the user is typing so we don't reset mid-edit
  const [rawText, setRawText] = React.useState<string | null>(null);

  const selected = React.useMemo(() => {
    if (!value) return null;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : null;
  }, [value]);

  // When external value changes (e.g. form reset), clear any pending raw text
  React.useEffect(() => {
    setRawText(null);
  }, [value]);

  const handleChange = (date: Date | null) => {
    setRawText(null);
    if (date && isValid(date)) {
      onChange(format(date, "yyyy-MM-dd"));
    }
  };

  const handleChangeRaw = (e: any) => {
    const typed = e?.target?.value ?? "";
    setRawText(typed);

    // Try parsing typed text as MM/dd/yyyy
    if (typed) {
      const parsed = parse(typed, "MM/dd/yyyy", new Date());
      if (isValid(parsed) && typed.length >= 8) {
        onChange(format(parsed, "yyyy-MM-dd"));
        setRawText(null);
      }
    }
  };

  const handleBlur = () => {
    // On blur, try to parse whatever was typed
    if (rawText != null && rawText.trim()) {
      const parsed = parse(rawText.trim(), "MM/dd/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
      // If invalid, keep current value (don't reset)
    }
    setRawText(null);
  };

  return (
    <DatePicker
      selected={selected}
      onChange={handleChange}
      onChangeRaw={handleChangeRaw}
      onBlur={handleBlur}
      dateFormat="MM/dd/yyyy"
      placeholderText={placeholder}
      disabled={disabled}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      isClearable={!disabled}
      className={cn(
        "flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      wrapperClassName="w-full"
      popperClassName="z-50"
    />
  );
}
