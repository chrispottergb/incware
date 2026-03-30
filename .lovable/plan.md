

## Remove Redundant Shortcut Buttons from Meetings Tab

### What changes
**File: `src/components/company/MeetingsTab.tsx`** (lines 393–406)

Remove the three shortcut buttons:
- "Written Consent" (line 394–396)
- "Annual Meeting Minutes" (line 399–401)
- "Org Meeting Minutes" (line 402–404)
- The wrapping `isLLCType` conditional block (lines 397–406)

**Keep untouched:**
- Meeting count display (lines 388–391)
- "Import Tax Return" button (lines 407–418)
- "+ New Meeting" button (lines 419–424)
- All dialogs, wizards, and logic below

### Technical detail
Delete lines 394–406 entirely. The `flex items-center gap-2` wrapper div (line 393) stays, now containing only Import Tax Return and New Meeting buttons.

