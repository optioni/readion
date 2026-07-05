# Web Analytics Spec

## Purpose

Client-side Umami integration for the Nuxt frontend. It bootstraps the self-hosted tracker under config gating, identifies users by UUID only (never PII), exposes an SSR-safe typed `useTrack()` seam, and emits a funnel-shaped catalog of custom user-flow events wired at existing composable/page choke points. This capability is frontend-only and unrelated to the admin `product-analytics` read model.

## Requirements

### Requirement: Config-gated client-only tracker bootstrap

The system SHALL load the Umami tracker only in the browser, and only when both `NUXT_PUBLIC_UMAMI_HOST` and `NUXT_PUBLIC_UMAMI_WEBSITE_ID` are configured. The bootstrap SHALL inject a single `<script>` element whose `src` is `<UMAMI_HOST>/script.js` and whose `data-website-id` attribute is `NUXT_PUBLIC_UMAMI_WEBSITE_ID`. When either variable is empty or missing, no script SHALL be injected and no tracker global SHALL be created. The bootstrap SHALL NOT run during server-side rendering.

#### Scenario: Both config vars set injects the tracker

- **WHEN** the app boots in the browser with `NUXT_PUBLIC_UMAMI_HOST=https://analytics.optioni.fi` and a non-empty `NUXT_PUBLIC_UMAMI_WEBSITE_ID`
- **THEN** exactly one `<script>` with `src="https://analytics.optioni.fi/script.js"` and matching `data-website-id` is present in the document head
- **THEN** no second tracker script is injected on subsequent client-side navigations

#### Scenario: Missing website id skips injection

- **WHEN** the app boots with `NUXT_PUBLIC_UMAMI_HOST` set but `NUXT_PUBLIC_UMAMI_WEBSITE_ID` empty
- **THEN** no Umami `<script>` element is injected into the document

#### Scenario: No injection during SSR

- **WHEN** a page is rendered on the server
- **THEN** the server-rendered HTML contains no Umami tracker script and no reference to `window.umami`

### Requirement: Automatic page-view tracking across SPA navigation

The system SHALL rely on the Umami tracker's automatic page-view collection so that both the initial page load and every subsequent client-side route change are recorded as page views without per-page instrumentation.

#### Scenario: Route change records a page view

- **WHEN** an authenticated user navigates from `/` to `/user-certifications/:id/progress` via client-side routing
- **THEN** a page view for the destination path is recorded by the tracker

### Requirement: SSR-safe typed event tracking

The system SHALL expose a `useTrack()` composable returning a `track(event, props?)` function where `event` is a member of a `TrackEvent` union of the defined event names. Calling `track` SHALL invoke `window.umami.track(event, props)` when the tracker is present, and SHALL be a safe no-op (no thrown error) when `window.umami` is undefined — during SSR, in local dev without config, or when the script is blocked. The union type SHALL make an unknown event name a compile-time error.

#### Scenario: track forwards to the tracker when present

- **WHEN** `track('session_started', { enrollmentId: 'e1', resumed: false })` is called and `window.umami` exists
- **THEN** `window.umami.track` is called once with `'session_started'` and `{ enrollmentId: 'e1', resumed: false }`

#### Scenario: track is a no-op when the tracker is absent

- **WHEN** `track('log_in')` is called and `window.umami` is undefined
- **THEN** the call returns without throwing and no tracker method is invoked

#### Scenario: Unknown event name fails typecheck

- **WHEN** code calls `track('not_a_real_event')`
- **THEN** the TypeScript compiler rejects it because the argument is not assignable to `TrackEvent`

### Requirement: UUID-only user identification without PII

The system SHALL call `window.umami.identify({ userId })` with the authenticated user's UUID (`AuthUser.id`) once the auth store resolves a user, and SHALL re-run identification when the user changes from unauthenticated to authenticated. The identify payload and every event's props SHALL NEVER include the user's email, display name, or any other personally identifying free-text field. On logout no identifying call is required, and no email SHALL ever be passed to any Umami method.

#### Scenario: Identify uses the UUID on login

