## ADDED Requirements

### Requirement: Email configuration is validated at boot

The `apps/api` Zod env schema SHALL include an Email config group — SMTP2GO host, port, username, password, and a from address — and production/live SMTP boots MUST fail fast with an error naming the offending variable if any required SMTP variable is missing or malformed. The from address MUST be required in every environment, syntactically valid as an email address, and the port MUST parse as a number when provided.

#### Scenario: Valid email config exposes typed values

- **WHEN** the env schema parses an object with `SMTP_HOST=mail.smtp2go.com`, `SMTP_PORT=2525`, `SMTP_USERNAME=u`, `SMTP_PASSWORD=p`, and `MAIL_FROM=Readion <no-reply@readion.app>`
- **THEN** parsing succeeds and exposes `SMTP_PORT` as the number `2525` and `MAIL_FROM` as the string `Readion <no-reply@readion.app>`

#### Scenario: Production boot fails when a required SMTP variable is missing

- **WHEN** the env schema parses a production object that omits `SMTP_PASSWORD` while all other email variables are present
- **THEN** parsing throws an error whose message names `SMTP_PASSWORD`

#### Scenario: Boot fails when an email variable is malformed

- **WHEN** the env schema parses an object with `SMTP_PORT=not-a-number` (other email variables valid)
- **THEN** parsing throws an error whose message names `SMTP_PORT`

#### Scenario: Boot fails when the from address is not an email

- **WHEN** the env schema parses an object with `MAIL_FROM=not-an-email` (other email variables valid)
- **THEN** parsing throws an error whose message names `MAIL_FROM`

### Requirement: SMTP2GO transport is built from validated config

The `MailModule` SHALL construct a `nodemailer` transport for SMTP2GO from the validated Email config (host, port, username, password). The transport MUST NOT be constructed from raw `process.env`; it MUST read only from the validated config accessor so that a boot with invalid config never reaches transport creation.

#### Scenario: Transport factory uses validated config values

- **WHEN** the SMTP transport factory runs with a validated config of `host=mail.smtp2go.com`, `port=2525`, `username=u`, `password=p`
- **THEN** the produced transport is configured with host `mail.smtp2go.com`, port `2525`, and auth user `u`

#### Scenario: A non-SMTP transport is used in tests and credential-free dev

- **WHEN** the app boots in a test or local-dev profile without live SMTP2GO credentials
- **THEN** the `MailModule` provides a non-SMTP capturing transport (a JSON/stream transport or test double) so sends are recorded without contacting SMTP2GO and no boot error is raised for missing live credentials

### Requirement: Templates render typed text and HTML bodies

The mail template system SHALL render, for a registered template and a typed payload context, a `subject`, a plain-`text` body, and an `html` body. Every registered template MUST produce all three. The `html` body MUST be wrapped in the shared base HTML layout. Rendering MUST be a pure function of the template and its payload, independently testable without sending.

#### Scenario: A registered template renders all three parts

- **WHEN** the foundational template is rendered with its typed payload
- **THEN** the result has a non-empty `subject`, a non-empty `text` body, and an `html` body, and every payload field referenced by the template appears in both the `text` and `html` bodies

#### Scenario: HTML body is wrapped in the base layout

- **WHEN** any registered template is rendered
- **THEN** the `html` body contains the shared base layout wrapper (a complete `<html>` document) surrounding the template-specific content

#### Scenario: Rendering is side-effect free

- **WHEN** a template is rendered
- **THEN** no message is sent and no transport method is invoked — only the `{ subject, text, html }` result is produced

### Requirement: Typed service sends a registered template

The `MailService` SHALL expose a single typed entry point that sends a registered template by name to a recipient with a typed payload. The service MUST own the `from` address (from validated config) and the transport; callers MUST NOT pass a `from` or assemble raw `nodemailer` options. A template name with a payload whose type does not match the template's declared payload MUST be a compile-time type error.

#### Scenario: Sending a template delivers a rendered message

- **WHEN** `MailService` sends the foundational template to `user@example.com` with a valid payload, using the capturing transport
- **THEN** exactly one message is recorded with `to` equal to `user@example.com`, `from` equal to the configured `MAIL_FROM`, the template's rendered `subject`, and both `text` and `html` bodies present

#### Scenario: The caller never sets the from address

- **WHEN** a caller sends any template through `MailService`
- **THEN** the recipient address is the only address the caller supplies and the sent message's `from` equals the configured `MAIL_FROM` regardless of caller input

#### Scenario: A failed delivery surfaces as an error

- **WHEN** the underlying transport rejects a send (e.g. SMTP failure)
- **THEN** `MailService` propagates a rejected promise / thrown error to the caller rather than silently swallowing it

### Requirement: Mail module is injectable across feature modules

The `MailModule` SHALL export the `MailService` so any NestJS feature module that imports it can inject the typed service. The service MUST be resolvable in an `@nestjs/testing` module without booting the HTTP server.

#### Scenario: MailService resolves via dependency injection

- **WHEN** a test module imports `MailModule` (with the capturing transport) and resolves `MailService`
- **THEN** the resolved instance is a `MailService` able to send the foundational template
