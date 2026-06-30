## Why

The CertDetail Overview "Recent sessions" list renders each row as the literal string `[object Object]` with a `0%` score (observed in the implemented-UI-vs-design comparison, 2026-06-30). A session object is being coerced to a string instead of rendering a human label. The design (`openspec/design/CertDetail.html`) shows each recent session as a type + date + score row. This is a user-facing rendering bug on an already-shipped page.

## What Changes

- Fix the CertDetail Recent-sessions row rendering to show the session's **type, date, and score** (matching `CertDetail.html`) instead of stringifying the object.
- Ensure the score reflects the real per-session value rather than a hardcoded/`0%` fallback.
- Add a component/page unit test that fails on the `[object Object]` rendering and passes once a proper label is shown.

## Capabilities

### Modified Capabilities
- `web-cert-detail`: the Overview tab's Recent-sessions list renders a typed/dated/scored label per session.

## Impact

- **Code**: `apps/web/app/` CertDetail Overview component + recent-sessions row; vitest component/page test. No API change, no codegen.
- **No new entity/migration.**
- **Dependencies**: archived `web-cert-detail`.
