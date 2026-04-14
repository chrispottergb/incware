

# Fix PDF Line Break Rendering in Resolution Text

## Problem
In `src/lib/meeting-pdf-export.ts`, the `addResolutionBlock` function at line 361 splits text on double newlines (`\n\n+`) into paragraphs, then **replaces all single `\n` with spaces**: `.map(p => p.replace(/\n/g, " ").trim())`. This collapses list items (charitable contributions, bank signers, officer bonuses) into a single run-on line.

## Change 1 — Fix line break preservation (the only change needed)

**File:** `src/lib/meeting-pdf-export.ts`, line 361

Current:
```typescript
const paragraphs = text.split(/\n\n+/).map(p => p.replace(/\n/g, " ").trim()).filter(Boolean);
```

Fix: Split on double newlines to get paragraphs, then within each paragraph, preserve single newlines by splitting into sub-lines and rendering each separately. The approach:

1. Change line 361 to keep single `\n` intact instead of replacing with spaces:
```typescript
const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
```

2. In the plain paragraph rendering block (lines 451-463), split each paragraph on `\n` and render each sub-line individually:
```typescript
} else {
  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const subLines = para.split("\n").map(l => l.trim()).filter(Boolean);
  for (const sub of subLines) {
    const wrapped = doc.splitTextToSize(sub, contentWidth);
    for (const wl of wrapped) {
      y = checkPageBreak(doc, y, 6);
      doc.text(wl, MARGIN, y);
      y += 5;
    }
  }
  y += 3;
}
```

3. Apply the same sub-line splitting in the WHEREAS and RESOLVED blocks — after extracting the body text, split on `\n` and render the prefix with the first sub-line, then render remaining sub-lines as continuation lines at the same indent.

## Change 2 — Already done
The WrittenConsentWizard does not contain "Prior Meeting Date" or "Next Annual Meeting" fields, and the PDF export already skips those sections for Written Consents. No changes needed.

## Scope
- **1 file modified:** `src/lib/meeting-pdf-export.ts`
- No database changes
- No UI changes

