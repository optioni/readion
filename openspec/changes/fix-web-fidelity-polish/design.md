## Context

A full UI walkthrough compared the live Settings, Agent chat, and Login surfaces against their reference artboards. After the higher-severity bugs were split into their own changes, three lower-severity design-fidelity deviations remain on these three surfaces (see `proposal.md`). All are presentational/copy drift, not functional bugs.

Three walkthrough suspicions were investigated and **CLEARED**, and are therefore out of scope:

- The agent **"New chat" empty state is correct** as designed — the artboard has **no** conversation-history sidebar, so none should be added.
- The settings tab set is complete — there is **no** missing "Profile" tab.
- The Account tab's **display-timezone default is fine** (it already shows `Europe/Helsinki`).

## Goals / Non-Goals

**Goals:**
- Bring Settings, Agent chat, and Login markup/copy into fidelity with `openspec/design/Settings.html`, `AgentChat.html`, and `Login.html`.
- Keep the work UI-only: presentational/markup and copy changes in `apps/web` with no API, DB, contract, or generated-client edits.

**Non-Goals:**
- Introducing backend SSO (identity-provider integration). The design's "Sign in with SSO" button + `or` divider stay omitted; reintroducing them would require API scope this change does not invent.
- Adding a conversation-history sidebar to the agent page (the design has none).
- Adding a "Profile" tab or changing the timezone default (both cleared).

## Visual Design

Visual source of truth: the local design artboards at `openspec/design/*.html`. These are authoritative over the current app rendering.

| Artboard / screen | Maps to |
|---|---|
| `Settings.html` — Account tab `SettingsLayout` (left-aligned 580px column, indigo active-tab underline) | `apps/web/app/components/**/SettingsLayout.vue` |
| `Settings.html` — `FieldRow` (sentence-case label in a fixed-width column beside the field) | `apps/web/app/components/**/AccountTab.vue` + shared settings field/label primitives |
| `Settings.html` — Password section "Update password" button | `AccountTab.vue` password action |
| `AgentChat.html` — `ChatHeader` (star avatar + "Study assistant" title) | `apps/web/app/pages/agent.vue` header component |
| `AgentChat.html` — `EmptyState` (star avatar + vertical full-width suggestion chips with trailing `→`) | `agent.vue` empty-state / suggestion-chip components |
| `Login.html` — `FormPanel` / `AuthLayout` (full-height `background-surface` pane, vertically centered left-aligned form) | `apps/web/app/pages/login.vue` + shared auth layout |
| `Login.html` — `BrandPanel` (3 green-badge feature checks, bordered testimonial box) | shared auth brand-panel component |

**Layout to implement:** the split-panel `AuthLayout` (brand panel + full-height surface form panel) built once and reused across all auth states (login/register/forgot/reset/verify); the settings `SettingsLayout` (left-aligned contained column + tab bar) and horizontal `FieldRow` primitive reused across all three settings tabs.

### Design ↔ contract reconciliation

| Design element | Conflict with contract | Resolution |
|---|---|---|
| `Login.html` shows a "Sign in with SSO" button + `or` divider on every auth state | No backend SSO / identity-provider scope exists; `web-auth` spec records SSO as a deliberate omission | Keep SSO omitted; reaffirm the no-SSO / no-divider divergence (see Open Questions) |
| `Settings.html` Account tab shows a "Full name" field | `User` entity has no name attribute; `web-settings` spec deliberately drops the field | Keep "Full name" dropped; this change does not re-add it |

## Test Boundaries

Acceptance is Playwright e2e against the three rendered surfaces. Because this is UI-only fidelity, no backend behavior is exercised beyond what already loads each page; the relevant API calls are stubbed at the network layer so the assertions target layout/copy, not data.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| `POST /api/v1/auth/login` (login page submit) | HTTP mock at the browser network layer (Playwright route interception); assertions target the form-pane layout, not auth flow | n/a (component render tests only) |
| `POST /api/v1/agent-conversations` + `GET …?include=messages` (agent page load/hydrate) | HTTP mock returning a fresh standalone conversation with no messages, so the empty state renders | n/a (component render tests only) |
| `GET /api/v1/users/me` + `PATCH /users/me` (settings page load) | HTTP mock returning a profile envelope so the tabs render | n/a (component render tests only) |
| Auth store / route middleware (authenticated shell) | real (Pinia store seeded authenticated so `/settings` and `/agent` are reachable) | real (store used directly) |
| Component rendering (FieldRow, chips, form pane, brand badges) | real (rendered DOM asserted) | real (Vue Test Utils / component mount) |

## Decisions

- **Settings — left-aligned contained column, not centered.** Chosen: left-align the 580px column against the sidebar per the artboard. Alternative: keep the current `mx-auto` centering. Rejected because centering leaves a large empty left gutter that reads as unfinished next to the design.
- **Settings — horizontal FieldRow label pattern.** Chosen: sentence-case label in a fixed-width column beside each field, with the label colour driven by a Readion text token. Alternative: keep uppercase `font-mono` labels stacked above inputs with a raw `text-slate-400` value. Rejected because it diverges from the artboard and hardcodes a colour outside the design system.
- **Settings — indigo active-tab underline + "Update password" copy.** Small token/copy corrections to match the artboard exactly (`--readion-accent-label`; "Update password").
- **Agent — star-avatar "Study assistant" identity + vertical chips.** Chosen: add the circular star avatar to the header and empty state, retitle the header "Study assistant", and stack suggestion chips vertically full-width each with a trailing `→`. Alternative: keep the "Ask AI" title and horizontal arrow-less chips. Rejected as lower fidelity; the send behaviour of a chip is unchanged (still routes through the existing suggestion handler).
- **Login — full-height surface form pane.** Chosen: make the form panel a full-height `background-surface` pane (`flex: 1`) with the form vertically centered and left-aligned, content constrained to a reading width. Alternative: keep the bordered card floating in a `background-base` void. Rejected because the void reads as broken next to the artboard.
- **Login — 3 green-badge feature checks + bordered testimonial.** Reduce the feature list from four plain checkmarks to the three artboard items each with a circular green check badge, and wrap the testimonial in a bordered overlay box.
- **SSO recorded as a descope, not invented.** Chosen: do not add the SSO button/divider; reaffirm the existing deliberate omission. No backend scope is fabricated to satisfy a visual element.

## Risks / Trade-offs

- **Shared-component regressions across auth states** → The `AuthLayout` form pane and brand panel are reused by register/forgot/reset/verify. Changing them to the full-height surface treatment could shift those screens. Mitigation: verify each auth state visually against `Login.html` (they share the same layout in the design, so the change should improve all of them uniformly).
- **FieldRow refactor touching all settings tabs** → Introducing the horizontal FieldRow primitive risks spacing drift on Study defaults / Notifications. Mitigation: apply the primitive consistently and diff each tab against `Settings.html`.
- **Token swap coverage** → Replacing raw `text-slate-400` and the near-white underline with tokens must not regress dark/light rendering. Mitigation: assert the token in component tests rather than a literal colour.

## Open Questions

- **SSO (product decision).** The artboards show "Sign in with SSO" + an `or` divider on every auth state, but no backend identity-provider integration exists and the `web-auth` spec treats SSO as a deliberate omission. Should SSO be scoped as its own future change (with API scope), or permanently dropped from the design? Until product decides, this change keeps SSO omitted and does not render the button or divider.
