/**
 * Name / address text hygiene for the Address Book.
 *
 * Two jobs, both intentionally conservative:
 *
 * 1. `normalizeEntryText` — cleans up *typing accidents only* at the point of
 *    save. It never changes the letters the user chose: no casing changes, no
 *    expanding or abbreviating ("St." stays "St."). Legal records must read
 *    back exactly as entered.
 *
 * 2. `findNearMatch` — a hint engine for data entry. It runs client-side over
 *    the already-loaded suggestion list and surfaces at most one "did you mean"
 *    candidate. It never blocks a save and never rewrites what was typed.
 */

/** Trim ends, collapse internal whitespace runs, strip trailing commas/periods. */
export function normalizeEntryText(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,.\s]+$/, "")
    .trim();
}

/**
 * Comparison key: case-insensitive, punctuation- and whitespace-insensitive.
 * Used for "is this the same entry?" checks — never for storage.
 */
export function comparisonKey(value?: string | null): string {
  return normalizeEntryText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Case-insensitive match key that preserves punctuation (used for upsert dedupe). */
export function matchKey(value?: string | null): string {
  return normalizeEntryText(value).toLowerCase();
}

/** Classic Levenshtein distance, iterative two-row implementation. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

/**
 * True when two entries are close enough to be worth hinting about:
 * - equal after ignoring case, punctuation and whitespace, OR
 * - one is a prefix of the other at >= 5 characters, OR
 * - Levenshtein distance <= 2 for strings >= 6 characters.
 */
export function isNearMatch(typed: string, candidate: string): boolean {
  const t = matchKey(typed);
  const c = matchKey(candidate);
  if (!t || !c) return false;
  if (t === c) return false; // exact match — nothing to hint

  if (comparisonKey(typed) === comparisonKey(candidate)) return true;

  const shorter = t.length <= c.length ? t : c;
  const longer = t.length <= c.length ? c : t;
  if (shorter.length >= 5 && longer.startsWith(shorter)) return true;

  if (t.length >= 6 && c.length >= 6 && levenshtein(t, c) <= 2) return true;

  return false;
}

/**
 * Best single near-match from `candidates`, or null. Returns nothing when the
 * typed value already matches an entry exactly.
 */
export function findNearMatch<T extends { full_name: string }>(
  typed: string,
  candidates: T[],
): T | null {
  const t = matchKey(typed);
  if (t.length < 3) return null;
  if (candidates.some((c) => matchKey(c.full_name) === t)) return null;

  let best: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const c of candidates) {
    if (!isNearMatch(typed, c.full_name)) continue;
    const score = levenshtein(t, matchKey(c.full_name));
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}
