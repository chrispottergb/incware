## Preview new background colors

Update the dark theme tokens in `src/index.css` to try out your proposed palette. Easy to revert if you don't like it.

### Changes

In `:root` (dark theme), update:

- `--background: 218 18% 13%` — page background → **#1A1F26**
- `--card: 218 16% 15%` — forms, panels, cards → **#1F242C**
- `--popover: 218 16% 15%` — dropdowns/popovers → **#1F242C**
- `--secondary: 218 16% 15%` — list rows / secondary surfaces → **#1F242C**
- `--workspace: 218 16% 15%` — main content panel → **#1F242C**

These tokens drive all forms, tables, lists, dialogs, and cards across the app (shadcn components read from them), so the change cascades everywhere without touching component files.

### Not changed

- Sidebar, borders, text, accents, and status colors stay as-is.
- Light theme and print styles untouched.

After you preview, tell me "keep it" to lock in, or "revert" to restore the originals.