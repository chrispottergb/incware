## Goal

In the **Add Company** wizard, add a clickable **"Import from Operating Agreement"** button (alongside the existing *Import from Tax Return*). The user uploads an OA file (PDF/DOC/DOCX), an AI edge function extracts the structured data, and the wizard auto-creates the new company with company info + members + officers/managers pre-populated.

## Where

- **Wizard**: `src/components/CreateCompanyWizard.tsx` — Step 1 (`flowType === "new"`), inside the same `or` block that already hosts `TaxReturnUpload` (lines ~799–820).
- **New component**: `src/components/OperatingAgreementUpload.tsx` — modeled on `TaxReturnUpload.tsx` but tailored to OA fields. Uses upload → poll pattern.
- **New edge function**: `supabase/functions/parse-operating-agreement/index.ts` — accepts the uploaded file, sends content to Lovable AI (`google/gemini-2.5-pro` for PDFs/multimodal), returns structured JSON. Synchronous response (smaller scope than tax return — no need for job queue; OA parsing is one-shot).

## Behavior

1. Step 1 of the wizard now shows two import buttons under the "or" divider:
   - `Import from Tax Return` (existing)
   - `Import from Operating Agreement` (new) — `Upload` icon
2. Clicking opens a small dialog with a file picker (`accept=".pdf,.doc,.docx"`, max 20 MB).
3. On upload:
   - File is sent to `parse-operating-agreement` edge function.
   - Function extracts text (PDF via existing PDF text extraction libs; DOCX via mammoth-style or send raw to Gemini with file content), then prompts Gemini to return a strict JSON schema:
     ```ts
     {
       company: {
         name, entity_type ("LLC" | "Single Member LLC" | "LLC-S"),
         state_of_incorporation, formation_date,
         address, address_2, city, state, zip,
         ein, business_purpose, fiscal_year_end,
         management_type ("member-managed" | "manager-managed"),
         registered_agent_name, registered_agent_address
       },
       members: [{
         name, address, address_2, city, state, zip,
         units_held, ownership_pct, capital_contribution
       }],
       managers: [{ name, title }]   // only when manager-managed
     }
     ```
   - Empty/unknown fields returned as `null`.
4. On success, dialog closes, summary card shows extracted counts (members, etc), and on confirm the wizard:
   - Inserts the new `companies` row with extracted fields.
   - Inserts each extracted member as a `shareholders` row.
   - Inserts each extracted member's initial holdings via `share_transactions` (`Initial Contribution`, dated to formation_date or today) so ownership % calculates correctly.
   - Uploads the original OA file to `generated-documents` bucket and registers it in `document_registry` as type `Operating Agreement (Imported)` so it shows in the OA tab's Version History immediately.
   - Navigates to `/company/{id}`.
5. Errors (file too large, parse failed, no members detected) show a toast and keep the wizard open so the user can fall back to manual entry.

## Technical details

- **Edge function** (`parse-operating-agreement`):
  - `verify_jwt = true` (default).
  - CORS headers from `@supabase/supabase-js/cors`.
  - Reads `file` from `multipart/form-data`; converts to base64.
  - Calls Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with `google/gemini-2.5-pro` and `response_format: { type: "json_schema", ... }` to enforce schema.
  - For non-PDF (DOCX), pre-extract text using `mammoth` from esm.sh; for PDF send as inline image-style attachment via Gemini multimodal (or extract with `pdfjs-dist` server-side).
  - Returns extracted JSON or `{ error }` with proper status code.
  - Validates input with Zod.
- **Client**:
  - `OperatingAgreementUpload.tsx` exports a button + dialog (controlled or trigger prop), surfaces a confirm screen with "Create Company from this", and calls a passed `onConfirm({ extracted, originalFile })` callback.
  - In `CreateCompanyWizard.tsx`, the `onConfirm` handler does the inserts (companies → shareholders → share_transactions → storage upload → document_registry insert), invalidates `["companies"]` query, closes wizard, navigates.
- **Storage / DB**: no schema changes needed. Uses existing `companies`, `shareholders`, `share_transactions`, `document_registry` tables and `generated-documents` bucket.
- **Secrets**: `LOVABLE_API_KEY` already configured.
- No new dependencies in the React app; edge function imports from esm.sh (`mammoth`, `zod`).

## Files to create / modify

- **Create**: `supabase/functions/parse-operating-agreement/index.ts`
- **Create**: `src/components/OperatingAgreementUpload.tsx`
- **Modify**: `src/components/CreateCompanyWizard.tsx` — add the new button and the `handleOAImport` callback that creates the company end-to-end.
