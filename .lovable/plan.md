## Goal

Add a desktop sidebar collapse toggle so users can hide the left navigation and view the full application width.

## Current state

`src/components/AppLayout.tsx` has a fixed-width 240px (`w-60`) sidebar that's always visible on desktop (`md:` breakpoint). It already supports a mobile slide-in via `mobileOpen`, but there's no way to collapse it on desktop.

## Change

In `src/components/AppLayout.tsx`:

1. Add `desktopCollapsed` state (persisted in `localStorage` as `entityiq-sidebar-collapsed` so the choice survives refresh).
2. On the `<aside>`, switch width based on collapse state:
   - Expanded: `md:w-60` (current)
   - Collapsed: `md:w-0 md:overflow-hidden md:border-0` (fully hidden so main content takes full width)
3. In the header, add a desktop-only toggle button (chevron-left / panel icon) that calls `toggleDesktopSidebar()`. Keep the existing mobile menu button as-is.
4. The button stays visible in the header even when sidebar is collapsed, so the user can bring it back.

No other files change. Mobile behavior unchanged.

## Files

- `src/components/AppLayout.tsx` — add collapse state + toggle button + conditional sidebar width.
