

## Implement 5 Document Changes

### 1. Directors Field -- Remove Dropdown (OrganizationTab.tsx)

The "Initial # of Directors" field under Filing and Articles Details is currently a plain number input, so no dropdown exists there. However, the user reports a dropdown "incorrectly pulling every director ever entered across all meetings." I will verify this at implementation time -- if a Select/dropdown exists anywhere in the Initial Directors section, it will be replaced with a plain text Input. If the field is already a text/number input, no change is needed.

**File:** `src/components/company/OrganizationTab.tsx`

---

### 2. Lease Records -- Add Required Fields

The current Lease form only captures Description and Value. It needs to be expanded with: property address, landlord name, landlord address, lease start date, lease end date, lease term, and monthly payment amount.

**Database migration:** Add columns to `company_assets` table:
- `landlord_name` (text, nullable)
- `landlord_address` (text, nullable)
- `lease_start_date` (date, nullable)
- `lease_end_date` (date, nullable)
- `lease_term` (text, nullable)
- `monthly_payment` (numeric, nullable)

**File:** `src/components/company/CompanyAssetsSection.tsx`
- Expand `leaseForm` state to include all new fields
- Update the lease form UI with inputs for each field
- Update `saveAsset` mutation to include new fields in the payload
- Update the lease table display to show the new columns
- Use `address` field (already exists on `company_assets`) for the property address

---

### 3. Shareholder Annual Meeting -- Director Election Workflow

For "Shareholder Meeting" type meetings, automate the director re-election workflow:
- Auto-populate current shareholders as attendees
- Pull in current board of directors
- Display them as nominated for re-election
- Show their approval by shareholders

**File:** `src/pages/MeetingDetail.tsx`
- Fetch shareholders and directors data when meeting type is "Shareholder Meeting"
- Auto-populate a "Director Re-Election" section showing current directors nominated

**File:** `src/components/meeting/MeetingResolutions.tsx` (or new component)
- Add auto-generated resolution text for director re-election when meeting type is Shareholder Meeting
- Pre-fill attendees from shareholders list

---

### 4. Delete Meeting -- Two-Step Warning

Replace the current single-click delete with a two-step confirmation dialog.

**File:** `src/components/company/MeetingsTab.tsx`
- Add state for tracking delete confirmation steps (`deleteStep`, `deletingId`)
- First AlertDialog: "Are you sure you want to delete this meeting?"
- On confirm, show second AlertDialog: "All information will be lost if you delete this meeting."
- Only execute `deleteMeeting.mutate()` after both confirmations

---

### 5. Resolutions -- Embed in Meetings and Fix Headers

Resolutions should not appear as a standalone item. They should be embedded within the meeting they belong to. Remove the "Purpose" and "Resolution Text" black header labels from the resolution display. Purpose field should only appear for Special Meetings.

**File:** `src/components/meeting/MeetingResolutions.tsx`
- Remove the bold black "Purpose" and "Resolution Text" header labels from the resolution card display (lines 316-317)
- Conditionally show the Purpose/type selector only for Special Meeting types (pass `meetingType` as a new prop)
- For non-special meetings, still allow selecting a resolution template but don't display "Purpose" as a visible header label

**File:** `src/pages/MeetingDetail.tsx`
- Pass `meetingType` prop to `MeetingResolutions` component
- Resolutions already render within the meeting detail page, so they are already "embedded" -- the fix is primarily about the header labels

### Technical Details

**Database migration required for item 2 only:**
```sql
ALTER TABLE company_assets
  ADD COLUMN IF NOT EXISTS landlord_name text,
  ADD COLUMN IF NOT EXISTS landlord_address text,
  ADD COLUMN IF NOT EXISTS lease_start_date date,
  ADD COLUMN IF NOT EXISTS lease_end_date date,
  ADD COLUMN IF NOT EXISTS lease_term text,
  ADD COLUMN IF NOT EXISTS monthly_payment numeric;
```

**Files to modify:**
- `src/components/company/OrganizationTab.tsx` (item 1 -- verify/fix)
- `src/components/company/CompanyAssetsSection.tsx` (item 2 -- lease form expansion)
- `src/pages/MeetingDetail.tsx` (items 3 and 5)
- `src/components/company/MeetingsTab.tsx` (item 4 -- two-step delete)
- `src/components/meeting/MeetingResolutions.tsx` (items 3 and 5)
