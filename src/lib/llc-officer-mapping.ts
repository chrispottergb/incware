/**
 * Maps a dynamic LLC manager list (from public.llc_managers) into a canonical
 * 4-role snapshot that is dual-written to public.officers so existing PDFs,
 * compliance checks, and pre-fill paths keep working unchanged.
 *
 * First non-empty row whose title matches a role bucket (in display_order) wins.
 * A row can fill only one slot. Roles with no match are explicitly null so the
 * snapshot always reflects current state (stale values are never left behind).
 */

export type LlcManager = { title: string; name: string };

export type CompanyOfficerSnapshot = {
  president: string | null;
  vice_president: string | null;
  secretary: string | null;
  treasurer: string | null;
};

/** Titles offered in the LLC dynamic officer dropdown (display order). */
export const LLC_DYNAMIC_TITLE_OPTIONS: string[] = [
  "Managing Member",
  "Manager",
  "Member-Manager",
  "Chief Manager",
  "Operations Manager",
  "Assistant Manager",
  "President",
  "Vice President",
  "Secretary",
  "Assistant Secretary",
  "Secretary/Treasurer",
  "Treasurer",
  "Assistant Treasurer",
  "Financial Manager",
  "Organizer",
  "CEO",
  "CFO",
];

const norm = (s: string) => s.trim().toLowerCase();

const ROLE_MATCHERS: Array<{
  role: keyof CompanyOfficerSnapshot;
  titles: string[];
}> = [
  {
    role: "president",
    titles: [
      "managing member",
      "manager",
      "member-manager",
      "chief manager",
      "operations manager",
      "president",
      "ceo",
    ],
  },
  {
    role: "vice_president",
    titles: ["assistant manager", "vice president"],
  },
  {
    role: "secretary",
    titles: ["secretary", "organizer", "secretary/treasurer", "assistant secretary"],
  },
  {
    role: "treasurer",
    titles: ["treasurer", "financial manager", "cfo", "assistant treasurer"],
  },
];

export function buildOfficerSnapshot(managers: LlcManager[]): CompanyOfficerSnapshot {
  const snap: CompanyOfficerSnapshot = {
    president: null,
    vice_president: null,
    secretary: null,
    treasurer: null,
  };
  const used = new Set<number>();

  // First pass: combined "Secretary/Treasurer" fills BOTH slots from a single row.
  for (let i = 0; i < managers.length; i++) {
    const m = managers[i];
    if (!m?.name?.trim()) continue;
    if (norm(m.title || "") === "secretary/treasurer") {
      snap.secretary = m.name.trim();
      snap.treasurer = m.name.trim();
      used.add(i);
      break;
    }
  }

  for (const { role, titles } of ROLE_MATCHERS) {
    if (snap[role]) continue;
    for (let i = 0; i < managers.length; i++) {
      if (used.has(i)) continue;
      const m = managers[i];
      if (!m?.name?.trim()) continue;
      if (titles.includes(norm(m.title || ""))) {
        snap[role] = m.name.trim();
        used.add(i);
        break;
      }
    }
  }
  return snap;
}
