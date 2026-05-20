## Goal
Adjust entity detail tab navigation for Non-Profit entities only. No content/field changes — navigation structure only.

## Scope
Single file: `src/pages/CompanyDetail.tsx` (the `tabConfig` memo, lines ~140–164).

## Changes (Non-Profit only)
1. Do **not** include the `organization` ("Organizational Info") tab.
2. Do **not** push the `business-sales` ("Business Sales") tab.
3. Rename the `shareholders` tab label from its terminology default to **"Governance"**.

All other entity types (LLC variants, Corporation, S-Corp, etc.) keep their current tab list and labels untouched.

## Resulting Non-Profit tab order
Incorporation Info, Meetings, Governance, Timeline, Leases, Counsel, Banks, Relationships, AI Compliance, Bylaws, Conflict of Interest, Filing & Compliance, Record Book, Documents.

## Implementation sketch
In the non-LLC branch of `tabConfig`:
- Change `...(!isCorp ? [...organization...] : [])` to also exclude Non-Profit (`!isCorp && entityType !== "Non-Profit"`).
- For the `shareholders` entry, use `entityType === "Non-Profit" ? "Governance" : getTerminology(entityType).shareholdersTab`.
- Wrap the `tabs.push({ value: "business-sales", ... })` line in `if (entityType !== "Non-Profit")`.

No changes to TabsContent, routing defaults, or any tab body components.