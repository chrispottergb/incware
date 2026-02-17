

# Link Authorized Signatories to Meeting Dates

## Goal
Track when each authorized signatory was active so that for any given meeting date, we can see exactly who was authorized to sign on behalf of the company at that point in time.

## Step 1: Add Date Tracking to Authorized Signatories

Add `effective_date` and `end_date` columns to the existing `bank_authorized_signers` table:

| Column | Type | Purpose |
|---|---|---|
| effective_date | date | When this person became an authorized signatory (defaults to today) |
| end_date | date | When authorization ended (NULL = still active) |

This lets us determine who was authorized on any date by checking: `effective_date <= meeting_date AND (end_date IS NULL OR end_date >= meeting_date)`.

## Step 2: Create a Meeting-Signatory Snapshot Table

Create `meeting_authorized_signers` to store a snapshot of who was authorized at each meeting:

| Column | Type | Purpose |
|---|---|---|
| id | uuid (PK) | Primary key |
| meeting_id | uuid (FK to meetings) | Which meeting |
| signer_id | uuid (FK to bank_authorized_signers) | Links to the actual signatory record |
| signer_name | text | Snapshot of name at time of meeting |
| title | text | Snapshot of title |
| bank_name | text | Snapshot of bank name |
| created_at | timestamptz | Record timestamp |

RLS policies will follow the existing meeting sub-table pattern (join through meetings to companies to verify user_id).

## Step 3: Update BanksTab UI

Modify the "Add Authorized Signatory" dialog and table to include:
- **Effective Date** field (date picker, defaults to today)
- **End Date** field (date picker, optional -- leave blank if still active)
- **Status badge** showing "Active" or "Inactive" based on dates
- Table columns updated to show effective/end dates

## Step 4: Add "Authorized Signatories" Tab to Meeting Detail

Add a new tab called **"Auth. Signatories"** to the Meeting Detail page that:
- Shows a table of signatories who were active on the meeting date (auto-populated from date ranges)
- Has an "Auto-populate from records" button that finds all signatories where `effective_date <= meeting_date AND (end_date IS NULL OR end_date >= meeting_date)` and inserts them as snapshots
- Allows manual add/remove for corrections
- Each row shows: Signatory Name, Title, Bank, and a status indicator
- Includes a Print button for PDF export

## Step 5: Include in Full Meeting Minutes PDF

Update the meeting minutes PDF export to include the authorized signatories section when data exists.

## Files to Create/Modify

| File | Action |
|---|---|
| Migration SQL | Add columns to `bank_authorized_signers`, create `meeting_authorized_signers` table with RLS |
| `src/components/company/BanksTab.tsx` | Add effective_date/end_date fields to signatory form and table |
| `src/components/meeting/MeetingAuthorizedSigners.tsx` | New component for the meeting detail tab |
| `src/pages/MeetingDetail.tsx` | Add "Auth. Signatories" tab |
| `src/lib/meeting-pdf-export.ts` | Include signatories in full minutes PDF |

## Technical Details

### Auto-populate Logic
When the user clicks "Auto-populate" on a meeting's signatories tab:
1. Query `bank_authorized_signers` where `company_id` matches and `effective_date <= meeting.meeting_date AND (end_date IS NULL OR end_date >= meeting.meeting_date)`
2. Join with `company_banks` to get bank names
3. Insert snapshot rows into `meeting_authorized_signers` (skip duplicates by signer_id)

### Data Integrity
- `meeting_authorized_signers.signer_id` uses `ON DELETE SET NULL` so historical meeting records survive if a signatory is later removed
- The snapshot fields (signer_name, title, bank_name) preserve the record even if the source data changes later
- The `effective_date`/`end_date` on `bank_authorized_signers` are optional for backward compatibility (existing records default effective_date to their created_at date)

