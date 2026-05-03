/** Sanitize input to a numeric string allowing optional leading minus and decimals. */
export function sanitizeCurrencyInput(value: string): string {
  if (!value) return "";
  let v = value.replace(/[^0-9.-]/g, "");
  // Allow leading minus only
  const neg = v.startsWith("-");
  v = v.replace(/-/g, "");
  // Only first decimal point
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  // Limit decimals to 2
  const [intPart, decPart] = v.split(".");
  v = decPart !== undefined ? `${intPart}.${decPart.slice(0, 2)}` : intPart;
  return (neg ? "-" : "") + v;
}

/** Format a numeric string as $1,234.56 (or -$1,234.56). Returns raw if not a number. */
export function formatCurrencyDisplay(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!isFinite(n)) return String(raw);
  const abs = Math.abs(n);
  const formatted = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${formatted}` : formatted;
}
