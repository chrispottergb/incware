

## Replace Par Value Free-Text Input with Dollar Amount or No Par Selection

### What Changes

In the Stock Certificate issue/edit dialog, the current par value field is a plain number input. This will be replaced with a two-part control:

1. A **Select dropdown** to choose between "Par Value" and "No Par Value"
2. A **Dollar amount input** that only appears when "Par Value" is selected (whole dollar amounts, no decimals)

### Technical Details

**File:** `src/components/company/StockCertificatesTab.tsx`

1. **Add a `par_value_type` field to the form state** -- values: `"par"` or `"no_par"`. Default to `"par"`. When loading an existing certificate for editing, set to `"no_par"` if `par_value` is null, otherwise `"par"`.

2. **Replace the single par value `<Input>` (line 216-219)** with:
   - A `<Select>` for choosing "Par Value" vs "No Par Value"
   - A conditional `<Input>` for the dollar amount (type="number", step="1", min="0") that only shows when "Par Value" is selected

3. **Update the save payload (line 97)**: When `par_value_type` is `"no_par"`, send `par_value: null`. When `"par"`, send `parseFloat(form.par_value)`.

4. **Update `resetForm` and `openEdit`** to handle the new `par_value_type` field.

5. **Update the grid layout** from `grid-cols-3` to accommodate the extra field -- use `grid-cols-2` for the class/shares row, then a separate row for par value type and amount.

