# LLC Dynamic Officer List — Revised Plan (Details for Approval)

## 1. Full migration SQL

```sql
-- Table
CREATE TABLE public.llc_managers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title         text NOT NULL,
  name          text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for ordered fetch per company
CREATE INDEX llc_managers_company_order_idx
  ON public.llc_managers (company_id, display_order);

-- Grants (no anon — owner-only via auth.uid())
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llc_managers TO authenticated;
GRANT ALL ON public.llc_managers TO service_role;

-- RLS
ALTER TABLE public.llc_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select their llc_managers"
ON public.llc_managers FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE POLICY "Owners insert their llc_managers"
ON public.llc_managers FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE POLICY "Owners update their llc_managers"
ON public.llc_managers FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE POLICY "Owners delete their llc_managers"
ON public.llc_managers FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

-- updated_at trigger (reuses existing function)
CREATE TRIGGER llc_managers_set_updated_at
BEFORE UPDATE ON public.llc_managers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- One-time backfill (idempotent guard)
INSERT INTO public.llc_managers (company_id, title, name, display_order)
SELECT c.id, v.title, v.nm, v.ord
FROM public.companies c
CROSS JOIN LATERAL (VALUES
  ('Managing Member',   c.president,      0),
  ('Assistant Manager', c.vice_president, 1),
  ('Secretary',         c.secretary,      2),
  ('Treasurer',         c.treasurer,      3)
) AS v(title, nm, ord)
WHERE c.entity_type IN ('LLC','LLC-S','Single Member LLC')
  AND COALESCE(v.nm, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.llc_managers m WHERE m.company_id = c.id);
```

No CHECK constraints on `title` (per Postgres convention here — UI enforces the dropdown; trigger-based validation is overkill for a free-text label).

## 2. Dual-write mapping helper

New file `src/lib/llc-officer-mapping.ts` (pure TS, unit-testable):

```ts
export type LlcManager = { title: string; name: string };

export type CompanyOfficerSnapshot = {
  president: string | null;
  vice_president: string | null;
  secretary: string | null;
  treasurer: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

// Title -> canonical role. First non-empty match wins per role.
const ROLE_MATCHERS: Array<{
  role: keyof CompanyOfficerSnapshot;
  titles: string[];
}> = [
  { role: "president",      titles: ["managing member", "manager", "member-manager", "chief manager", "operations manager", "president", "ceo"] },
  { role: "vice_president", titles: ["assistant manager", "vice president"] },
  { role: "secretary",      titles: ["secretary", "organizer", "secretary/treasurer", "assistant secretary"] },
  { role: "treasurer",      titles: ["treasurer", "financial manager", "cfo", "assistant treasurer"] },
];

export function buildOfficerSnapshot(managers: LlcManager[]): CompanyOfficerSnapshot {
  const snap: CompanyOfficerSnapshot = {
    president: null, vice_president: null, secretary: null, treasurer: null,
  };
  const usedIds = new Set<number>();

  for (const { role, titles } of ROLE_MATCHERS) {
    for (let i = 0; i < managers.length; i++) {
      if (usedIds.has(i)) continue;
      const m = managers[i];
      if (!m?.name?.trim()) continue;
      if (titles.includes(norm(m.title))) {
        snap[role] = m.name.trim();
        usedIds.add(i);          // a row can fill only one slot
        break;                   // first match wins for this role
      }
    }
  }
  return snap;
}
```

Behaviour answers to your two questions:

- **Two Managing Members in the list?** The first one in `display_order` is written to `companies.president`. The second remains a row in `llc_managers` but does not overwrite anything (its index is marked used only if it actually wins a slot — here it doesn't, so it stays available for another role if its title matched one, which it doesn't). It will still appear in the Annual Meeting roster (step 4) because that path reads `llc_managers` directly.
- **Manager deleted and no remaining entry for that role?** `buildOfficerSnapshot` returns `null` for that role. The Org tab save runs:

  ```ts
  await supabase.from("companies").update({
    president:      snap.president,
    vice_president: snap.vice_president,
    secretary:      snap.secretary,
    treasurer:      snap.treasurer,
  }).eq("id", companyId);
  ```

  So the stale value is **explicitly nulled** — never left in place. This is the safer default: the snapshot always reflects current state. The trade-off (an "empty LLC officers" state can fail the compliance "has officers" check) is mitigated by requiring at least one row before save in the UI.

