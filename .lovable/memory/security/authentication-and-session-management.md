---
name: Authentication & Session Management
description: 2-hour idle timeout with pre-expiry warning, 12-char minimum password, HIBP detection
type: feature
---
- Idle timeout: 2 hours of inactivity → auto sign-out (`useSessionIdleTimeout`).
- A warning toast appears ~2 minutes before sign-out so users in long forms (e.g. share transactions) can keep the session alive.
- Activity events tracked: mousedown, keydown, touchstart, scroll, mousemove, input, focus (capture phase) — covers typing inside modals.
- Password rules: 12-char minimum, HIBP breach detection.
- `demoguys1@yahoo.com` is admin.
