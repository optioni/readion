# Design — profile-digest-toggle

## Context

`User.digestOptOut` already exists and the weekly-digest cron honors it (`lifecycle-email.service.ts`). Today the only writer is the public tokenized `GET /email/unsubscribe?token=...` link (opt-out only). The archived `web-settings` Notifications tab can therefore only show the preference informationally. This change surfaces the field on the authenticated profile contract so Settings can read and toggle it both ways.

## Approach

- **API**: extend the `users` profile read/update.
  - `GET /users/me`: include `digestOptOut` in the profile response DTO.
  - `PATCH /users/me`: accept optional `digestOptOut` (boolean) in the update DTO and persist it. Reuse the existing partial-update handler; no new transaction shape.
  - This is the right opportunity to add **swagger DTOs** to the profile controller — it currently has none, so the Orval client is weakly typed (`data: void`) and `web-settings` narrows envelopes manually with `@readion/shared` schemas. Adding the DTO types `digestOptOut` end-to-end.
- **Shared**: add `digestOptOut` to `userProfileResponseSchema` and `UpdateUserProfileRequest` (optional) in `@readion/shared`.
- **No entity/migration**: `digestOptOut` is already a `User` column.
- **Web**: Notifications tab becomes a switch bound to the profile query + an update mutation invalidating it.

## Test boundaries

- **Integration (Testcontainers)**: `GET /users/me` returns `digestOptOut`; `PATCH` sets it true/false and round-trips; non-boolean → `422`; the weekly-digest eligibility query reflects the new value (assert the cron's selection skips/keeps the user). The tokenized unsubscribe path still works and converges on the same field.
- **Unit**: DTO/schema validation for the new field.
- **e2e (Playwright)**: Notifications tab toggle issues `PATCH /users/me { digestOptOut }` and reflects state.
- **Outside-in order**: e2e RED → integration RED → unit RED → implement.

## Decisions

- **Two writers, one field**: keep the email unsubscribe link untouched; the authenticated toggle is purely additive. Both mutate `User.digestOptOut`; no precedence logic needed.
- **Add profile swagger DTOs now** rather than continuing the weakly-typed `data: void` client, so the field is typed and future profile fields follow suit.

## Open questions

- Whether to fold the existing manual `@readion/shared` envelope-narrowing in `web-settings` back to typed client methods once the DTO exists — nice cleanup, can be in-scope or a follow-up. Resolve in task 5.
