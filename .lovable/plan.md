## Goal

Convert the Annual Review public page from an interactive form into a **read-only snapshot of all client data**, followed by a **blank embedded Jotform iframe**. Reuse the existing token + edge-function infrastructure.

## Confirmed existing infrastructure (keep)

- Route `/annual-review/:token` in `src/App.tsx`
- Token table `annual_review_links` with RLS, expiry, status
- Edge function `supabase/functions/annual-review/index.ts` (`?action=load`) — already validates token, checks expiry, returns a snapshot
- `AnnualReviewLinkGenerator.tsx` token generation + email preview + send flow

## 1. Edge function rewrite — `supabase/functions/annual-review/index.ts`

Keep the GET `?action=load` token validation, expiry checks, and 410/404 handling. **Remove** the entire POST `?action=submit` branch and admin-notification email block (no longer applicable — Jotform handles submission).

Restructure the response payload to the exact shape requested:

```ts
{
  company:        { name, entity_type, address, address_2, city, state, zip, phone,
                    incorporation_date, ein_last4, fiscal_year_end, s_election_date,
                    contact_webpage, status, last_updated },
  contacts:       { contact_full_name, salutation_name, contact_email,
                    contact_phone, contact_cell },
  registeredAgent:{ name, address, address_2, city, state, zip,
                    type, phone, email,
                    annual_filing_status, annual_filing_fee_year },
  accountant:     { accountant_name, firm_name, address, city, state, zip, phone, email },
  attorney:       { attorney_name, firm_name, address, city, state, zip, phone, email },
  banking: {
    bank:    { bank_name, address, city, state, zip, account_type, account_number_last4,
               loc_amount, loc_rate, loc_lender },
    signers: [{ signer_name, title }]
  },
  shareholders:   [{ name, address, city, state, zip, shares_held, ownership_percentage,
                     distribution_amount, can_bind_llc }],
  directors:      [{ name }],
  officers:       [{ title, name, salary, bonus }],   // from latest meeting_officers
  lease:          { property_address, landlord_name, landlord_address, landlord_city,
                    landlord_state, landlord_zip, monthly_payment, leasehold_improvements },
  benefits:       [{ benefit_type, provider, insurance_agency, agent_administrator,
                     eligibility_comments, retirement_contribution }],
  assets:         [{ asset_type, year, make, model, vin,
                     description, purchase_date, purchase_amount, ownership_type }],
  loans:          [{ lender_name, borrower_name, loan_amount, loan_rate, loan_direction }],
  contributions:  [{ agreement_type, agreement_with, amount, agreement_date }], // from agreements
  meeting:        { meeting_date, location, attendees, notes },                  // latest meetings row
  ai:             { systems_count, recent_usage_count, frequency },              // derived label
  review_year, company_name
}
```

Source tables: `companies`, `accountants` + `accountant_firms`, `attorneys` + `attorney_firms`, `company_banks`, `bank_authorized_signers`, `meeting_counsel` (LOC), `shareholders` + `share_transactions` (for shares_held), `directors`, `meeting_officers` (latest meeting), `company_assets` (split into `lease` row vs `assets` Vehicle/Equipment rows), `meeting_benefits` (latest meeting that has any), `meeting_loans` (latest meeting), `agreements` (latest meeting), `meetings` (latest), `ai_systems` + `ai_usage_logs`.

Security:
- EIN exposed only as last-4 (`ein_last4`)
- Bank account numbers as last-4 only
- No SSNs in payload
- Add one `console.log` audit line per load: `{ token_id, company_id, ip, user_agent, ts }`

No payload field is wrapped, transformed, or marked editable. Arrays returned as fetched.

## 2. Rewrite `src/pages/AnnualReviewPublic.tsx`

**Remove entirely:**
- All `useState` for change flags, multi-entry sections, meeting fields, excess earnings, other notes
- `MultiEntrySection` and `CurrentInfoItem` helpers
- `handleSubmit`, the submit button, the `submitted` success screen
- All `?action=submit` POST logic

**Add three small reusable components inside the file:**

```tsx
function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">{value || "—"}</span>
    </div>
  );
}

function Section({ title, icon, children }) { /* Card wrapper */ }
function Subsection({ title, children }) { /* nested heading + content */ }
```

