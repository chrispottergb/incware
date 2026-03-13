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
  const selected = React.useMemo(() => {
    if (!value) return null;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : null;
  }, [value]);

  return (
    <DatePicker
      selected={selected}
      onChange={(date: Date | null) => {
        if (date && isValid(date)) {
          onChange(format(date, "yyyy-MM-dd"));
        }
      }}
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
