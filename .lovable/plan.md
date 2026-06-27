## Goal

Right now the masked `••••1234` for Account / Routing number on each bank row in `BanksTab.tsx` is read-only text. The reveal eye + editable field only exist inside the "Edit Bank" dialog. You want the eye visibility (and the ability to edit) available directly on the row.

## Changes (UI only — `src/components/company/BanksTab.tsx`)

1. **Inline eye toggle on each bank row**
   - Next to each `••••<last4>` chip (account and routing) add a small `Eye` / `EyeOff` icon button.
   - Click → calls the existing `decrypt-company-bank` edge function for that row's `bank.id`, stores the plaintext in a per-row reveal map `{ [bankId]: { account?: string; routing?: string } }`, and swaps the masked text for the real number.
   - Click again → clears that entry (re-masks). Auto-clear all reveals after 60s for safety.
   - Non-admins / failed decrypt → toast error, stays masked.

2. **Inline edit of account / routing from the row**
   - Add a small pencil icon next to each revealed number that flips it to an `<Input>` in place.
   - Save (Enter or check icon) → calls `encrypt-company-bank` with the new value, then invalidates `["company_banks", companyId]` so `last4` refreshes.
   - Cancel (Esc or X icon) → discards and re-masks.
   - This path never writes plaintext through PostgREST — it reuses the same edge function pattern already in place.

3. **No changes to**
   - The Edit Bank dialog (already has the same affordances).
   - Database schema, RLS, edge functions, master directory sync, signer flow.
   - Any non-bank tab.

## Technical notes

- New local state: `const [rowReveal, setRowReveal] = useState<Record<string, { account?: string; routing?: string }>>({})` and `const [rowEdit, setRowEdit] = useState<{ bankId: string; field: 'account' | 'routing'; value: string } | null>(null)`.
- Helpers: `revealRow(bankId, field)`, `hideRow(bankId, field)`, `saveRowEdit()` — mirror the dialog's `revealField` logic.
- Buttons sized `h-5 w-5` with `Eye` / `EyeOff` / `Pencil` / `Check` / `X` icons from `lucide-react` to fit the existing dense row.
- Auto-clear via `useEffect` setTimeout keyed on `rowReveal` so revealed numbers don't linger on screen.

## Acceptance

- On a bank row, clicking the eye next to `••••1234` shows the full account number; clicking again hides it.
- Clicking the pencil lets the user type a new account / routing number and save without opening the full Edit dialog.
- After save, the row's `••••<last4>` updates to the new last 4 digits and the field re-masks.
- Plaintext is never written to `company_banks.account_number` / `routing_number` (still goes through `encrypt-company-bank`).
