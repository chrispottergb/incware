# Mark and purge test data

## Step 0 — Audit report (read-only, already run)

### `companies` columns (83)
id, user_id, name, entity_type, state_of_incorporation, incorporation_date, fiscal_year_end, authorized_shares, par_value, par_value_type, registered_agent_name, registered_agent_address, registered_agent_city, registered_agent_state, registered_agent_zip, s_election_date, address, city, state, zip, phone, created_at, updated_at, corporate_status, verification_date, annual_report_year, seal_type, election_1244, second_name_choice, filing_date, delayed_effective_filing_date, business_purpose, accounting_method, naics_code, first_year_annual_meeting, initial_directors_count, max_directors_allowed, max_vps_allowed, additional_provisions, status, address_2, registered_agent_address_2, authorized_binders, contact_email, salutation_name, contact_full_name, contact_phone, contact_cell, contact_webpage, registered_agent_type, registered_agent_phone, registered_agent_email, registered_agent_appointed_date, registered_agent_resigned_date, management_type, ein, opening_balance_date, has_preferred_shares, preferred_class_name, preferred_authorized_shares, state_filing_number, ntee_code, tax_exempt_purpose, non_distribution_clause, organizational_structure, llc_management_structure, llc_authorized_binders, llc_dfi_statement_filed, llc_dfi_statement_reference, llc_dfi_statement_date, ein_encrypted, scheduled_meeting_ordinal, scheduled_meeting_day_of_week, scheduled_meeting_month, scheduled_annual_meeting, statutory_close_corporation, authorized_units_backfill_dismissed, oa_drafting_style, ownership_snapshot_enabled, board_eliminated, board_elimination_article, board_elimination_date

There is no `is_test` column today.

### Tables with a foreign key to `companies`

Every table below already has `ON DELETE CASCADE` unless marked otherwise. A query confirmed there is **no** table in `public` carrying a `company_id`/`entity_id` column without an FK to `companies` — so the FK list is the complete cascade surface.

**Cascade on company delete (41 direct references):**
accountant_firms, accountants, ai_oversight_contacts, ai_risk_incidents, ai_systems, ai_usage_logs, annual_review_links, annual_review_submissions, asset_transactions (`entity_id`), attorney_firms, attorneys, bank_authorized_signers, bills_of_sale, business_sales, company_assets (`company_id`), company_banks, company_documents, company_relationships (`parent_company_id` and `child_company_id`), directors, document_registry, filing_checklist, interim_actions, llc_managers, meetings, nonprofit_form990_filings, nonprofit_initial_directors, nonprofit_tax_exemption, officers, organizers, ownership_snapshot_lots, ownership_snapshots, registered_agent_history, retired_ownership_records, share_transactions, shareholder_name_history, shareholders, stock_certificates, timeline_events, transaction_assets

**Set NULL instead of cascade (3 references — these rows survive):**
- `company_assets.landlord_company_id`, `company_assets.tenant_company_id` (a lease at another company that pointed at the deleted entity keeps its row, loses the link)
- `tax_return_jobs.company_id`
- `user_address_book.company_id`

**Cascades indirectly through `meetings`:** meeting_amendments, meeting_assets, meeting_authorized_signers, meeting_balance_entries, meeting_benefits, meeting_counsel, meeting_directors, meeting_financials, meeting_lease_terminations, meeting_loans, meeting_non_recurring_items, meeting_officers, meeting_other, meeting_ratifications, meeting_resolutions, meeting_shareholders, meeting_signatures, meeting_vehicle_leases, meeting_vehicle_purchases, meeting_vehicle_sales, agreements, lease_clauses, ai_oversight_persons, lease_classification_audit (child tables of the cascading parents above).

## Step 1 — Migration

```sql
ALTER TABLE public.companies
  ADD COLUMN is_test boolean NOT NULL DEFAULT false;
```

Nothing else. No existing row is reclassified; every company stays `false`.

Two extra cleanup steps the audit shows are needed for the purge to be complete (they are deletes performed by the app, not schema changes):
- `user_address_book` rows whose `company_id` is the deleted company are removed explicitly (the FK only nulls them, which would leave orphan suggestion entries behind).
- `tax_return_jobs` rows for the company are removed explicitly, same reason.

## Step 2 — Mark a company as test

- Checkbox on the company record (Organizational Info / Incorporation panel) labeled **"Test company (excluded from reports and suggestion lists)"**, saved to `companies.is_test`.
- A small outlined **TEST** badge next to the company name everywhere a name is rendered: the company detail header, the sidebar company list, the dashboard company cards, the reports/org-chart/relationship pickers and the entity party picker. The badge sits next to the existing Active/Inactive badge and uses a muted destructive-tinted token, not a hardcoded color.
- Selecting the checkbox invalidates the company and address-book query caches so suggestions update immediately without a refresh.

## Step 3 — Test records drop out of suggestions

- The address-book query keeps a set of test company ids and filters out entries whose `company_id` belongs to a test company, in the same place hidden entries are already filtered. Everything typeahead-driven (`NameAutocomplete`) inherits this.
- The database address autocomplete, which queries `shareholders` and `companies` directly, filters those queries by non-test companies.
- The company/entity pickers (relationships, lease party picker) exclude test companies from their option lists.
- Inside the test company itself nothing changes: its own tabs, forms and existing records display and edit normally.

## Step 4 — Delete test company and all its records

- New destructive action on the company record, rendered **only** when `is_test = true`. On a normal company the button does not exist at all.
- Confirmation dialog requires typing the exact company name; the confirm button stays disabled until it matches.
- The handler re-reads `is_test` from the database immediately before deleting and aborts with an error toast if it is not `true` — so a stale UI or a hand-crafted call cannot purge a live company. There is no override.
- The delete removes the `user_address_book` and `tax_return_jobs` rows for the company, then deletes the `companies` row, which cascades to all 41 referencing tables and their meeting-level children listed in Step 0.
- The existing generic delete button stays as it is for non-test companies.

## Out of scope

No bulk reclassification of existing companies, no PDF builder changes.

## Verification before reporting done

1. On a non-test company, confirm the purge action is absent from the DOM and that invoking the handler directly is refused.
2. Tick the checkbox on a scratch company, confirm its names disappear from a typeahead without a reload while still rendering inside the company.
3. Purge a scratch test company and confirm row counts across the cascade tables drop to zero for that id.