- **WHEN** the auth store transitions to an authenticated user with `id='11111111-1111-1111-1111-111111111111'` and `email='a@b.com'`
- **THEN** `window.umami.identify` is called with `{ userId: '11111111-1111-1111-1111-111111111111' }`
- **THEN** no argument passed to `identify` contains the string `a@b.com`

#### Scenario: No identify when unauthenticated

- **WHEN** the app boots and the auth store resolves with no user (`user === null`)
- **THEN** `window.umami.identify` is not called

#### Scenario: Event props never carry email

- **WHEN** any catalog event is tracked for an authenticated user
- **THEN** the props object passed to `window.umami.track` contains no field whose value is the user's email

### Requirement: User-flow event catalog

The system SHALL emit the following custom events at the named choke points, each with the listed props and no PII. Events SHALL fire only on the successful path of the underlying action unless stated otherwise.

| Event | Fires from | Props |
|---|---|---|
| `sign_up` | successful register | — |
| `log_in` | successful login | — |
| `log_out` | auth store `clear()` on user-initiated logout | — |
| `email_verified` | verify-email success | — |
| `password_reset_requested` | forgot-password submit success | — |
| `password_reset_completed` | reset-password success | — |
| `onboarding_started` | onboarding entry | — |
| `cert_enrolled` | `saveDefaultsAndEnroll` success | `certId` |
| `diagnostic_started` | `takeDiagnostic` | `enrollmentId` |
| `diagnostic_skipped` | `skipDiagnostic` | `enrollmentId` |
| `session_started` | `createSession` / `startSession` success | `enrollmentId`, `resumed` |
| `quiz_answer_submitted` | `submitQuizAnswer` success | `correct` |
| `go_deeper_used` | `goDeeperOnItem` | — |
| `quiz_explanation_generated` | `generateQuizExplanation` | — |
| `quiz_question_reported` | `reportQuizQuestion` | — |
| `session_ended` | `endSession` | — |
| `session_completed` | session summary page mount | `itemCount` |
| `drill_started` | `drillSession` | — |
| `mock_exam_started` | `startMockExam` success | `enrollmentId` |
| `mock_exam_submitted` | `runSubmit` success | `auto` |
| `agent_chat_opened` | `initConversation` | `standalone` |
| `agent_message_sent` | `send` (non-empty, not mid-stream) | `inSession` |
| `agent_new_chat` | `newChat` | — |
| `progress_viewed` | progress page mount | `enrollmentId` |
| `review_started` | review page mount / start | `enrollmentId` |

#### Scenario: Enrollment emits cert_enrolled

- **WHEN** `saveDefaultsAndEnroll` resolves successfully for certification `certId='cert-abc'`
- **THEN** `track` is called with `'cert_enrolled'` and props `{ certId: 'cert-abc' }`

#### Scenario: Failed enrollment does not emit

- **WHEN** `saveDefaultsAndEnroll` returns `{ ok: false }` because the enroll request threw
- **THEN** no `'cert_enrolled'` event is tracked

#### Scenario: Quiz answer carries correctness

- **WHEN** `submitQuizAnswer` resolves with a response marking the answer incorrect
- **THEN** `track` is called with `'quiz_answer_submitted'` and props `{ correct: false }`

#### Scenario: Auto-submit distinguishes from manual submit

- **WHEN** a timed mock exam is submitted by `autoSubmit` (timer expiry) via `runSubmit`
- **THEN** `track` is called with `'mock_exam_submitted'` and props `{ auto: true }`
- **WHEN** the same exam is instead submitted via `confirmSubmit` (user confirms)
- **THEN** the props are `{ auto: false }`

#### Scenario: In-session tutor message is distinguished

- **WHEN** a user sends a non-empty message in a session-linked agent conversation
- **THEN** `track` is called with `'agent_message_sent'` and props `{ inSession: true }`

#### Scenario: Empty tutor message does not emit

- **WHEN** `send` is called with whitespace-only content, or while a stream is already in progress
- **THEN** no `'agent_message_sent'` event is tracked
