## Why

Operators need a way to close public registration on a deployment — for example at the end of a public beta, to cap an instance's user base, or to stop abusive signups — without removing the auth code. Today `POST /api/v1/auth/register` is unconditionally open.

## What Changes

- Add a `SIGNUPS_ENABLED` boolean env var (Zod-validated, **default `true` / fail-open**) so existing deployments keep working unchanged.
- `POST /api/v1/auth/register` is gated on this flag. When signups are disabled, registration returns `403` RFC 7807 Problem Details (`type: signups-disabled`), no `User` is created, and no verification email is sent.
- **Bootstrap escape hatch**: when the flag is disabled but no non-deleted `User` exists yet, registration is still allowed so the first-admin can always be created on a fresh instance.
- The web signup page detects the `signups-disabled` response and shows a "Registration is currently closed" message instead of a generic error.
- Not in scope: an admin-panel UI toggle. This is an env var read at boot, not a runtime-mutable setting — chosen because the codebase has no global-settings infrastructure and adding one is disproportionate to the need.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `authentication`: the registration requirement gains a gating condition on `SIGNUPS_ENABLED`, and the first-user-becomes-admin behavior is preserved as the bootstrap bypass.

## Impact

- **apps/api** — `config/env.schema.ts` (new `SIGNUPS_ENABLED` field, default `true`), `.env.example`; `auth/auth.service.ts` `register()` gains the gate + bootstrap bypass; a new `SignupsDisabledException` (or reuse of `ForbiddenException`) mapped to `type: signups-disabled` Problem Details.
- **apps/web** — signup page/form handles the `403 signups-disabled` response.
- **Tests** — Playwright e2e (signups-off shows closed message; bootstrap-first-admin still works), NestJS integration (register returns 403 when disabled, 201 when enabled, 201 for first user even when disabled), unit coverage of the gate decision.
- No DB entity, migration, or API-client (Orval) change — the register endpoint contract is unchanged except for the new `403` failure mode.
