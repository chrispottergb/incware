/**
 * Owner name aliasing.
 *
 * Ownership math in this app is partly name-string based: `share_transactions`
 * stores transfers as free text in `from_shareholder` / `to_shareholder`, which
 * is matched against `shareholders.name`. When an owner is legally renamed
 * (marriage, divorce, trust restatement, successor trustee) — or when a
 * historical record contains a misspelling — that string no longer matches and
 * the transfer silently stops resolving to the owner.
 *
 * `shareholder_name_history` records every prior name for an owner record. The
 * helpers below build a normalized alias index so historical names keep
 * resolving to the same owner. The owner record id never changes, so
 * certificates, ledger rows, and capital accounts stay attached.
 */

export interface NameHistoryRow {
  id?: string;
  shareholder_id: string;
  previous_name: string;
  new_name: string;
  effective_date?: string | null;
  reason?: string | null;
  note?: string | null;
  created_at?: string | null;
}

export interface OwnerLike {
  id: string;
  name: string;
}

/** Case-, whitespace-, and punctuation-spacing-insensitive normalization. */
export function normalizeOwnerName(value?: string | null): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Maps every known name (current + all historical names) to the owning
 * shareholder id. Current names win over historical ones on collision.
 */
export function buildOwnerAliasIndex(
  shareholders: OwnerLike[],
  history: NameHistoryRow[] = [],
): Record<string, string> {
  const index: Record<string, string> = {};

  history.forEach((h) => {
    if (!h.shareholder_id) return;
    [h.previous_name, h.new_name].forEach((n) => {
      const key = normalizeOwnerName(n);
      if (key) index[key] = h.shareholder_id;
    });
  });

  // Current names always take precedence.
  shareholders.forEach((s) => {
    const key = normalizeOwnerName(s.name);
    if (key) index[key] = s.id;
  });

  return index;
}

/** Resolve a free-text transaction name to an owner id, honouring prior names. */
export function resolveOwnerIdByName(
  name: string | null | undefined,
  index: Record<string, string>,
): string | null {
  const key = normalizeOwnerName(name);
  if (!key) return null;
  return index[key] ?? null;
}

/** Prior names for one owner, newest effective date first. */
export function priorNamesFor(
  shareholderId: string,
  currentName: string,
  history: NameHistoryRow[] = [],
): { name: string; effective_date?: string | null; reason?: string | null }[] {
  const currentKey = normalizeOwnerName(currentName);
  const seen = new Set<string>([currentKey]);
  const out: { name: string; effective_date?: string | null; reason?: string | null }[] = [];

  [...history]
    .filter((h) => h.shareholder_id === shareholderId)
    .sort((a, b) => String(b.effective_date ?? "").localeCompare(String(a.effective_date ?? "")))
    .forEach((h) => {
      const key = normalizeOwnerName(h.previous_name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ name: h.previous_name, effective_date: h.effective_date, reason: h.reason });
    });

  return out;
}

export const NAME_CHANGE_REASONS_INDIVIDUAL = [
  { value: "marriage", label: "Marriage" },
  { value: "divorce", label: "Divorce" },
  { value: "court_ordered", label: "Court-ordered name change" },
  { value: "correction", label: "Correction (misspelling in the records)" },
  { value: "other", label: "Other" },
];

export const NAME_CHANGE_REASONS_ENTITY = [
  { value: "trust_restatement", label: "Trust restatement or amendment" },
  { value: "successor_trustee", label: "Successor trustee / grantor's death (same trust)" },
  { value: "entity_renaming", label: "Entity renamed" },
  { value: "correction", label: "Correction (misspelling in the records)" },
  { value: "other", label: "Other" },
];

export function reasonLabel(value?: string | null): string {
  if (!value) return "";
  const all = [...NAME_CHANGE_REASONS_INDIVIDUAL, ...NAME_CHANGE_REASONS_ENTITY];
  return all.find((r) => r.value === value)?.label ?? value;
}
