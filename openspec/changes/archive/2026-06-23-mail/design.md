## Context

`apps/api` was bootstrapped by `api-foundation` with a global `ResponseInterceptor`, RFC 7807 `ExceptionFilter`, `@nestjs/config` + Zod env validation (fail-fast at boot), security middleware, throttler, health checks, and the Orval pipeline. It has no mail capability. The next change in the roadmap, `auth`, needs to send a password-reset link and an email-verification message, and `email-lifecycle` later needs welcome/digest/nudge emails. SPEC → Email mandates SMTP2GO via `nodemailer`, a dedicated `MailModule` in `apps/api`, a typed service for transactional email, and plain-text + HTML templates. SPEC → Configuration mandates an Email config group (host, port, username, password, from address) validated by the api Zod schema.

This change builds only the foundation: transport, typed service, template-rendering system, and the config group. Concrete templates and their triggers belong to the consuming changes (`auth`, `email-lifecycle`), so this change ships exactly one minimal foundational template purely to exercise and verify the pipeline end-to-end.

## Goals / Non-Goals

**Goals:**
- A `MailModule` wrapping `nodemailer` with an SMTP2GO transport built strictly from validated config (never raw `process.env`).
- A single typed `MailService.send(...)` entry point that renders a registered template by name with a typed payload and delivers it, owning the `from` address and transport so callers supply only the recipient + payload.
- A `text` + `html` template-rendering system with a shared base HTML layout and a typed registration contract; rendering is a pure, independently testable function.
- The Email Zod config group extending the existing api schema, failing fast at boot.
- A non-SMTP capturing transport so integration tests assert sent messages without touching SMTP2GO and local dev runs without live credentials.

**Non-Goals:**
- Concrete email content/triggers — password-reset + verification (`auth`); welcome + weekly digest + post-exam nudge (`email-lifecycle`).
- The timezone-aware weekly-digest cron and one-click unsubscribe handling (`email-lifecycle`, in `apps/worker`).
- Any domain entity, migration, persistence, or email-event audit log (`mail` owns no entity).
- Bounce/complaint webhooks, retry/queueing of failed sends, and email open/click tracking.
- Rendering user-facing timestamps in a display timezone — that is the caller's concern; the transport stays timezone-agnostic.

## Test Boundaries

The acceptance test boots a NestJS app via `@nestjs/testing` (no HTTP server needed for a non-controller module) with the `MailModule` wired to a **capturing (non-SMTP) transport** so sent messages are inspected in-memory. SMTP2GO is never contacted in any test. Per `api-foundation`'s harness, real Postgres/Redis containers are available, but `mail` touches neither, so no containers are required for this change's tests.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| SMTP2GO (live SMTP) | never contacted — capturing nodemailer transport (JSON/stream) | never contacted |
| `nodemailer` transport | real `nodemailer` with capturing transport (asserts the sent message object) | real renderer; transport faked/spy at the module boundary |
| Template renderer | real (pure render) | real (pure render) |
| Zod env schema | real (parse valid/invalid env objects) | real (parse valid/invalid env objects) |
| Postgres / Redis | not used by this change | not used by this change |

## Decisions

- **Capturing nodemailer transport instead of mocking `nodemailer`.** Use a real `nodemailer` instance backed by a JSON/stream transport (or a thin capturing transport) selected by config/profile, rather than `vi.mock('nodemailer')`. Rationale: exercises the actual `sendMail` option assembly and message encoding, so the test verifies the message a real SMTP transport would receive. Alternative considered — mocking the module — was rejected because it would let option-assembly bugs pass.

- **Transport selection by validated config/profile, not a separate code path.** The SMTP2GO transport vs. the capturing transport is chosen by a provider factory keyed on config (e.g. a transport-mode flag defaulting to SMTP in production, capturing in test/dev-without-creds). Rationale: keeps `MailService` identical across environments so tests exercise the real send path. Alternative — branching inside `MailService` — was rejected as it would leave the production path untested.

- **Typed template registry keyed by template name → payload type.** Templates are registered as objects exposing `subject(payload)`, `text(payload)`, `html(payload)` with a declared payload type, and `MailService.send` is generic over the registry so a name/payload mismatch is a compile-time error. Rationale: satisfies "typed transactional-email service" under TS strict mode without `any`. Alternative — passing pre-rendered strings to a generic `send(to, subject, html, text)` — was rejected because it pushes rendering and `from`-handling onto every caller and loses type safety.

- **Plain string/template-literal rendering with a shared base layout, no heavy template engine.** Render via typed functions composing a shared base HTML layout wrapper; no Handlebars/MJML dependency in this change. Rationale: keeps the foundation dependency-light and fully unit-testable; consuming changes can introduce richer templates within the same contract if needed. Alternative — adding a templating engine now — was rejected as premature for a single foundational template.

- **`from` owned by the service from config.** `MailService` injects `MAIL_FROM` from validated config and sets it on every message; the public `send` signature has no `from` parameter. Rationale: enforces a single sender identity and prevents spoofing/inconsistency across callers.

- **Errors propagate, not swallowed.** A transport rejection becomes a rejected promise from `MailService.send`. Rationale: callers (e.g. `auth`) decide whether a failed reset email is fatal; the mail layer must not hide failures. Retry/queueing is explicitly out of scope here.

## Risks / Trade-offs

- **No delivery guarantee / no retry** → Out of scope by design; failures surface to callers. A later change can wrap sends in a BullMQ job if at-least-once delivery is needed.
- **Capturing transport diverges from real SMTP2GO behavior** → Mitigated by using a real `nodemailer` instance (only the transport backend differs), so option assembly and MIME encoding are real; only the network hop is skipped.
- **Single foundational template risks under-exercising the contract** → Mitigated by spec scenarios that assert all three render parts, base-layout wrapping, side-effect-free rendering, and DI resolvability, so the contract consuming changes rely on is fully covered.
- **Config drift between dev (no creds) and prod** → Mitigated by validating the full Email group in prod and selecting the capturing transport only under an explicit test/dev profile, so production cannot silently run without SMTP2GO.

## Open Questions

- None blocking. Whether to adopt a templating engine (MJML/Handlebars) is deferred to the first consuming change that needs richer layouts; the typed registry contract is engine-agnostic.