**Render order** (mirrors Jotform pages 1–14):
1. Header card — "Annual Review for {company.name}" + review year + "Last Updated" timestamp
2. Company Information
3. Registered Agent & Compliance
4. Accountant
5. Attorney
6. Banking → with `<Subsection title="Authorized Signers">` listing signers
7. Shareholders / Members (label switches to "Members" for LLC)
8. Directors
9. Officers (table-style: Title · Name · Salary · Bonus)
10. Lease Information
11. Benefits
12. Vehicles & Equipment (rendered from `assets[]`)
13. Loans & Contributions
14. Meeting Details (last meeting on record)
15. AI Compliance
16. Divider
17. **"Update Your Information"** section header + intro text
18. Jotform iframe:
    ```tsx
    <iframe
      src="https://form.jotform.com/261175646963063"
      width="100%"
      height="2000"
      frameBorder={0}
      scrolling="auto"
      allow="fullscreen"
      title="Annual Review Form"
      className="w-full border border-border rounded-md"
    />
    ```
    No query params, no postMessage, loads blank.
19. Footer: "Need help? Contact support at support@entityiq.net" mailto link.
20. **"Download Snapshot as PDF"** button at top-right of header, using a small client-side helper. Implementation: dynamic `import("html2pdf.js")` invoked on the snapshot container ref. Add `bun add html2pdf.js`.

Keep the existing loading / error / expired states.

## 3. Routing — `src/App.tsx`

No structural change. Confirm route stays:
```tsx
<Route path="/annual-review/:token" element={<AnnualReviewPublic />} />
```
No props are passed in or out — `AnnualReviewPublic` reads the token via `useParams` (already does).

## 4. Update link generators

Replace the Jotform-prefill URL builders in:

- `src/components/AnnualReviewLinkGenerator.tsx` (around line 149-160) — currently builds `https://form.jotform.com/261175646963063?entityName=...&token=...`. Replace with:
  ```ts
  const link = `${window.location.origin}/annual-review/${token}`;
  ```
- `src/pages/PendingReviews.tsx` `buildUrl()` (lines 130-140) — same change. Drop the `URLSearchParams` block and `companyData`/`reviewYear` lookups for URL purposes (still keep those for displaying entity info elsewhere).

The "Open" / "Copy" actions in `PendingReviews` then point at our hosted snapshot page.

## 5. Email workflow

`AnnualReviewLinkGenerator.tsx` already builds an email preview and supports Skip / Send. Only the URL embedded in the email changes (since `generatedLink` is used both for preview and for the `send-review-reminder` invoke body). No other email logic changes. The "Skip Email" path already exists for cases where contact email is missing — that satisfies the "if domain email isn't configured" requirement.

## 6. Memory note

Add `mem://features/annual-review-hosted-snapshot`:
- New page is read-only snapshot + blank Jotform iframe (form ID `261175646963063`)
- No URL prefill, no postMessage prefill into Jotform
- Token in URL points at app's own `/annual-review/:token` route
- Edge function `annual-review` returns the structured payload defined above; POST submit branch is removed
- EIN and bank account numbers are masked to last 4 digits in the payload

Update the index to reference the new memory and supersede the prior interactive-form description.

## Out of scope

- Building / editing the Jotform form itself (user maintains in Jotform with the named fields they listed)
- Webhook to ingest Jotform submissions back into the DB — separate follow-up
- Custom domain `entityiq.net` (links use `window.location.origin` until DNS is configured)

## Files to be created / edited

- **Edit (large rewrite)**: `supabase/functions/annual-review/index.ts` — restructured snapshot payload, drop submit branch, add audit log
- **Edit (large rewrite)**: `src/pages/AnnualReviewPublic.tsx` — read-only snapshot + iframe, remove all editing
- **Edit**: `src/components/AnnualReviewLinkGenerator.tsx` — link points to our hosted page
- **Edit**: `src/pages/PendingReviews.tsx` — `buildUrl` simplified
- **Add dep**: `html2pdf.js`
- **New memory**: `mem://features/annual-review-hosted-snapshot`