## Context

The `authentication` capability spec's "State-changing requests are CSRF-protected" requirement still describes a blanket rule — any refresh-cookie-bearing state change lacking a valid CSRF token is `403` — which, read literally, would lock a user out of `login`/`register` when a stale `refresh_token` cookie lingers without a matching `csrf_token`. The **implementation no longer behaves that way**: commit `16e6111` ("fix(auth): exempt login and register from CSRF guard", 2026-07-06) added a `@CsrfExempt()` decorator honored by `CsrfGuard` and applied it to `login`/`register`, shipping with regression tests that are currently green. This is a spec↔code contradiction; the spec lags the code.

## Goals / Non-Goals

**Goals:**
- Align the `authentication` spec with the already-implemented behavior: document the session-establishing-endpoint CSRF exemption and a no-permanent-lockout recovery guarantee.

**Non-Goals:**
- Any source code change. The behavior already exists in `apps/api/src/auth/csrf.guard.ts` and `auth.controller.ts`.
- Any new test. Existing tests already prove the behavior.
- Changing CSRF protection for other cookie-authenticated state changes (`refresh`, `logout`, `change-password`).

## Test Boundaries

No new tests are introduced. The requirements are backed by the **existing** proving tests:

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres | real (Testcontainers) — `auth.acceptance.spec.ts` full controller/supertest pipeline | not used |
| Redis | real (Testcontainers) — `auth.acceptance.spec.ts` (refresh-token store) | not used |
| CsrfGuard / Reflector | exercised in the real Nest app pipeline (`auth.acceptance.spec.ts`) | guard-in-isolation with a stubbed `Reflector` (`csrf.guard.spec.ts`) |
| MailService | capturing (non-SMTP) transport in `auth.acceptance.spec.ts` | not used |

Proving cases already present: `auth.acceptance.spec.ts` — login/register with `Cookie: refresh_token=staleleftover` and no csrf ⇒ `200`/`201` with reissued cookies; `csrf.guard.spec.ts` — exempt handler passes with a refresh cookie and no csrf token.

## Decisions

- **Codify existing behavior rather than run a RED bug fix.** The bug premise (login currently `403`s) is stale — the running server that produced the original `403` predated `16e6111`. So this change asserts and documents the shipped behavior instead of reproducing a failure.
- **MODIFY the CSRF requirement** to carve out the `login`/`register` exemption inline (keeping the double-submit rule for other endpoints) rather than deleting/replacing it, so the protective guarantee is preserved and only the exemption is added.
- **ADD a separate "no permanent login lockout" requirement** rather than folding it into the CSRF requirement, because it is a distinct user-facing recovery guarantee (session-establishing endpoints stay reachable and reissue a fresh cookie pair) that spans login and register.

## Risks / Trade-offs

- [Spec drift resurfaces if the exemption is later removed in code] → the ADDED requirement's scenarios pin the recovery guarantee, and the existing tests fail if the exemption regresses, keeping spec and code coupled.
- [Minimal risk] spec-only change; no runtime, migration, or API surface is touched.

## Open Questions

None.
