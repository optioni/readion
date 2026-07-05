## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up e2e harness per design.md Test Boundaries: route-intercept `analytics.optioni.fi/script.js` to a stub that installs a recording `window.umami` (`track`/`identify` push to an array); set `NUXT_PUBLIC_UMAMI_HOST`/`NUXT_PUBLIC_UMAMI_WEBSITE_ID` test env
- [x] 0.2 Write failing Playwright acceptance test walking the funnel: login → identify with UUID (not email) → start a study session → submit a quiz answer → end + reach summary; assert the recorded events (`log_in`, `session_started`, `quiz_answer_submitted`, `session_completed`) and their props, and assert no payload contains the user's email
- [x] 0.3 Confirm it fails for the right reason (no tracker/events recorded), not a harness/setup error

## 1. useTrack composable + TrackEvent union

- [x] 1.1 RED: Unit-test `useTrack().track` — forwards `event` + `props` to `window.umami.track` when present; safe no-op when `window.umami` is undefined; `identify` helper sends only `{ userId }`
- [x] 1.2 GREEN: Implement `app/composables/useTrack.ts` with the `TrackEvent` union (all catalog names) and `TrackProps` types; guard on `import.meta.client`/`window.umami`
- [x] 1.3 REFACTOR: Ensure the union is the single source of event names and props are typed to exclude free-text PII

## 2. Config-gated tracker bootstrap plugin

- [x] 2.1 RED: Unit-test the bootstrap logic — injects one script with correct `src`/`data-website-id` when both config vars set; skips injection when either is empty; never double-injects
- [x] 2.2 GREEN: Add `NUXT_PUBLIC_UMAMI_HOST` + `NUXT_PUBLIC_UMAMI_WEBSITE_ID` to `runtimeConfig.public` in `nuxt.config.ts` and to `apps/web/.env` + `.env.example`; implement `app/plugins/umami.client.ts` (client-only, config gate, single injection guard)
- [x] 2.3 Assert automatic page-view tracking: an e2e check that the recording stub captures a page view on initial load and on a client-side route change (`/` → `/user-certifications/:id/progress`) — no per-page code, verifies the injected tracker's History-API hook
- [x] 2.4 REFACTOR: Extract any shared config-reading helper; confirm no `window` reference on the SSR path

## 3. UUID-only identify wiring

- [x] 3.1 RED: Unit-test that a watch on the auth store's `user` calls `identify({ userId })` when it becomes non-null, does not call it when `user` is null, and never passes the email
- [x] 3.2 GREEN: In `umami.client.ts`, watch `useAuthStore().user` and call `identify` with the UUID only
- [x] 3.3 REFACTOR: Deduplicate identify calls on repeated resolutions

## 4. Event instrumentation — auth & onboarding

- [x] 4.1 RED: Unit-test `track` calls for `sign_up`, `log_in`, `log_out`, `email_verified`, `password_reset_requested`, `password_reset_completed`, `onboarding_started`, `cert_enrolled` (props `{ certId }`, only on `{ ok: true }`), `diagnostic_started`/`diagnostic_skipped` (props `{ enrollmentId }`)
- [x] 4.2 GREEN: Wire `track` into the auth pages/`stores/auth` (`clear`) and `useOnboardingActions` (`saveDefaultsAndEnroll`, `takeDiagnostic`, `skipDiagnostic`) on their success paths
- [x] 4.3 REFACTOR: Keep components presentation-only; instrumentation stays in composables/store

## 5. Event instrumentation — sessions & mock exam

- [x] 5.1 RED: Unit-test `session_started` (`{ enrollmentId, resumed }`), `quiz_answer_submitted` (`{ correct }`), `go_deeper_used`, `quiz_explanation_generated`, `quiz_question_reported`, `session_ended`, `session_completed` (`{ itemCount }`, on summary mount), `drill_started`, `mock_exam_started` (`{ enrollmentId }`), `mock_exam_submitted` (`{ auto }` true for `autoSubmit`, false for `confirmSubmit`)
- [x] 5.2 GREEN: Wire `track` into `sessionViewApi` (`createSession`, `submitQuizAnswer`, `goDeeperOnItem`, `generateQuizExplanation`, `reportQuizQuestion`, `endSession`, `drillSession`), `useQuickStartActions` (`startSession`/`startMockExam`), `useMockExamSubmit` (`runSubmit` with auto flag), and the session summary page mount
- [x] 5.3 REFACTOR: Ensure the `auto` flag is threaded from `autoSubmit`/`confirmSubmit` without leaking into the shared `runSubmit` contract awkwardly

## 6. Event instrumentation — agent & progress

- [x] 6.1 RED: Unit-test `agent_chat_opened` (`{ standalone }`), `agent_message_sent` (`{ inSession }`, not on empty/whitespace or mid-stream), `agent_new_chat`, `progress_viewed`/`review_started` (`{ enrollmentId }` on page mount)
- [x] 6.2 GREEN: Wire `track` into `useStandaloneAgentChat` (`initConversation`, `send`, `newChat`), the in-session agent conversation open path, and the progress/review page mounts
- [x] 6.3 REFACTOR: Share the `inSession`/`standalone` distinction cleanly between the standalone and session-linked chat paths

## 7. CSP / tracker origin allowance

- [x] 7.1 Verify current state: `apps/web` has no Content-Security-Policy in source today (no security module, no `routeRules` headers). Confirm this still holds before adding config
- [x] 7.2 GREEN (only if a CSP exists or is added): allow `https://analytics.optioni.fi` in `script-src`/`connect-src`; add an e2e assertion that the tracker script loads without a CSP violation. If no CSP is present, record that no change is needed and skip
- [x] 7.3 REFACTOR: If a CSP was touched, confirm no other origins were loosened

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the acceptance test passes end-to-end
- [x] 8.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm no startup/config errors, and that it runs with the Umami vars unset (tracking silently disabled)
- [x] 8.3 REFACTOR: Clean up test setup, the tracker stub, and any duplicated event-assertion helpers

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (record a one-line reason for each accepted WARNING), note SUGGESTIONs; re-run affected tests

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 10.3 Run type checker with zero errors (`yarn workspace @readion/web typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
