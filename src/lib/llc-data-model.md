# LLC / SMLLC Data Model — entityIQ Mapping

> ⚠️ **Do not build a parallel schema.** The entityIQ tables (`companies`, `shareholders`, `officers`, `share_transactions`, `registered_agent_history`) **are** the LLC/SMLLC data model. Any new `entities`, `members`, or `capital_contributions` tables will fork the app and break the `share_transactions` source-of-truth invariant. If a field appears missing, **extend the existing table**.

This document maps the canonical LLC document-generation spec onto the existing entityIQ schema. Use it whenever a feature request describes a new "Entity / Member / Officer / Capital Contribution" model — it is almost certainly already implemented.

## Mapping

| Spec entity | Existing table / column | Notes |
|---|---|---|
| `Entity` | `companies` | `entity_type` supports `LLC`, `Single Member LLC`, `LLC-S`, `Corporation`. `name`, `state_of_incorporation`, `incorporation_date`, `user_id` cover the spec. |
| `Entity.isSingleMember` (derived) | Computed via `isLLCType()` + member count. **Never stored.** |
| `RegisteredAgent` | `companies.registered_agent_*` + `registered_agent_history` | Name + full address. History captures changes over time. |
| `Governance.managementType` | `companies.management_type` / `llc_management_structure` | `member-managed` \| `manager-managed`. |
| `Governance.scheduledAnnualMeetingDate` | `companies.scheduled_meeting_ordinal`, `scheduled_meeting_day_of_week`, `scheduled_meeting_month` (structured). `companies.scheduled_annual_meeting` is a **generated column** (`GENERATED ALWAYS AS ... STORED`) that builds the display string (e.g. `"2nd Tuesday in May"`) from the three structured fields. **UI must write the structured fields only — never the display column.** |
| `Member` | `shareholders` (terminology mapped via `src/lib/entity-terminology.ts`) | `name`, address, `ownership_percentage` all present. |
| `Member.membershipUnits` / `membershipInterest` | **Derived from `share_transactions`** (single source of truth). `ownership_percentage` is recalculated by the `recalculate_ownership_percentages()` database function. Interest is stored as a decimal; display layer multiplies × 100. |
| `Officer` (Managing Member, Manager, Secretary, Treasurer) | `officers` table + `companies.llc_authorized_binders` jsonb for LLC binders | Roles surface through `entity-terminology.ts`. Extensible across entity types via the terminology layer — no schema change needed for new role labels. |
| `CapitalContribution` | `share_transactions` rows with `transaction_type` in `Capital Contribution`, `Initial Contribution`, `additional_contribution` | `consideration_type` + `consideration_description` cover Cash / Property / Services / Other. |
| `createdAt` / `updatedAt` | Present on every table. |
| RLS / multi-tenant | Every table scopes via `companies.user_id`. Already enforced. |

## Validation

- `validateMembershipInterestSum(decimal[])` in `src/lib/transaction-validation.ts` — sums must equal 1.0 ±0.0001.
- `validateLLCTotalInterest(...)` is `@deprecated` (percent-based legacy API) — migrate call sites to the decimal version, then remove.

## Future work (not in scope)

- Promote `officers` role columns to a `company_officer_roles` lookup table when a third entity type needs distinct role sets.
- Wire the structured `scheduled_meeting_*` fields into the company-edit form (currently DB-only).
