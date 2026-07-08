## Change

Update the Annual Meeting PDF banking resolutions so each bank's authorized signers render as an indented list below the RESOLVED paragraph instead of being appended inline.

## File

Only one template controls this section:
- `src/lib/meeting-pdf-export.ts` — lines ~2419–2447 (annual meeting Banking Resolutions loop).

The `addWhereasResolved` helper (line 628) prepends `"that "` to the resolved body, and the current call already passes text starting with `"that {bank}..."`, producing the duplicate **"that that"** you mentioned. Fixing this is part of the change.

## Data source (confirmed)

- Bank Name → `company_banks.bank_name` (already loaded into `data.companyBanks`).
- Signer Name → `bank_authorized_signers.signer_name`.
- Authority designation → `bank_authorized_signers.title` (stored per-signer, populated by the "Authority Type" dropdown in `BanksTab.tsx`, including the expanded "Limited Authority: ..." string). **No manual mapping needed.**
- Signers are matched to their bank via `bank_id`, with a fallback match by `bank_name` against `meeting_authorized_signers` (existing behavior — kept).

## New rendering

For each bank in `data.companyBanks`:

1. WHEREAS (unchanged wording):
   `WHEREAS, the Board of Directors have reviewed the banking relationship with {Bank Name}; and`
2. RESOLVED paragraph — ends at the colon, no inline signers, no duplicate "that":
   `RESOLVED, that {Bank Name} is hereby approved and confirmed as a depository for the funds of {Company Name}, and that the following persons are hereby authorized as signers on said account:`
3. Signer list — one per line, indented to match the RESOLVED left indent (`RESOLVED_INDENT`), in insertion order (existing query already orders by `created_at`):
   `{signer_name}, {title}`

   If a bank has no signers, omit the trailing "and that the following persons..." clause entirely and end the RESOLVED sentence with a period after `{Company Name}` (so we never leave a dangling colon).

For LLC meetings, `boardLabel()` continues to substitute Manager/Member terminology automatically.

## Implementation notes

- Because `addWhereasResolved` auto-injects `"that "`, pass the resolved body **without** a leading "that" (i.e., `"{bank} is hereby approved..."`), which also eliminates the "that that" bug for this section.
- After the helper returns the new `y`, render each signer line with `doc.text(..., MARGIN + RESOLVED_INDENT, y)` using Arial 11, then advance `y` by ~14pt per line plus a small trailing gap, calling `checkPageBreak` between lines.
- No changes to `BanksTab.tsx`, database schema, or the fallback signer-table rendering block (lines 2449–2471), which only fires for signers not tied to a listed bank.

## Scope

Purely a PDF formatting change in one file. Any Annual Meeting PDF regenerated after this ships will use the new layout — previously downloaded PDFs are static files and won't retroactively change (regenerating from the meeting will).
