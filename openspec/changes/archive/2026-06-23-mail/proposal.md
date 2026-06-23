## Why

Multiple downstream changes need to send transactional email — `auth` (password-reset link, email verification), `email-lifecycle` (welcome, weekly progress digest, post-exam outcome nudge) — but `apps/api` has no mail transport, no typed sending service, and no template system. Standing this up once, before `auth`, means every later change registers a typed template and calls a single service instead of re-wiring nodemailer and re-deriving config each time.

## What Changes

- **`MailModule` in `apps/api`** wrapping `nodemailer` with an SMTP2GO transport, built from validated config. Registered as a global/exported NestJS module so any feature module can inject the mail service.
- **Typed transactional-email service** — a single entry point that sends a registered template by name with a strongly-typed payload context. No caller hand-assembles raw `nodemailer` `sendMail` options; the service owns the `from` address, transport, and delivery. TypeScript strict mode enforces that a template's payload type matches at the call site.
- **Template system** — a renderer that produces both `text` and `html` bodies plus a `subject` for each registered template from a typed data context, with a shared base HTML layout. This change ships the rendering infrastructure and the typed template-registration contract; concrete templates (password-reset, verification, welcome, digest, nudge) are authored by their owning changes (`auth`, `email-lifecycle`). One minimal foundational/example template is included to exercise and verify the pipeline end-to-end.
- **Email config group** — extends the `apps/api` Zod env schema with the SMTP2GO group (host, port, username, password, from address), failing fast at boot if missing or malformed, per the Configuration spec.
- **Timezone-neutral transport** — the service stores/computes nothing in local time; rendering of user-facing timestamps in a display timezone is the caller's concern, so the transport itself stays timezone-agnostic. (The timezone-aware weekly-digest *cron* belongs to `email-lifecycle`, not here.)
- **Test fake / preview transport** — a non-SMTP transport (e.g. nodemailer JSON/stream transport or a capturing test double) so integration tests can assert what was sent without hitting SMTP2GO, and so local dev can run without live credentials.

No domain entity and no migration are introduced (per the roadmap entity-ownership table, `mail` owns no entity). No specific email *content or triggers* — those are owned by `auth` and `email-lifecycle`. No worker cron and no SPEC-listed feature metric is attributed to this change.

## Capabilities

### New Capabilities
- `transactional-email`: a NestJS `MailModule` providing an SMTP2GO/`nodemailer` transport built from validated config, a typed transactional-email service that sends registered templates by name with a typed payload, a `text`+`html` template-rendering system with a shared base layout and a typed registration contract, and a non-SMTP test/preview transport for tests and credential-free local dev.

### Modified Capabilities
<!-- None. The Email config group extends the api Zod schema established by api-foundation, but this change introduces foundation capabilities only and modifies no existing spec's requirements. -->

## Impact

- **Code**: `apps/api/src/mail/` — `mail.module.ts`, `mail.service.ts` (typed send entry point), `transport/` (SMTP2GO transport factory + test/preview transport), `templates/` (base layout, renderer, typed template registry + one foundational template). Extends `apps/api/src/config/` Zod schema with the Email group.
- **Dependencies (apps/api)**: `nodemailer` (+ `@types/nodemailer`). Consumes existing `@nestjs/config` + Zod env validation and `@readion/shared` env helpers from `api-foundation`.
- **Database**: none — no entity, no migration.
- **Entities owned**: none (per the roadmap entity-ownership table).
- **Cross-cutting**: no worker cron and no feature-emitted SPEC metric attributed to this change. The timezone-aware weekly-digest cron is owned by `email-lifecycle`.
- **Out of scope (owned elsewhere)**: concrete email templates and their triggers — password-reset + email-verification (`auth`), welcome + weekly digest + post-exam nudge (`email-lifecycle`); the weekly-digest timezone-aware cron and one-click unsubscribe handling (`email-lifecycle`).
- **Depends on**: `api-foundation` (archived) — for the NestJS bootstrap, the `@nestjs/config` + Zod schema this extends, and the global module wiring.
- **Unblocks**: `auth`, and transitively `users`, `web-auth`, and `email-lifecycle`.
