import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mask an EIN for display: "12-3456789" → "XX-XXXX789". Returns "—" for empty/null. */
export function maskEin(ein: string | null | undefined): string {
  if (!ein) return "—";
  const digits = ein.replace(/\D/g, "");
  if (digits.length < 3) return ein;
  const last3 = digits.slice(-3);
  return `XX-XXXX${last3}`;
}
