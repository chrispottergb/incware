## Goal

Rebuild the "Bank Accounts & Authorized Signers" section so signers are nested inside their bank account card, and remove account/routing numbers from the UI entirely.

## Confirmed decisions

- No signer email field (the signers table has no email column; skipping it means no migration).
- Account/routing columns stay in the database untouched — only the UI is removed. No migration in this change at all.
- Signer authority keeps the existing 7-option Authority Type list, including "Limited Authority (Specify)" with its detail input. (Your "Primary/Secondary signer" role list is not applied, per your answer.)

## New file structure (mirrors `src/components/company/counsel/`)

```text
src/components/company/banks/
  BanksSection.tsx    -- header row, list of cards, empty state, dialog orchestration
  BankCard.tsx        -- collapsible card: name + type badge, warning badge, signer list
  SignerRow.tsx       -- initials avatar + name + authority + edit/delete
  BankDialog.tsx      -- add/edit bank form
  SignerDialog.tsx    -- add/edit signer form (account implicit)
```

`BanksTab.tsx` becomes a thin wrapper rendering `BanksSection`, same as `CounselTab.tsx`. The existing `InitialsAvatar` helper from the counsel folder is reused, not duplicated.

## List view

- Header row: "Bank accounts and authorized signers" + `Add bank` button.
- One card per account, chevron expand/collapse, **default expanded**.
- Card header: bank name + account type badge + edit/delete icons. No account number, routing number, reveal eye, or inline "+ Account #" affordances anywhere.
- Signers nested under an "Authorized signers" label with left border + indent, matching the firm card. Each row: initials avatar, name, authority text, edit/delete.
- No count badge. `+ Add signer to this account` at the bottom of each card.
- Zero bank accounts → single card with muted "None added."
- Account with zero signers → small warning badge "No signer added" in the card header.

## Add bank flow

1. Save the bank account.
2. Immediately chain into the Add Signer dialog, pre-scoped to the newly created account.
3. If the user cancels that step, the bank stays saved and its card shows the "No signer added" badge.

The bank form keeps its existing useful fields (bank name with master-directory autocomplete, account type, contact name/title, phone, address, notes) minus account and routing numbers, which are already gone from the dialog today.

## Signer form

- Fields: Signer name (autocomplete against the address book, as today), Authority Type dropdown (7 options), plus the conditional "Limited authority detail" input.
- Save disabled while the name is empty.
- Opened from a card, so no bank picker.

## Delete behavior

- Signer: `ConfirmDeleteDialog`. When it is the last signer on the account, the dialog text adds: "This is the only signer on this account. Removing them will leave the account without an authorized signer." Delete still allowed; card then shows the warning badge.
- Bank account: `ConfirmDeleteDialog` warning that its signers are removed too; deletes signer rows for that bank then the bank row.

## Technical notes

- Query keys stay exactly as they are — `["company_banks", companyId]` and `["bank_authorized_signers", companyId]` — so `MeetingAuthorizedSigners` auto-populate and the meeting/PDF paths are unaffected.
- Master-directory sync (`useMasterFirms("bank")`) and address-book upsert on save are preserved.
- Decrypt/encrypt edge-function calls disappear from this tab; the functions and columns remain in place for any future need.
- Styling: neutral card backgrounds, thin borders, no shadows, existing semantic tokens; `Landmark` bank icon, initials-avatar circles for people.

## Verification in preview

Playwright pass covering: an account with 2+ signers, an account with exactly 1 signer, an account created via the cancel-out-of-signer path showing the warning badge, and the "None added." empty state.
