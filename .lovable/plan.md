

## Plan: Add Multiple Resolutions Support to WrittenConsentWizard

### Summary
Mount `MeetingResolutions` inside the wizard's Step 3 and add an `excludeResolutionIds` filter prop to prevent duplicate display of the primary resolution.

### Changes

#### File 1: `src/components/meeting/MeetingResolutions.tsx`

1. **Add `excludeResolutionIds` to Props interface** (line 39-47): Add optional `excludeResolutionIds?: string[]` prop.

2. **Update component signature** (line 49): Destructure the new prop.

3. **Filter displayed resolutions** (line 319): Replace `resolutions.map(...)` with a filtered list that excludes IDs in `excludeResolutionIds`. Also apply the same filter to `unlinkedTransferResolutions` computation (line 228-231).

#### File 2: `src/components/WrittenConsentWizard.tsx`

1. **Import MeetingResolutions** at the top of the file.

2. **Add "Additional Resolutions" section in Step 3** (after line 1201, before `</div>` at line 1202): Conditionally render when both `draftMeetingId` and `wizardResolutionId` exist:
   ```
   {draftMeetingId && wizardResolutionId && (
     <div className="border-t pt-4 mt-4">
       <h4 className="text-sm font-semibold mb-2">Additional Resolutions</h4>
       <MeetingResolutions
         meetingId={draftMeetingId}
         entityType={company.entity_type}
         companyId={company.id}
         companyName={company.name}
         meetingDate={effectiveDate}
         excludeResolutionIds={[wizardResolutionId]}
       />
     </div>
   )}
   ```

3. **Ensure draft is saved before Additional Resolutions appear**: The wizard already saves the draft (and sets `draftMeetingId` + `wizardResolutionId`) when advancing steps or via auto-save. We'll also add a small "Save & Add More" button that calls `saveDraft()` if the user hasn't navigated away from Step 3 yet, so the section appears after the first resolution is persisted without requiring a step change.

### No database migration needed
The `meeting_resolutions` table already supports multiple rows per `meeting_id`.

### Verification
After implementation: first resolution saved in wizard textarea → "Additional Resolutions" section appears below → Add button opens dialog → new resolution saves as separate row → list refreshes → primary resolution excluded from list → all persist on reopen.

