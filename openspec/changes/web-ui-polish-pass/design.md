# Design — web-ui-polish-pass

Frontend-only polish reconciling three screens against their artboards. No API change, no codegen, no new entity/migration. Each item below cites the artboard and the real `@readion/web` code it touches, and records the preserved divergences that this pass deliberately does NOT close.

## 1. Settings — right-align actions + tighten the contained card

**Artboard:** `openspec/design/Settings.html`. Every section's primary action is wrapped in `<div style={{ display: 'flex', justifyContent: 'flex-end' }}>` — Save changes (Account), Update password (Password), Save defaults (Study), Save preferences (Notifications). The danger-zone `Delete account` button sits at the trailing edge of a `justify-content: space-between` row. Content lives in a `maxWidth: 580` reading column inside `padding: '32px 40px'`.

**Real code:**
- `apps/web/app/pages/settings/index.vue` — composes `SettingsLayout` with `account` / `study-defaults` / `notifications` slots.
- `apps/web/app/components/SettingsLayout.vue` — already provides the contained column: `mx-auto w-full max-w-[580px] px-4 py-8 …`. The contained-card geometry is largely in place; this pass tightens section whitespace toward the artboard and ensures actions align to the column's trailing edge.
- `apps/web/app/components/AccountTab.vue` — the gap: action buttons use **`self-start`** (left-aligned). Lines ~194 (Save), ~282 (Update password), ~298 (Delete account) all use `class="self-start …"`. The fix flips these to a trailing-edge alignment (`self-end`, or wrap the action in a `flex justify-end` row) to match the artboard. `StudyDefaultsTab.vue` and `NotificationsTab.vue` Save actions get the same treatment.

**Refactor note (tasks 1.3):** a shared form-actions row (a small wrapper applying `flex justify-end`) is the natural home so the three tabs don't each repeat the alignment utility.

**Spec mapping:** the `web-settings` requirement **"Settings page shell with three tabs"** is MODIFIED to state the contained max-width column and the right-aligned action rule across tabs, with a new scenario asserting actions sit at the trailing edge.

## 2. Login — contained-card form placement (SSO stays omitted)

**Artboard:** `openspec/design/Login.html`. Split-panel `AuthLayout`: 280px `BrandPanel` on the left, `FormPanel` (`flex: 1`, centered) on the right. The artboard's sign-in screen also shows an `OrDivider` + "Sign in with SSO" button — a **deliberately preserved divergence** that the implementation omits and this pass keeps omitting.

**Real code:**
- `apps/web/app/layouts/auth.vue` — the split-panel layout. Brand panel `hidden lg:flex w-70 …`; form panel `<main class="flex flex-1 items-center justify-center …"><div class="w-full max-w-sm"><slot /></div></main>`. The `max-w-sm` form container is the contained card; this pass tightens its placement/whitespace toward the artboard so the form reads as a tidy card instead of floating in the panel's empty space.
- `apps/web/app/pages/login.vue` — declares `definePageMeta({ layout: 'auth' })`, renders email + password + submit only. No SSO button, no `or` divider — correct and preserved.

**Refactor note (tasks 2.3):** any shared whitespace tweaks belong in `auth.vue` so register / forgot-password / reset-password inherit them.

**Spec mapping:** the `web-auth` requirement **"Login page authenticates and routes into the app"** is MODIFIED to require the contained-card placement within the split-panel layout and to explicitly restate that SSO (button + `or` divider) remains omitted. A new scenario asserts the contained width and the absence of any SSO control.

## 3. Onboarding — cert search + standalone chrome

### 3a. Layout assignment: default sidebar shell → standalone

**Confirmed current state:** `apps/web/app/pages/onboarding/index.vue` declares **no `definePageMeta`**, so it inherits the **default** layout. Per `apps/web/app/layouts/default.vue` (the `web-shell` persistent left-sidebar shell that the `web-app-shell-sidebar` change landed), any page without an explicit layout is wrapped in `<AppSidebar>` + content region. So onboarding currently renders **inside the global app sidebar** — exactly the chrome this pass must hide.

**Fix:** add `definePageMeta({ layout: 'minimal' })` to `apps/web/app/pages/onboarding/index.vue`. `apps/web/app/layouts/minimal.vue` is the bare/standalone, auth-style layout (thin header, no global navigation sidebar) — `web-shell` already designates `definePageMeta({ layout })` as the opt-out mechanism for focused/full-screen flows. The onboarding wizard keeps its **own** internal step rail (the `<aside>` setup sidebar already rendered inside `onboarding/index.vue`, reconciled against `Onboarding.html`'s V3 sidebar wizard); only the global app shell is suppressed.

Layout options considered: `auth.vue` carries the marketing brand panel (wrong for setup); `minimal.vue` is the neutral standalone frame and is the right pick.

**Spec mapping:** a new `web-onboarding` requirement **"Onboarding presents as a standalone flow without the global app chrome"** is ADDED (the existing onboarding requirements had no home for this chrome concern), with scenarios asserting no global sidebar wraps the route and that the page declares an explicit bare layout via `definePageMeta({ layout })`.

### 3b. Cert search filter

**Artboard:** `openspec/design/Onboarding.html` step 1 (`V3Step1`) renders a `SearchBox` ("Search certifications…", `7 available` suffix) above the vendor-grouped cert list.

**Real code:** `apps/web/app/components/OnboardingCertSelect.vue` loads the catalog via `certificationsControllerList()` into `options` (a `computed` over the TanStack query data) and renders a flat `<ul>` of `cert-option` buttons. The catalog is **already fully loaded client-side**, so the search is a pure client-side filter — no new request, no API risk. Add a `query` ref and a `filteredOptions` computed that filters `options` case-insensitively over `name`, `provider`, and `code`, then iterate `filteredOptions` in the template with a search `<input>` above the list. (Confirmed: the cert catalog is available to filter client-side, so no blocker.)

**Refactor note (tasks 3.3):** reuse the existing option list as-is; the filter wraps it.

**Spec mapping:** the `web-onboarding` requirement **"Certification selection step"** is MODIFIED to require the search box and a client-side, no-extra-request filter over name/provider/code, with a new scenario.

## Preserved divergences (explicitly NOT changed)

- **Login SSO** — the artboard's "Sign in with SSO" button and `or` divider are intentionally omitted in `login.vue`; this pass does not reintroduce them.
- **Settings Full-name field / avatar upload** — `Settings.html` shows a "Full name" input and an avatar slot, but the `User` entity has no name attribute and the product chose initials-only with no photo upload. `AccountTab.vue` correctly omits both; this pass does not add them.

## Verification

`yarn lint`, `yarn typecheck`, web unit tests, and targeted Playwright assertions (Settings actions right-aligned; Login form in the contained card; Onboarding step 1 cert search filters the catalog and the route renders without the global sidebar) must pass with coverage ≥ 80% (tasks 4.1).
