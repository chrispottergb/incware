# Built-in Ratification Section for Annual Meetings

Add a first-class "Ratification of Interim Actions" capability: informal actions are logged with their own dates as they happen during the year, and the annual meeting sweeps every unratified item in the period into one ratification resolution printed in the minutes.

## How it works

**1. Interim Actions log (company level)**

A new "Interim Actions" list on the company record. Each entry records:
- Action date (the real date it happened — the *effective* date)
- Short title and description
- Category (Banking, Contract, Compensation, Equity, Tax/Election, Distribution, Officer/Manager action, Other)
- Approved/taken by (name, optional title)
- Optional linked document
- Status: Unratified / Ratified (with the meeting that ratified it) / Excluded

Entries can be added any time. This is the honest declared-vs-effective record: the action's own date stays intact, and ratification is a separate later event.

**2. Ratification tab on annual meetings**

A new "Ratification" tab in the meeting workspace (annual meetings and written consents). It shows:
- All unratified interim actions with an action date on or before the meeting date and on or after the prior annual meeting date (period is shown and editable).
- Auto-suggested candidates from records already in the system dated in that period — share transactions, loans, lease transactions, agreements executed, banking/signer changes, vehicle transactions — presented as checkbox candidates you accept or skip. Accepting one creates an interim-action entry linked back to the source record so it can't be double-counted.
- Ability to add a free-text action inline (date + description).
- Each row can be included or excluded from this meeting's ratification.

On save, included items are stamped ratified by this meeting.

**3. Printed minutes**

A "Ratification of Interim Actions" section is inserted into the annual meeting minutes (after Other Business, before Adjournment), formatted to match the existing banking-tab style:

```text
WHEREAS, during the period from January 1, 2025 through December 31, 2025,
certain actions were taken on behalf of the Company by its officers,
directors, or authorized persons without formal action at a meeting; and

WHEREAS, the [Board of Directors / Members] has reviewed each such action
as set forth below;

    NOW, THEREFORE, BE IT RESOLVED, that each of the following actions,
    taken on the date indicated, is hereby ratified, approved, and confirmed
    in all respects as the act of the Company as of the date so taken:

        March 14, 2025 — Opened operating account at First National Bank.
        June 2, 2025 — Executed equipment lease with Acme Leasing, LLC.
        ...

    FURTHER RESOLVED, that ratification of the foregoing actions shall
    relate back to the respective dates on which such actions were taken.
```

If there are no items, the section prints "No interim actions requiring ratification were presented" (or is omitted, controlled by a toggle on the tab). Wording adapts to entity type via existing terminology (Board of Directors / Members / Managing Member) with the matching statutory citation (Wis. Stat. § 180.0302 for corporations, § 183.0301 for LLCs).

## Technical notes

- **New table** `interim_actions`: company_id, action_date, title, description, category, actor_name, actor_title, source_table/source_id (nullable, for de-dup of auto-suggested items), document_id, status, ratified_meeting_id, ratified_at, standard timestamps. RLS scoped like other company-child tables (owner + role policies matching `meeting_resolutions`), with explicit GRANTs and an updated_at trigger. Unique partial index on (source_table, source_id) to prevent duplicate suggestions.
- **New components**: `src/components/company/InterimActionsTab.tsx` (log + CRUD) and `src/components/meeting/MeetingRatification.tsx` (sweep UI, candidate suggestions, include/exclude, save).
- **Candidate discovery** in `src/lib/interim-actions.ts`: pure functions mapping rows from `share_transactions`, `meeting_loans`, `agreements`, `company_banks`/`bank_authorized_signers`, `asset_transactions`, `meeting_vehicle_*` into candidate descriptors with a date and generated sentence. Unit-tested.
- **PDF**: new `renderRatificationSection` in `src/lib/meeting-pdf-export.ts` using existing WHEREAS/RESOLVED indent constants; called from the annual minutes builder. Nonprofit path (`nonprofit-annual-meeting-pdf.ts`) gets the same section with Board wording.
- **Wiring**: add the tab to `MeetingDetail.tsx` sub-tabs (annual + written consent) and to the company tab list; `AnnualMeetingWizard` gains a step that previews the sweep.
- **Period default**: prior annual meeting date + 1 day through this meeting's date; falls back to Jan 1 of the tax year when no prior meeting exists.
