> **GUARDRAIL — read first.** This is the entityIQ gap analysis. **Do NOT create new tables for entities, members, or capital contributions.** Only implement the three deliverables listed in Section 5. The existing schema (`companies`, `shareholders`, `officers`, `share_transactions`, `registered_agent_history`) is the source of truth and must not be forked.

# LLC Data Model — Mapping to entityIQ + Gap Migration

The spec overlaps ~90% with the existing schema. Multi-entity-per-user, RLS, and timestamps are already project-wide. This plan documents the mapping and adds only the missing pieces.

## 1. Mapping spec → existing tables

| Spec entity | Existing table / column | Notes |
|---|---|---|
| `Entity` | `companies` | `entity_type` already supports `LLC`, `Single Member LLC`, `LLC-S`, `Corporation`. `name`, `state_of_incorporation`, `incorporation_date`, `user_id` cover the spec. |
| `isSingleMember` (derived) | Computed via `isLLCType()` + member count. Never stored. |
| `RegisteredAgent` | `companies.registered_agent_*` + `registered_agent_history` | Name + full address already covered. |
| `Governance.managementType` | `companies.management_type` / `llc_management_structure` | Already exists. |
| `Governance.scheduledAnnualMeetingDate` | `companies.scheduled_annual_meeting` (text) | **GAP** — needs structured ordinal/dayOfWeek/month. See §2. |
| `Member` | `shareholders` (terminology mapped via `entity-terminology.ts`) | name, address, `ownership_percentage` all present. |
| `Member.membershipUnits` / `membershipInterest` | Derived from `share_transactions` (single source of truth). `ownership_percentage` recalculated by `recalculate_ownership_percentages()`. |
| `Officer` (Managing Member, Manager, Secretary, Treasurer) | `officers` + `llc_authorized_binders` jsonb | Existing roles are extensible across entity types via `entity-terminology.ts`. |
| `CapitalContribution` | `share_transactions` with `transaction_type` in `Capital Contribution`, `Initial Contribution`, `additional_contribution` | `consideration_type` + `consideration_description` cover Cash/Property/Services/Other. |
| `createdAt`/`updatedAt` | Present on every table. |
| RLS / multi-tenant | All tables scoped via `companies.user_id`. |

## 2. Gap migration — structured scheduled meeting date

Add to `companies`:
- `scheduled_meeting_ordinal` text — `1st | 2nd | 3rd | 4th | Last`
- `scheduled_meeting_day_of_week` text — `Monday`…`Sunday`
- `scheduled_meeting_month` text — `January`…`December`
- `scheduled_annual_meeting` **becomes a generated column** (`GENERATED ALWAYS AS ... STORED`) that concatenates the three structured fields into the display string (e.g., `"2nd Tuesday in May"`) when all three are present, otherwise falls back to NULL. This eliminates drift between structured data and display string — UI never writes the text column directly.

Migration steps:
1. Add the three new columns (nullable, CHECK constraints on each enum).
2. Backfill the three columns by parsing existing `scheduled_annual_meeting` text where possible (best-effort; unparseable rows left null).
3. `DROP` the existing `scheduled_annual_meeting` column, then re-add it as `GENERATED ALWAYS AS (...) STORED`.
4. No RLS change (inherits from `companies`).

## 3. Validation (code, not schema)

Add to `src/lib/transaction-validation.ts`:
- `validateMembershipInterestSum(memberInterestsDecimal: number[]): ValidationResult` — sums must equal 1.0 ±0.0001.

**Before refactoring `validateLLCTotalInterest`:** read its current signature to confirm whether it is percent-based (0–100) or decimal-based (0–1). The plan keeps both functions temporarily:
- New function: decimal-based, for the spec's `membershipInterest` field.
- Existing function: leave as-is with a `/** @deprecated — prefer validateMembershipInterestSum (decimal). Remove once all call sites migrate. */` JSDoc tag so the next developer sees the migration path.

Display layer converts decimal → percent (`× 100`) — never store the percent.

## 4. Officer role extensibility

No schema change. Document the convention in the new markdown file: LLC roles surface via `entity-terminology.ts` and are stored in existing `officers` columns / `llc_authorized_binders`. A `company_officer_roles` lookup table is **future work**, not in scope here.

## 5. Deliverables (the only things to build)

1. **Migration**: add 3 `scheduled_meeting_*` columns + convert `scheduled_annual_meeting` to a generated column.
2. **Code**: add `validateMembershipInterestSum` to `src/lib/transaction-validation.ts`; mark `validateLLCTotalInterest` `@deprecated` with a one-line migration note.
3. **Doc**: create `src/lib/llc-data-model.md` with the mapping table above. Add this banner at the very top of the file:

   > ⚠️ **Do not build a parallel schema.** The entityIQ tables (`companies`, `shareholders`, `officers`, `share_transactions`, `registered_agent_history`) ARE the LLC/SMLLC data model. Any new "entities", "members", or "capital_contributions" tables will fork the app and break the share-transactions source-of-truth invariant. If a field appears missing, extend the existing table.

No UI wiring in this pass — surfacing the structured meeting-date fields in the company form is a follow-up.

## Out of scope
- New `entities` / `members` / `capital_contributions` tables.
- Changing `share_transactions` as the source of truth.
- Refactoring `officers` into a roles lookup table.