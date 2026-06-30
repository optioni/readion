# Design — Persistent left-sidebar app shell

## Context

The shipped authenticated chrome is a **top horizontal nav bar**. The Claude Design "final" reference (`openspec/design/App Shell.html` rendering `openspec/design/app-shell.jsx`'s `AppSidebar` + `AppFrame`) uses a **persistent left sidebar** on every post-onboarding screen. This is the largest fidelity divergence in the 2026-06-30 comparison and it reframes Dashboard, Progress, Settings, Ask-AI, and CertDetail. The user confirmed: adopt the sidebar; keep the dark-mode toggle (the artboard has none) by relocating it into the sidebar footer.

This is a frontend-only change in `@readion/web`. No API change, no codegen.

## Current implementation (what exists today)

Layouts in `apps/web/app/layouts/`:

- `default.vue` — current authenticated shell. Renders `<AppNavBar />` (top bar) + a centred `max-w-7xl` `<main data-testid="shell-container">`. Applied implicitly to any page with no `definePageMeta({ layout })`.
- `minimal.vue` — bare/focused chrome: a thin `h-13` header ("Readion" + "Back to dashboard"), full-bleed `<main>`, no nav. This is the existing opt-out used by focused flows.
- `auth.vue` — the login/register split layout (brand panel + form). Unrelated to the in-app shell; stays as-is.

Components:

- `apps/web/app/components/AppNavBar.vue` — the top bar. Holds the brand link, a single **Settings** link (with `data-testid="app-nav-settings"` + `data-active`), `<ColorModeToggle />`, and a **Log out** button. Uses `useAuthStore()` + `useRoute()` for auth gating and active state.
- `apps/web/app/components/ColorModeToggle.vue` — button wrapping `useReadionColorMode()` (`composables/useReadionColorMode`), labelled Dark/Light with an `aria-label`. This is the toggle to relocate, not rebuild.

### Layout-assignment mechanism

Nuxt's file-based layout system: a page opts into a non-default layout via `definePageMeta({ layout: '<name>' })`; pages with no such call inherit `default.vue`. Current assignments (grepped from `apps/web/app/pages`):

| Route (file) | Current layout | Target |
| --- | --- | --- |
| `pages/index.vue` (Dashboard) | default (implicit) | sidebar (default) |
| `pages/agent.vue` (Ask AI) | default (implicit) | sidebar (default) |
| `pages/settings/index.vue` | default (implicit) | sidebar (default) |
| `pages/user-certifications/[id]/index.vue` (CertDetail) | default (implicit) | sidebar (default) |
| `pages/user-certifications/[id]/progress.vue` | default (implicit) | sidebar (default) |
| `pages/sessions/[id]/summary.vue` | `default` (explicit) | sidebar (default) |
| `pages/admin/**` | default (implicit) + `middleware: 'admin'` | sidebar (default) |
| `pages/onboarding/index.vue` | default (implicit) | sidebar (default) |
| `pages/mock-exams/[id]/index.vue` | `minimal` | bare (unchanged) |
| `pages/sessions/[id]/index.vue` (in-session) | `minimal` | bare (unchanged) |
| `pages/user-certifications/[id]/review.vue` (quick-review run) | `minimal` | bare (unchanged) |
| `pages/user-certifications/[id]/session/start.vue` | `minimal` | bare (unchanged) |
| `pages/login`, `register`, `verify-email`, `forgot-password`, `reset-password` | `auth` | `auth` (unchanged) |

Net effect: the change is concentrated in `default.vue` + its nav component. The four focused routes already declare `layout: 'minimal'`, so the bare-chrome opt-out **requires no per-page edits** — they keep rendering without the sidebar automatically.

## Decision: sidebar shell

### Component structure

Introduce `apps/web/app/components/AppSidebar.vue` (Vue port of `app-shell.jsx`'s `AppSidebar`), and rewrite `default.vue` to a flex row: `<AppSidebar />` + scrollable `<main>` content region (mirroring the jsx `AppFrame`). `AppNavBar.vue` and its tests are deleted (no backwards-compat per repo rules).

`AppSidebar.vue` renders, matching the artboard:

1. **Brand** — the indigo rounded mark + "Readion" wordmark (same SVG mark already used in `auth.vue`).
2. **Primary nav** — a `<nav>` landmark with a "Study" eyebrow and five `<NuxtLink>` items extracted to a nav config array `[{ label, to, icon }]`:
   - Dashboard → `/`
   - Sessions → `/sessions` (or the sessions index route)
   - Progress → the user's current `user-certifications/[id]/progress`
   - Ask AI → `/agent`
   - Settings → `/settings`
   Active item derives from `useRoute()` and sets both the active visual state and `aria-current="page"`. Keep `data-testid` hooks for the e2e/component tests (e.g. per-item testids).
3. **Admin entry** — role-gated via `useAuthStore()` (shown only to admins), linking to `/admin`, matching the jsx `admin` prop.
4. **Footer block** — the user avatar/initials + name, alongside the **relocated** `<ColorModeToggle />`. The Log-out action moves here too (it previously lived in the top bar).

### Dark-toggle relocation

`ColorModeToggle.vue` is reused unchanged in behavior (still `useReadionColorMode().toggle`, still persists), only moved into the sidebar footer and restyled to fit a compact footer (task 2.3). It is removed from the now-deleted top bar.

### Admin sub-nav coexistence

Admin pages keep `middleware: 'admin'` and the default (now sidebar) layout. Their existing in-content section nav (`components/admin/AdminConsole.vue` and friends, mirroring jsx `AdminSidebar`) continues to render inside the content region. The app sidebar's role-gated Admin entry is the way in; the admin section nav is unchanged.

### Responsive / PWA frame

Desktop (`lg` and up): sidebar is persistent, ~200px (artboard) — current `auth.vue` uses `w-70`; pick a width consistent with the design tokens. Below the breakpoint: the sidebar collapses off-canvas into a drawer toggled from a compact header control, keeping all five nav items reachable and avoiding horizontal overflow (the existing `default.vue` already guards overflow with `max-w-7xl`/padding; the drawer must preserve that). Breakpoints tidied against the design system (Tailwind `lg:` as in `auth.vue`).

### Design tokens

Reuse the `--readion-*` CSS variables already mapped in the theme (the same ones referenced by `app-shell.jsx`'s `ST`): `--readion-background-elevated` (sidebar surface), `--readion-border-strong` (right border + footer card border), `--readion-accent-label` (active item + brand mark), `--readion-text-primary/-secondary/-muted` (label states), `--readion-rounded-md`. Active item background uses the accent at ~15% alpha (`rgba(29,78,216,0.15)`) per the artboard. Inter remains the typeface.

## Risks / trade-offs

- Tests that assert the top bar (`AppNavBar` testids, `shell-container`) must be updated to the sidebar equivalents — covered by task 5.1.
- The "Sessions" and "Progress" destinations are cert-scoped in the current route tree; the nav config must resolve a sensible default target (active cert) rather than a static path. This is a wiring detail for implementation, not a spec change.
- Onboarding currently inherits `default`; if a sidebar during onboarding is undesirable it can later opt into `minimal`, but that is out of scope here (the four focused flows are the confirmed bare set).