## 3. `AnnualMeetingWizard.tsx` — confirmed in scope

Yes, this file is in the modified-files list. Lines 383–386 are inside the LLC branch of the officer pre-fill.

**Before (lines 383–386):**
```ts
if (companyOfficers.president)      officerList.push({ name: companyOfficers.president,      title: "Managing Member", salary: "", bonus: "" });
if (companyOfficers.vice_president) officerList.push({ name: companyOfficers.vice_president, title: "Member",           salary: "", bonus: "" });
if (companyOfficers.secretary)      officerList.push({ name: companyOfficers.secretary,      title: "Secretary",        salary: "", bonus: "" });
if (companyOfficers.treasurer)      officerList.push({ name: companyOfficers.treasurer,      title: "Treasurer",        salary: "", bonus: "" });
```

**After:**
```ts
// Prefer the dynamic LLC manager list; fall back to the legacy four columns
// for companies that have not yet been edited through the new Org tab UI.
const { data: llcManagers } = await supabase
  .from("llc_managers")
  .select("title,name,display_order")
  .eq("company_id", companyId)
  .order("display_order", { ascending: true });

if (llcManagers && llcManagers.length > 0) {
  for (const m of llcManagers) {
    if (m.name?.trim()) {
      officerList.push({ name: m.name, title: m.title, salary: "", bonus: "" });
    }
  }
} else {
  if (companyOfficers.president)      officerList.push({ name: companyOfficers.president,      title: "Managing Member", salary: "", bonus: "" });
  if (companyOfficers.vice_president) officerList.push({ name: companyOfficers.vice_president, title: "Member",           salary: "", bonus: "" });
  if (companyOfficers.secretary)      officerList.push({ name: companyOfficers.secretary,      title: "Secretary",        salary: "", bonus: "" });
  if (companyOfficers.treasurer)      officerList.push({ name: companyOfficers.treasurer,      title: "Treasurer",        salary: "", bonus: "" });
}
```

(Exact fetch call will be adjusted to match the surrounding async pattern in the file; semantics above are the contract.)

## 4. Title dropdown — exact list

Used in both the Org tab dynamic list and accepted by `buildOfficerSnapshot`. Combined LLC + corporate-style titles, in display order:

```
Managing Member
Manager
Member-Manager
Chief Manager
Operations Manager
Assistant Manager
President
Vice President
Secretary
Assistant Secretary
Secretary/Treasurer
Treasurer
Assistant Treasurer
Financial Manager
Organizer
CEO
CFO
```

This will be exported as a new constant `LLC_DYNAMIC_TITLE_OPTIONS` from `src/components/company/OrganizationTab.tsx` (or co-located with the mapping helper) and is a strict superset of the existing `OFFICER_TITLE_OPTIONS.LLC`. The existing `OFFICER_TITLE_OPTIONS` map used by `MeetingOfficersTable.tsx` is **not** modified.

## 5. Files confirmed NOT modified

Zero changes in this pass to:

- `src/lib/meeting-pdf-export.ts`
- `src/lib/record-book-pdf.ts`
- `src/lib/operating-agreement-pdf.ts`
- `src/lib/bylaws-pdf.ts`
- `src/lib/annual-update-pdf.ts`
- `src/components/company/WIComplianceChecklist.tsx`
- `src/pages/Reports.tsx`

These all continue reading `companies.president / vice_president / secretary / treasurer`, which the dual-write keeps current on every Org-tab save.

## 6. Final modified-files list

- `supabase/migrations/<timestamp>_llc_managers.sql` (new — SQL above)
- `src/lib/llc-officer-mapping.ts` (new)
- `src/components/company/OrganizationTab.tsx` (LLC branch: dynamic list UI + dual-write on save)
- `src/components/AnnualMeetingWizard.tsx` (LLC pre-fill: read `llc_managers` with column fallback)
- `src/integrations/supabase/types.ts` (auto-regenerated post-migration)
