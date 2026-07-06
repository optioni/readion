## Context

`POST /api/v1/auth/register` (`AuthService.register()` in `apps/api/src/auth/auth.service.ts`) is currently unconditionally public. The service already contains the bootstrap rule that makes the first non-deleted user an admin (`userCount === 0`). Env vars are validated once at boot through a single Zod schema (`apps/api/src/config/env.schema.ts`) — this is the established pattern for every operator knob in the codebase, and there is no global-settings/feature-flag entity anywhere. Errors are emitted as RFC 7807 Problem Details by a global `ExceptionFilter`.

## Goals / Non-Goals

**Goals:**
- Let an operator close public registration on a deployment via a single env var.
- Default to open (fail-open) so existing deployments are unaffected.
- Never let the flag lock a fresh instance out of its own first-admin creation.
- Give the web signup page a clear "closed" state rather than a generic failure.

**Non-Goals:**
- A runtime-mutable, admin-panel toggle. Deliberately deferred — no settings infrastructure exists and building one is disproportionate.
- Gating any path other than `POST /auth/register` (no invite, no bulk-import path exists).
- New DB entity, migration, or Orval client change.

## Visual Design

No new designed view is introduced. This change adds one error state to the existing signup page: when registration returns `403 signups-disabled`, the form shows a "Registration is currently closed" message in place of the generic error banner. No DesignSync import is needed — the closed state reuses the page's existing error-banner styling with different copy.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (User table) | real (Testcontainers) | n/a (gate logic is pure) |
| Redis (throttler / refresh tokens) | real (Testcontainers) | n/a |
| `MailService` (verification email) | mocked at module boundary — assert NOT called when blocked | n/a |
| `SIGNUPS_ENABLED` env var | set per-test via config override | direct input to the pure gate function |
| Web signup HTTP call | Playwright drives real UI against a stubbed/real API returning `403 signups-disabled` | n/a |

## Decisions

- **Env var over settings entity.** Chosen because the toggle changes rarely (beta close, abuse response) and the codebase has no global-settings seam. Alternative — a key-value `AppSetting` entity + admin endpoint — was rejected as disproportionate; it can be revisited if runtime toggling is ever needed. Trade-off explicitly accepted: flipping the flag requires a redeploy/restart, so this is *not* the admin-panel toggle the original ask named.
- **Fail-open default (`SIGNUPS_ENABLED` defaults `true`).** Adding the var must not silently close signups on the next deploy. Zod `.default(true)` with boolean coercion of the string env value.
- **Enforce in the service, not a guard.** The gate lives in `register()` right next to the `userCount === 0` bootstrap rule so the bypass and the gate are read together and can't drift. A controller guard would have to re-query the user count, duplicating the bootstrap concept.
- **Bootstrap bypass ordering.** The gate is evaluated as: *if disabled AND at least one non-deleted user exists → reject.* Because `register()` already computes `userCount`, the bypass reuses it. The existing "email already taken" `409` check still runs first, so a blocked-but-duplicate email behaves consistently (see spec).
- **403 + `type: /errors/signups-disabled`.** A dedicated Problem Details `type` (following the existing `ERROR_TYPES` `/errors/<slug>` convention) lets the web app distinguish "closed" from other 4xx and show tailored copy. The `ProblemDetailsFilter` is extended to honor a custom `type` carried on the thrown exception's response payload, falling back to the status-derived type otherwise. `403 Forbidden` (not `503`) because the endpoint is deliberately, not transiently, refusing.

## Risks / Trade-offs

- [Operator sets `SIGNUPS_ENABLED=false` before creating the first admin] → bootstrap bypass allows the first user regardless of the flag; documented in `.env.example`.
- [Ambiguous string values like `"0"`, `"no"`] → env coercion accepts only well-defined truthy/falsy forms via the shared Zod boolean helper; anything else fails fast at boot with a clear error, consistent with other env fields.
- [Someone later expects an in-app toggle] → proposal and this design state plainly that this is env-only; the `AppSetting` path is named as the future upgrade.

## Open Questions

None — storage (env var), default (true), scope (`/auth/register` only), and bootstrap behavior (bypass kept) are all decided.
