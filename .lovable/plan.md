

# QA Findings — Broken, Incomplete, or Inconsistent Functionality

## Issues Found

### 1. ResetPassword Race Condition (HIGH)
**File:** `src/pages/ResetPassword.tsx`

The `PASSWORD_RECOVERY` event fires from `onAuthStateChange` when the recovery token is exchanged. But the `useEffect` also subscribes to `onAuthStateChange` inside the ResetPassword component. There's a race: if `getSession()` in `AuthProvider` processes the recovery token *before* the ResetPassword component mounts, the `PASSWORD_RECOVERY` event is already consumed and `isRecovery` stays `false`. The user sees "This link is invalid" even though it's valid.

**Fix:** Check for an active session on mount — if a session exists and the URL contains recovery params, set `isRecovery = true`.

### 2. Idle Timeout Throttle Bug (MEDIUM)
**File:** `src/hooks/useSessionIdleTimeout.ts`

The `handleActivity` callback only updates `lastActivityRef.current` when elapsed > 60s. But since it's created with `useCallback([], [])` (empty deps), the closure is stable. The real issue: the very first mouse event after initialization **does** update the ref (since `Date.now() - initial > 60s` will eventually be true). But if a user is continuously active, the ref updates at most once per minute, meaning the idle check can fire up to 60 seconds early. This is a minor inaccuracy but could cause unexpected sign-outs at 29 minutes of activity.

**Fix:** Change the condition to `>=` and ensure the ref is updated on the *first* activity event unconditionally.

### 3. 265 Raw Error Messages Still Exposed (HIGH)
**Files:** 25 files across the codebase

Only 4 key catch blocks were sanitized in the last pass. 265 instances of `catch (err: any)` remain, many displaying `err.message` directly to users via `toast.error()`. Key offenders:
- `AnnualMeetingWizard.tsx` (3 instances) 
- `WrittenConsentWizard.tsx` (9 instances)
- `PrintPreviewButton.tsx` (3 instances)
- `AnnualReviewPublic.tsx` (1 instance)
- `PendingReviews.tsx` (1 instance)
- `LeaseTransactionDialog.tsx` (1 instance)

**Fix:** Replace `err.message` with generic messages; keep `console.error(err)` for debugging.

### 4. `text-success` CSS Class Missing (LOW)
**File:** `src/pages/ResetPassword.tsx` line 86

`<CheckCircle2 className="... text-success" />` — Tailwind/shadcn doesn't define `text-success` by default. This will render with no color applied.

**Fix:** Use `text-green-600` or define a `success` color in `tailwind.config.ts`.

### 5. No "Load More" UI for Paginated Queries (MEDIUM)
**Files:** `Dashboard.tsx`, `Reports.tsx`

Queries now use `.range(0, 499)`, capping at 500 companies. But there's no UI indication when results are truncated, no "Load More" button, and no total count displayed. Users with 500+ companies will have silently missing data.

**Fix:** Add a count query and show a "Load More" or pagination control when `companies.length === 500`.

### 6. Auth Form Loading State Not Reset on Forgot Password (LOW)
**File:** `src/pages/Auth.tsx` line 53

After `handleForgotPassword` completes and sets `isForgot(false)`, the `loading` state is reset. However, if the Supabase call fails (network error), `loading` stays false correctly. No actual bug here — this is fine.

---

## Implementation Plan

### Step 1: Fix ResetPassword recovery detection
Add a session check on mount: if `supabase.auth.getSession()` returns a valid session after the URL contains recovery params, set `isRecovery = true`.

### Step 2: Sanitize remaining error messages (top 6 files)
Replace `err.message` with generic text in:
- `AnnualMeetingWizard.tsx`
- `WrittenConsentWizard.tsx`  
- `PrintPreviewButton.tsx`
- `AnnualReviewPublic.tsx`
- `PendingReviews.tsx`
- `LeaseTransactionDialog.tsx`

### Step 3: Fix `text-success` class
Replace with `text-green-600` in `ResetPassword.tsx`.

### Step 4: Add truncation warning for paginated queries
Add a small banner/note on Dashboard when `companies.length >= 500` indicating not all companies are shown.

### Step 5: Fix idle timeout throttle precision
Update `handleActivity` to always record the first event after a gap.

