# Multiple Certificates per Owner at Onboarding

## Short answer

The data model already supports it. The onboarding dialog does not.

- Certificates live in their own table, one row per certificate, each with its own number, owner link, share/unit count, issue date, and status (active / cancelled). Several companies in the database already have multiple certificates tied to a single owner, including cancelled-then-reissued chains. So no schema change is needed.
- Ownership totals are already computed by summing ledger transactions as of a date — not by reading a single certificate field — so multi-certificate owners total correctly.
- The gap is the **Establish Current Ownership** dialog used when onboarding an existing company: it allows exactly one row per person, one certificate number per row, and it forces every certificate's issue date to equal the single "opening balance date." Historical certificate dates are therefore lost at onboarding.
- The Membership/Stock Certificates tab already lets you add certificates individually with their own original issue date, so today the workaround is: onboard with one row per owner, then add the extra certificates manually.

## What to change

### 1. Onboarding dialog: rows become certificates, not owners

Rework the ownership grid so each row is one certificate:

- Columns: Owner, Class, Shares/Units, Certificate #, **Issue Date**, Status (Active / Cancelled), Notes.
- **Owner is an explicit selection, not free text.** Each row has an owner picker listing the entity's existing owner records plus any owners already added in this dialog session, with a separate "+ New owner" action that opens a small name field and creates one new record. No silent string matching, so "John Smith" and "John Smith Jr." can never be merged or split by accident, and stray whitespace or typos cannot spawn duplicates.
- An "Add certificate" action on each owner adds another row already pointing at that same owner record.
- A per-owner subtotal and an entity-wide total are shown live so the entered cap table can be checked before saving.

### 2. Preserve original issue dates

- Each row's Issue Date defaults to the "as of" date but is freely editable to any earlier historical date.
- The opening-balance date remains the single "as of" pickup date and continues to lock later transactions from being back-dated before it — but certificate issue dates and the matching opening-balance ledger entries will carry their own original dates so the certificate history reads accurately.
- Rows marked Cancelled capture their own cancellation date and are excluded from the opening totals, so a cancelled-then-reissued chain can be entered directly at onboarding.

### 3. Validation

- **Certificate numbers are unique per entity only** — the check is scoped to the company being onboarded. Different companies may freely reuse the same numbering (Cert #1, #2, ...); there is no global uniqueness rule and none will be added.
- Issue date cannot be later than the "as of" date. A cancellation date, when present, must be on or after its certificate's issue date.
- Rows with no owner or zero shares are ignored.
- The "at least one active certificate" rule is **entity-wide, not per owner**. A fully divested prior owner can be entered here with only cancelled certificates and no active ones — the dialog accepts that and records the history. The rule only prevents saving an onboarding where the whole entity has zero active certificates. Divested owners are created as owner records holding zero active shares, so they show 0% ownership while their certificate history remains on file.

### 4. Downstream checks

- Certificates tab, stock ledger, transfer ledger, and ownership percentage recalculation all already read from the certificate and transaction tables, so they pick up multi-certificate owners with no change. These will be verified after the dialog change.


## Technical notes

- No migration required: `stock_certificates` is already a one-to-many child of `shareholders` with `certificate_number`, `num_shares`, `issue_date`, `cancelled_date`, `status`.
- All edits are in `src/components/company/EstablishOwnershipDialog.tsx`: the `OwnerRow` shape gains `issue_date` and `status`, the save mutation groups rows by normalized owner name, and per-certificate `issue_date` replaces the shared `balanceDate` on both the certificate insert and its paired opening-balance transaction.
- `companies.opening_balance_date` keeps its current meaning (the pickup date and the back-dating lock).
- Verification: enter a two-certificate owner with distinct historical dates, confirm the certificates tab shows both with original dates, and confirm the ledger and ownership percentages total correctly.
