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

- Columns: Owner name, Class, Shares/Units, Certificate #, **Issue Date**, Status (Active / Cancelled), Notes.
- Same owner name can appear on multiple rows; rows are grouped by owner on save so one shareholder record is created per unique name.
- A per-owner subtotal and an entity-wide total are shown live so the entered cap table can be checked before saving.
- An "Add certificate for this owner" action duplicates the owner name into a new row.

### 2. Preserve original issue dates

- Each row's Issue Date defaults to the "as of" date but is freely editable to any earlier historical date.
- The opening-balance date remains the single "as of" pickup date and continues to lock later transactions from being back-dated before it — but certificate issue dates and the matching opening-balance ledger entries will carry their own original dates so the certificate history reads accurately.
- Rows marked Cancelled are written as cancelled certificates (with a cancellation date) and excluded from the opening totals, so a reissue history can be entered at onboarding.

### 3. Validation

- Certificate numbers must be unique within the entity; duplicates are flagged inline before save.
- Issue date cannot be later than the "as of" date.
- At least one active certificate required; rows with no name or zero shares are ignored.

### 4. Downstream checks

- Certificates tab, stock ledger, transfer ledger, and ownership percentage recalculation all already read from the certificate and transaction tables, so they pick up multi-certificate owners with no change. These will be verified after the dialog change.

## Technical notes

- No migration required: `stock_certificates` is already a one-to-many child of `shareholders` with `certificate_number`, `num_shares`, `issue_date`, `cancelled_date`, `status`.
- All edits are in `src/components/company/EstablishOwnershipDialog.tsx`: the `OwnerRow` shape gains `issue_date` and `status`, the save mutation groups rows by normalized owner name, and per-certificate `issue_date` replaces the shared `balanceDate` on both the certificate insert and its paired opening-balance transaction.
- `companies.opening_balance_date` keeps its current meaning (the pickup date and the back-dating lock).
- Verification: enter a two-certificate owner with distinct historical dates, confirm the certificates tab shows both with original dates, and confirm the ledger and ownership percentages total correctly.
