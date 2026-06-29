## Why

The weekly-digest opt-out (`User.digestOptOut`, already on the entity and honored by `lifecycle-email.service.ts` send-eligibility) can only be changed via the tokenized one-click `GET /api/v1/email/unsubscribe?token=...` link inside the digest email. That path is **one-directional** (opt-out only, no opt-back-in), carries a token reachable only from the email, and is neither readable nor settable from an authenticated session. The archived `web-settings` Notifications tab can therefore only surface the preference informationally and issues no request. Users should be able to **see and toggle** their digest preference from Settings.

(Surfaced as a flagged follow-up in `web-settings` — Impact → "`digestOptOut` is not exposed on `GET`/`PATCH /users/me`".)

## What Changes

- Expose `digestOptOut` on the authenticated profile contract:
  - Include it in the `GET /api/v1/users/me` response.
  - Accept it in `PATCH /api/v1/users/me` as a **two-way** boolean (opt out and opt back in).
- Leave the existing public tokenized unsubscribe link (`GET /email/unsubscribe?token=...`) working unchanged; the authenticated toggle becomes an additional writer of the same `digestOptOut` field. Digest send-eligibility logic is untouched.
- Frontend: the `web-settings` Notifications tab becomes a real two-way switch bound to the profile contract instead of a static pointer to the email link.

## Capabilities

### Modified Capabilities
- `user-profile`: the authenticated profile read/update contract includes `digestOptOut` (readable on `GET /users/me`, settable on `PATCH /users/me`).
- `lifecycle-email`: documents that the authenticated toggle and the tokenized unsubscribe mutate the same field; no change to which digests are sent.
- `web-settings`: the Notifications tab drives the real field rather than pointing to the email link.

## Impact

- **Code**: `apps/api/src/users/` (profile response DTO + update handler to include/accept `digestOptOut`), `packages/shared` (`userProfileResponseSchema` / `UpdateUserProfileRequest` gain the field), `apps/web/app/pages/settings/` Notifications tab. Integration tests for `GET`/`PATCH /users/me` round-tripping the field (including interaction with the tokenized unsubscribe); Playwright e2e for the toggle.
- **API**: `GET`/`PATCH /users/me` response/request shape changes → run `yarn codegen` and commit the client. Note: the profile controller currently lacks swagger DTOs (the Orval client is weakly typed `data: void`); this is a good opportunity to add the DTO so the field is typed end-to-end.
- **No new entity/migration**: `digestOptOut` already exists on `User`.
- **Dependencies**: archived `user-profile`, `lifecycle-email`, `web-settings`.
