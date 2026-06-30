## Why

The implemented app shell uses a **top horizontal nav bar** (Readion · Settings · Dark · Log out), but the Claude Design "final" reference uses a persistent **left sidebar** across every authenticated screen (`openspec/design/App Shell.html`: Readion logo + Dashboard / Sessions / Progress / Ask AI / Settings, with a user block in the footer). This is the single largest divergence found in the 2026-06-30 UI comparison and it changes the framing of Dashboard, Progress, Settings, Ask-AI, and CertDetail. Decision (confirmed with the user): **adopt the sidebar**; **keep the Dark-mode toggle** (an intentional improvement over the artboard) by relocating it into the sidebar footer.

## What Changes

- Replace the top nav bar with the design's **left sidebar** as the default authenticated layout: brand, primary nav (Dashboard, Sessions, Progress, Ask AI, Settings) with active-state, and a footer user block.
- **Relocate the Dark-mode toggle** into the sidebar footer (next to the user block) and restyle to fit; keep the existing toggle behavior/state.
- Preserve the **bare/focused chrome** for full-screen flows (mock exam, quick-review run, in-session view) — they must NOT gain the sidebar (matches both design and current behavior).
- Keep the **admin left sub-nav** working within the new shell (admin pages already have their own section nav).
- Responsive: collapse/drawer behavior for narrow viewports (the shell is the PWA frame).

## Capabilities

### Modified Capabilities
- `web-shell`: the authenticated app layout is a persistent left sidebar (brand + primary nav + user/dark-toggle footer); focused flows opt out of the shell.

## Impact

- **Code**: `apps/web/app/layouts/` + `apps/web/app/components/` (sidebar/app-shell components, nav active-state, dark-toggle relocation), and any page that assumed the top bar. Update affected component/page tests; Playwright e2e for nav presence/active-state and that focused flows stay bare. No API change, no codegen.
- **No new entity/migration.**
- **Dependencies**: archived `web-foundation` (owns `web-shell`). Other Phase 13 screen changes (`web-progress-fidelity`, `web-cert-detail-polish`, `web-ui-polish-pass`) render inside this shell and should sequence after it.
