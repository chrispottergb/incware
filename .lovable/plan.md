## Remove Agent Type and Phone from Registered Agent UI

The Registered Agent section in `src/pages/AnnualReviewPublic.tsx` currently renders two fields that don't exist in the schema: Agent Type and Phone. Remove them so only the valid fields display and the submission JSON omits them.

### Changes — `src/pages/AnnualReviewPublic.tsx`

Remove two lines from the Registered Agent `<Section>` (lines 449–461):

- Line 453: `<EditField label="Agent Type" ... />` — delete
- Line 459: `<EditField label="Phone" ... />` — delete

Resulting section will render only: Agent Name, Address, Address 2, City, State, ZIP, Email.

### Submission JSON

`new_entries.registeredAgent` is built from the `edits.registeredAgent` state object. Once the two inputs are removed, the `type` and `phone` keys will no longer be written by the user. Existing snapshot values for those keys (if any) flow in via `...(snap.registeredAgent || {})` at line 188 — leave that spread alone since it's snapshot pass-through, not new-entry capture. No other code paths reference `registeredAgent.type` or `registeredAgent.phone`.

### Not changed

- Snapshot data and snapshot UI rendering
- Database schema
- Jotform integration
- Any other Annual Review sections (the `agent_administrator` field on benefits at line 678 is unrelated and stays)