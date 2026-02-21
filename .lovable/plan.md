

## Fix Calendar Interactivity

The calendar date pickers are not responding properly to clicks. This is a known issue when calendars are rendered inside popovers or dialogs -- pointer events get blocked.

### The Fix

**File:** `src/components/ui/calendar.tsx`

Add `pointer-events-auto` to the DayPicker's root className so it remains interactive in all contexts (popovers, dialogs, sheets, etc.):

- Change: `cn("p-3", className)`
- To: `cn("p-3 pointer-events-auto", className)`

This single change fixes all calendar instances across the app since they all use this shared Calendar component.

