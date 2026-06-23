## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add `apps/api` deps `nodemailer` + `@types/nodemailer`. Set up the acceptance harness per design.md Test Boundaries: an `@nestjs/testing` module importing `MailModule` wired to the **capturing (non-SMTP) `nodemailer` transport** (JSON/stream) — SMTP2GO is never contacted; no Postgres/Redis containers needed for this change
- [x] 0.2 Write the failing acceptance test (`*.spec.ts`, co-located under `apps/api/src/mail`): resolve `MailService` from the test module, send the foundational template to `user@example.com` with a valid payload, and assert via the captured message — exactly one message recorded with `to: user@example.com`, `from` equal to the configured `MAIL_FROM`, the rendered `subject`, and both non-empty `text` and `html` bodies, with the `html` wrapped in the base layout (`transactional-email` scenarios "Sending a template delivers a rendered message", "The caller never sets the from address", "MailService resolves via dependency injection", "HTML body is wrapped in the base layout")
- [x] 0.3 Confirm it fails for the right reason (missing `MailModule`/`MailService`/renderer/transport wiring — not a harness or import setup error)

## 1. Typed Mail Service (outermost)

- [x] 1.1 RED: Unit-test `MailService.send` against a fake transport and a stub registry — it renders the named template, sets `from` to the configured `MAIL_FROM` (caller supplies only `to` + payload), passes `subject`/`text`/`html` to the transport, and a rejected transport send propagates as a thrown/rejected error (`transactional-email` scenarios "The caller never sets the from address", "A failed delivery surfaces as an error"). Add a type-level assertion that a mismatched name/payload is a compile-time error
- [x] 1.2 GREEN: Implement `src/mail/mail.service.ts` — a single generic `send(template, to, payload)` entry point that resolves the template from the registry, renders it, injects `MAIL_FROM` from validated config, and delegates to the injected transport; no `from` parameter in the public signature
- [x] 1.3 REFACTOR: Tighten the registry-keyed generics so name↔payload typing holds under strict mode (no `any`/`as unknown`); use absolute-path (alias) imports

## 2. Template System (renderer, base layout, registry, foundational template)

- [x] 2.1 RED: Pure unit tests for the renderer — rendering the foundational template with its typed payload yields a non-empty `subject`, `text`, and `html`; every referenced payload field appears in both `text` and `html`; the `html` is wrapped in the shared base layout (a complete `<html>` document); rendering invokes no transport (side-effect free) (`transactional-email` scenarios "A registered template renders all three parts", "HTML body is wrapped in the base layout", "Rendering is side-effect free")
- [x] 2.2 GREEN: Implement `src/mail/templates/` — the shared base HTML layout wrapper, the typed template-registration contract (`subject(payload)`/`text(payload)`/`html(payload)` with a declared payload type), the registry, and one minimal foundational template exercising the contract
- [x] 2.3 REFACTOR: Extract the base-layout wrap as a pure helper shared by all templates; ensure the registry is additively extensible by downstream changes (`auth`, `email-lifecycle`) without edits here

## 3. Transport (SMTP2GO factory + capturing transport selection)

- [x] 3.1 RED: Unit-test the transport factory — given a validated config (`host`, `port`, `username`, `password`) it builds a `nodemailer` SMTP transport configured with those exact values and reads only from the config accessor (never raw `process.env`); under the test/dev-without-creds profile it returns the capturing (JSON/stream) transport (`transactional-email` scenarios "Transport factory uses validated config values", "A non-SMTP transport is used in tests and credential-free dev")
- [x] 3.2 GREEN: Implement `src/mail/transport/` — an SMTP2GO transport factory and a capturing transport, selected by a config-keyed provider in `mail.module.ts`; export `MailService` from `MailModule`
- [x] 3.3 REFACTOR: Ensure the provider selection keeps `MailService` identical across environments (production send path stays the tested path); clean up the module wiring

## 4. Email Config Group (Zod, deepest)

- [x] 4.1 RED: Unit-test the Email env group extension — a valid object exposes `SMTP_PORT` as a number and `MAIL_FROM` as a string; a missing `SMTP_PASSWORD`, a non-numeric `SMTP_PORT`, and a non-email `MAIL_FROM` each throw an error naming the offending variable (`transactional-email` scenarios "Valid email config exposes typed values", "Boot fails when a required email variable is missing", "Boot fails when an email variable is malformed", "Boot fails when the from address is not an email")
- [x] 4.2 GREEN: Extend the `apps/api` `src/config/` Zod schema with the Email group (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`) reusing `@readion/shared` env helpers; expose it via the typed config accessor consumed by the transport factory and `MailService`. Add the keys to `apps/api/.env.example`
- [x] 4.3 REFACTOR: Keep the Email group additive to the existing schema (no change to other groups); centralize defaults/constants and ensure strict typing

## 5. Acceptance Test — Outer Loop GREEN

- [x] 5.1 Confirm the acceptance test passes end-to-end against the capturing transport
- [x] 5.2 Verify the affected app starts in the local environment (smoke test) — boot `apps/api` with the Email config present and confirm no startup/config errors and that `MailModule` resolves
- [x] 5.3 REFACTOR: Clean up the test harness (shared module setup, captured-message helpers) and remove duplication

## 6. Change Review — Subagent Verification

- [x] 6.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only by severity — CRITICAL/WARNING/SUGGESTION — and does not edit code)
- [x] 6.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 7. Polish

- [x] 7.1 Run linter and fix all errors (`yarn lint`)
- [x] 7.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 7.3 Run type checker with zero errors (`yarn workspace @readion/api typecheck`)
- [x] 7.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace @readion/api test:coverage`)
