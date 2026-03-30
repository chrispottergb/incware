

# Fix: Written Consent Data Persistence + Re-open Wizard

## Problem Summary

**Bug 1 — Data lost on Promissory Note transition**: The WrittenConsentWizard only saves data when the user clicks "Create Consent" on the final step. If the user closes the wizard or navigates away at any point (e.g. after creating a promissory note), all form data is lost. There is no intermediate/draft save.

**Bug 2 — Cannot re-open wizard from Meetings tab**: Clicking a Written Consent entry in the Meetings list navigates to `MeetingDetail.tsx` — the standard tabbed meeting view. There is no way to reopen the wizard with the existing record's data for editing.

## Fix

### 1. Auto-save consent as draft on step transitions and before promissory note
**File: `src/components/WrittenConsentWizard.tsx`**

- Add a `meetingId` state to track whether a draft record exists
- Accept an optional `existingMeetingId` prop for edit mode
- On first "Next" click (step 0 → 1), create a draft meeting record with `meeting_type: "Written Consent"` and store the returned ID
- On subsequent step transitions, update the existing meeting record and upsert resolution/signers
- Before opening the promissory note dialog, trigger a save of the current state
- On "Create Consent" (final step), do a final update rather than insert (if draft exists)
- When `existingMeetingId` is provided, load all data from DB on mount (meeting fields, resolution, signers) and populate the form state

Key changes:
- New `draftMeetingId` state, initialized from `existingMeetingId` prop
- New `saveDraft()` async function that upserts the meeting, resolution, and signers
- Call `saveDraft()` in `setStep(step + 1)` transitions and before `setNoteDialogOpen(true)`
- `createConsent` mutation becomes a final update + navigate (reuses `draftMeetingId`)
- Add `useEffect` to load existing data when `existingMeetingId` is provided

### 2. Update WrittenConsentWizard Props
**File: `src/components/WrittenConsentWizard.tsx`**

```typescript
interface Props {
  company: any;
  existingMeetingId?: string; // NEW: for edit mode
  onClose?: () => void;
  onConsentCreated?: () => void;
}
```

### 3. Open wizard from Meetings tab for Written Consent entries
**File: `src/components/company/MeetingsTab.tsx`**

- Add `editingConsentId` state
- In the meetings list click handler (line 638), check if `m.meeting_type === "Written Consent"`: if so, set `editingConsentId = m.id` and open the consent wizard dialog instead of navigating to MeetingDetail
- Pass `existingMeetingId={editingConsentId}` to `WrittenConsentWizard`
- Reset `editingConsentId` when wizard closes

### 4. MeetingDetail redirect for Written Consent
**File: `src/pages/MeetingDetail.tsx`**

- If `meeting.meeting_type === "Written Consent"`, redirect back to the company page (or show a minimal view with just header + resolutions, as the memory doc describes). The primary editing path will be through the wizard from the Meetings tab.

## Technical Details

**Draft save logic** (`saveDraft` function):
1. If no `draftMeetingId`: INSERT into `meetings` → store returned ID
2. If `draftMeetingId` exists: UPDATE the meeting row with current form state
3. Delete + re-insert `meeting_resolutions` for this meeting ID (simpler than upsert)
4. Delete + re-insert `meeting_directors` or `meeting_shareholders` for signers
5. Return the meeting ID

**Edit mode data loading**:
- Query `meetings` by ID for entity fields (effective_date, tax_year, etc.)
- Query `meeting_resolutions` for resolution text and action
- Query `meeting_directors` / `meeting_shareholders` for signers (read-only display)
- Populate all `useState` values from query results

**Promissory note pre-save**: Call `await saveDraft()` before `setNoteDialogOpen(true)` on line 664, ensuring state is persisted before the user enters the note sub-flow.

