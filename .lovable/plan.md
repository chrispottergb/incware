
## Expand Login Hero Image to Full Screen Background

Currently the login page uses a 50/50 split layout — the hero image takes the left half and the form takes the right half. This change will make the hero image span the entire screen as a background, with the login form overlaid on top.

### What Changes

**File: `src/pages/Auth.tsx`**

1. **Full-screen background image** — The hero image will become an absolutely-positioned, full-width/full-height background covering the entire viewport instead of only the left half.

2. **Overlay the login form** — The auth form will be positioned on the right side (on desktop) over the image, with a semi-transparent dark backdrop behind the form card for readability.

3. **Branding repositioned** — The "IncWare" branding text stays in the bottom-left corner, overlaying the full background image.

4. **Mobile handling** — On mobile, the image still fills the full screen as a background with the form centered on top.

### Layout Summary

```text
+--------------------------------------------------+
|                                                  |
|   [Full-screen hero image background]            |
|                                                  |
|                        +--------------------+    |
|                        | Auth Form Card     |    |
|                        | (glass/dark panel) |    |
|                        +--------------------+    |
|                                                  |
|   IncWare                                        |
|   Next-generation corporate records...           |
+--------------------------------------------------+
```

### Technical Details

- Remove the `w-1/2` constraint and `hidden lg:block` from the image container; make it `fixed inset-0` with `z-0`
- Add a darker gradient overlay for text contrast across the full image
- Wrap the form in a card-like container with `backdrop-blur` and semi-transparent background (e.g., `bg-background/80 backdrop-blur-xl`)
- Keep the form on the right side on desktop (`lg:ml-auto`) and centered on mobile
- The branding overlay remains at bottom-left with `z-10`
