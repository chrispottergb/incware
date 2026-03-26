

# Written Consent Wizard — Feasibility & Implementation Plan

## What Already Exists

The system has strong foundations for this feature:

- **"Written Consent" is already a meeting type** in `MeetingsTab.tsx` and the `meetings` table
- **Resolution templates** exist per entity type (Corporation, S-Corp, LLC, SMLLC) in `MeetingResolutions.tsx` with WHEREAS/RESOLVED language and statutory citations
- **PDF export** already renders a "WRITTEN CONSENT IN LIEU OF A MEETING" header with proper formatting
- **Entity terminology system** dynamically maps Directors↔Authorized Binders, Shareholders↔Members, etc.
- **Shareholder/Director/Officer data** is queryable from `shareholders`, `directors`, and `officers` tables
- **Management type** (Member Managed / Manager Managed) is stored on the company record

## What Needs to Be Built

A single new component: `WrittenConsentWizard.tsx` — a 5-step dialog wizard triggered from the Meetings tab (similar to how `OrgMeetingWizard` and `AnnualMeetingWizard` already work).

### Step 1: Entity (auto-filled)
- Pull company name, entity type, state, tax year, address from company record
- Show "Management structure" dropdown for LLCs (Board of Directors is implicit for Corps)
- Show effective date picker + auto-filled date drafted
- All auto-filled fields marked with badges (as shown in screenshots)

### Step 2: Action
- **Action category** dropdown: Banking, Compensation, Governance, Operations, Ownership, Tax Elections, etc.
- **Specific action** dropdown filtered by category — maps directly to existing `RESOLUTION_TYPES` in `MeetingResolutions.tsx`
- **Voting threshold** section with entity-type-aware logic:
  - Corporation: auto-set "Unanimous", show Wis. Stat. § 180.0704
  - LLC Member-managed: all members, check threshold
  - LLC Manager-managed: managers only
  - SMLLC: hide threshold entirely
- **Consent type** dropdown (Unanimous / Majority) + ownership % field

### Step 3: Resolution
- Display the matched resolution template (from existing `RESOLUTION_TYPES` data)
- Parse template variables (e.g., `$_______`, `[Amount]`) into fillable input fields
- Show "Fill in required variables" warning until all are completed
- Bank name field for banking-related resolutions

### Step 4: Signers
- Auto-populate from entity record:
  - Corporation → all directors (from `directors` table)
  - LLC Member-managed → all members (from `shareholders` table)
  - LLC Manager-managed → managers only
  - SMLLC → sole member
- Show each signer with avatar, name, title/role, and "Pending" status badge
- Info banners explaining auto-population and consent requirements

### Step 5: Review
- Summary of all selections
- "Create consent" button that:
  1. Creates a `meetings` record with `meeting_type = "Written Consent"`
  2. Saves resolution text with filled variables to `meeting_resolutions`
  3. Records signers (can reuse `meeting_directors` or `meeting_shareholders`)
  4. Navigates to the meeting detail page

### Validation Warnings (fire before advancing)
- Unanimous required but ownership % < 100
- Required variable fields left blank in resolution
- No operating agreement uploaded for LLC threshold check
- Member attempting to sign manager-managed consent
- Effective date is in the past

## Technical Approach

### Files to Create
1. **`src/components/WrittenConsentWizard.tsx`** — The 5-step wizard dialog (~600-800 lines, following the pattern of `AnnualMeetingWizard.tsx`)

### Files to Modify
1. **`src/components/company/MeetingsTab.tsx`** — Add wizard trigger button and state (similar to org/annual wizard buttons)
2. **`src/components/meeting/MeetingResolutions.tsx`** — Extract `RESOLUTION_TYPES` to a shared constant so the wizard can reuse them, and add action category groupings

### Data Model
No new database tables needed. Written consents are stored as meetings with `meeting_type = "Written Consent"`. Resolution text, signers, and variables all fit existing tables (`meetings`, `meeting_resolutions`, `meeting_directors`/`meeting_shareholders`).

### Entity Logic Mapping (from your diagram)

```text
Entity Type Selection
├─ Corporation
│   → Hide management type field
│   → Auto: voting threshold = Unanimous
│   → Auto: statute = Wis. Stat. § 180.0704
│   → Show: all directors as signers
│
├─ LLC
│   ├─ Member-managed
│   │   → Auto: signers = all members
│   │   → Calc: check operating agreement for threshold
│   │   → Warn: if <100% and unanimous required
│   │
│   ├─ Manager-managed
│   │   → Auto: signers = managers only
│   │   → Warn: block member-only approval
│   │   → Calc: threshold from operating agreement
│   │
│   └─ SMLLC
│       → Hide: voting threshold entirely
│       → Auto: signer = sole member
│       → Auto: consent valid by sole member signature
│
Action Category → Triggers
├─ Show: specific action dropdown filtered by category
├─ Auto: load matching resolution template
├─ Show: dynamic variable fields from template
└─ Auto: insert statute reference for entity/state
```

## Summary

This is a natural extension of your existing architecture. The resolution templates, entity terminology, PDF export, and data model all support it without schema changes. The main deliverable is the wizard UI component, which follows established patterns from the Annual and Org meeting wizards.

