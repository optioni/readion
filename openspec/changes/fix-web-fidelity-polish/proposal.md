## Why

A full UI walkthrough compared the live Settings, Agent chat, and Login surfaces against their reference artboards (`openspec/design/Settings.html`, `AgentChat.html`, `Login.html`). Three lower-severity design-fidelity deviations remain after the higher-severity bugs were split into their own changes. None is a functional bug — each is a visual/copy drift that makes a shipped screen read as unfinished next to its design.

- **Settings** — the content column is centered (`SettingsLayout.vue` `mx-auto max-w-[580px]`), leaving a large empty left gutter; the design left-aligns the same 580px column against the sidebar. The form pattern also drifts: the app stacks uppercase `font-mono` labels above full-width inputs, while the design pairs a sentence-case label in a fixed 160px column beside each field (a horizontal FieldRow). Labels use a raw `text-slate-400` value instead of a Readion text token, the password action reads "Change password" vs the design's "Update password", and the active-tab underline is near-white instead of the design's indigo accent.
- **Agent chat** — the empty state and header drift from the artboard: suggestion chips render as a horizontal row with no trailing arrows, whereas the design stacks them vertically full-width, each with a trailing `→` arrow; the empty state and header are missing the circular star avatar, and the header title reads "Ask AI" instead of the design's "Study assistant" beside a star avatar.
- **Login** — the form pane is a bordered card floating in an empty `background-base` void; the design makes the right pane a full-height `background-surface` panel (`flex: 1`) with the form left-aligned and vertically centered so it fills the surface rather than floating. The brand panel's feature list should be exactly three items each with a circular green check badge (the app renders four plain checkmarks), and the testimonial should be a bordered overlay box, not plain italic text.

Two suspicions raised during the walkthrough were **investigated and CLEARED**, so they are explicitly out of scope: the agent "New chat" empty state is correct as-is (the design has **no** conversation-history sidebar — none should be added); the settings tab set is complete (there is **no** missing "Profile" tab); and the Account tab's display-timezone default is fine (it already shows `Europe/Helsinki`). This change is therefore fidelity polish only, not new capability.

**Open question — SSO (login):** the design's artboards show a "Sign in with SSO" button and an `or` divider on every auth state. The current `web-auth` spec already records SSO as a **deliberate omission** ("SSO remains omitted and is NOT reintroduced"). We keep that stance here: SSO is treated as a **descope** pending a product decision, because reintroducing it would require backend identity-provider scope that does not exist and is not invented by this fidelity change. No SSO button or `or` divider is added; if product later decides to ship SSO it becomes its own change with API scope. This change reaffirms the no-SSO divergence rather than resolving it.

## What Changes

- **web-settings** — left-align the contained 580px content column against the sidebar (remove the centering gutter); adopt the horizontal FieldRow label pattern (sentence-case label in a fixed-width column beside the field) instead of uppercase mono labels stacked above; drive field labels from a Readion text token instead of a raw `text-slate-400` value; relabel the password action "Update password"; and render the active-tab underline in the indigo accent token.
- **web-agent-chat** — stack the empty-state suggestion chips vertically, full-width, each with a trailing `→` arrow; add the circular star avatar above the "Study assistant" empty-state heading; and give the chat header a circular star avatar with a "Study assistant" title (replacing "Ask AI").
- **web-auth** — make the login form pane a full-height `background-surface` panel that fills the right side, with the form left-aligned and vertically centered (not a bordered card in an empty base void); render exactly three brand-panel feature items each with a circular green check badge; and render the testimonial as a bordered overlay box. Reaffirm the no-SSO / no `or` divider divergence.

## Capabilities

### Modified Capabilities

- `web-settings`: left-aligned contained content column, horizontal FieldRow label pattern with a tokenized label colour, "Update password" copy, and an indigo active-tab underline.
- `web-agent-chat`: vertically stacked suggestion chips with trailing arrows, and a star-avatar "Study assistant" identity in the empty state and header.
- `web-auth`: a full-height surface login form pane, and a brand panel with three green-badge feature checks and a bordered testimonial.

## Impact

- **`apps/web`** — presentational/markup only:
  - `apps/web/app/components/**/SettingsLayout.vue` (column alignment, tab underline token), `AccountTab.vue` and the shared settings field/label primitives (FieldRow layout, label token, "Update password" copy).
  - `apps/web/app/pages/agent.vue` and its empty-state/header/suggestion-chip components (chip layout + arrows, star avatar, "Study assistant" header title).
  - `apps/web/app/pages/login.vue` and the shared auth layout / brand-panel components (form-pane fill, feature-badge list, bordered testimonial).
- **No API, DB, or contract changes** — no `apps/api`, `packages/shared`, `packages/db`, or generated-client changes; no new endpoints and no schema edits.
- **Tests** — new/updated Playwright e2e assertions for the three surfaces plus component-level unit tests; no integration tests (no backend surface is touched).
- **Descoped:** SSO button + `or` divider on the auth pages remain omitted (product decision pending); no conversation-history sidebar is added to the agent page.
