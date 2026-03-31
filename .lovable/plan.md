

# Members Section: Buy/Sell Button Placement + Buyer Validation

## Change 1 — Move Buy/Sell to Actions Column

### CompanyDetail.tsx
- **Remove** the standalone Buy/Sell button (lines 339–344) that sits above ShareholdersTab
- **Add** `initialSeller` prop to `BuySellWorkflow` (optional `{ id: string; name: string }`) so the dialog opens pre-loaded with the clicked member
- Keep `BuySellWorkflow` dialog and state (`buySellOpen`, `setBuySellOpen`) in CompanyDetail since it needs `availableShares` and `companyName`
- Pass `onBuySell: (sellerId: string, sellerName: string) => void` callback down to ShareholdersTab

### ShareholdersTab.tsx
- Accept new prop `onBuySell?: (sellerId: string, sellerName: string) => void`
- Add an `ArrowRightLeft` icon button in the Actions column of each member row (alongside Edit and Delete), only for active non-treasury members
- Clicking it calls `onBuySell(s.id, s.name)`

### BuySellWorkflow.tsx
- Add optional prop `initialSeller?: { id: string; name: string }`
- On open, if `initialSeller` is provided, pre-populate `seller_id` and `seller_name` in the form state (via a `useEffect` on `open`)

## Change 2 — Buyer Field Validation by Entity Type

### BuySellWorkflow.tsx (buyer field, lines 526–545)
- **For LLCs** (`isLLC === true`): Replace the free-text Input + Select combo with a **Select-only** dropdown of existing members. Remove the free-text input. Remove the "new shareholder will be created" indicator. The `buyerIsNew` logic should always be `false` for LLCs.
- **For Corporations** (`isLLC === false`): Keep the current behavior — free-text input + dropdown selector. When a new name is typed that doesn't match an existing shareholder, show the "New shareholder will be created" indicator. The existing auto-creation logic in `handleSave` (lines 236–249) already handles this correctly — no changes needed there.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/CompanyDetail.tsx` | Remove standalone Buy/Sell button; pass `onBuySell` to ShareholdersTab; pass `initialSeller` to BuySellWorkflow |
| `src/components/company/ShareholdersTab.tsx` | Add `onBuySell` prop; add ArrowRightLeft icon in Actions column |
| `src/components/company/BuySellWorkflow.tsx` | Add `initialSeller` prop with pre-population; conditionally render buyer field based on entity type |

## What stays unchanged
- All Buy/Sell calculations, ledger entries, certificate generation, and transaction logic
- The "+ Add" button at the section header
- Edit and Delete row actions

