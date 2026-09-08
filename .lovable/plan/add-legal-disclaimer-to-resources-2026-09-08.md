# Add "Legal Disclaimer" to Resources

Verified: `public.resources` has no CHECK constraint on `category` or `content_type` (only a primary key), so the new values are safe to insert.

## Changes

1. **Sidebar** — in `src/components/AppLayout.tsx`, add one entry as the last item of the Resources array:
   `{ label: "Legal Disclaimer", icon: Scale }`. `Scale` is already imported. No other edits to the map body, styling, or the admin "Manage Resources" link.

2. **Migration** — idempotent insert of a single row into `public.resources` (skipped if a row with `category = 'Legal Disclaimer'` already exists):
   - title: `Legal Disclaimer`
   - category: `Legal Disclaimer`
   - content_type: `markdown`
   - sort_order: `0`
   - content: the supplied disclaimer markdown (not legal advice, automated selections, third-party use, statutory content, AI-assisted features, consult an attorney)

No schema changes, no RLS changes, no changes to `ResourcesPanel.tsx` or any other file.

## Verification

Open the app, confirm the Resources group lists five items, click "Legal Disclaimer", and confirm the existing slide-out panel renders the markdown.
