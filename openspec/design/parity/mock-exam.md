# Parity — Mock exam

7 findings — 2 high · 2 medium · 3 low

- **[high] Full-screen exam chrome (single header)** — divergent/layout
  - design: The artboard description explicitly states 'Full-screen, no agent, no sidebar nav' — the ExamHeader (52px) is the only chrome above the question/nav-panel split; the SAA-C03 badge and logo mark live inside that single bar.
  - app: The page uses layouts/minimal.vue, which renders its own 52px ('h-13') header with a 'Readion' wordmark and a 'Back to dashboard' link, stacked directly above MockExamActiveScene's own ExamHeader — two header bars instead of one.
  - evidence: `design: openspec/design/MockExam.html:529 (subtitle) + ExamHeader lines 85-133; app: apps/web/app/layouts/minimal.vue:1-19 wrapping apps/web/app/components/MockExamActiveScene.vue:82-91 (ExamHeader)`
- **[high] Flag toggle — per-question state** — divergent/behavioral
  - design: Flagging a question marks that specific question's square 'flagged' (orange) in the NavPanel grid, independent of which question is currently displayed (design shows Q12 as 'current' and Q13 as 'flagged' simultaneously) — implying flags are tracked per-question and surfaced in the nav grid.
  - app: `flagged` is a single local `ref(false)` inside ExamHeader.vue, not keyed by question index and never passed to MockExamNavPanel/examNavSquares. Toggling Flag on one question does not change per-question state, is not reflected in any nav square, and the code comment confirms it is 'session-local and intentionally lost on reload' with no backing field.
  - evidence: `design: openspec/design/MockExam.html:118-126 (header flag button), 174 & 203-206 (flagged square state/legend), 303-308 (activeSquares with distinct flagged index 12); app: apps/web/app/components/ExamHeader.vue:39-40,91-105 and apps/web/app/composables/examNavSquares.ts:1-47 (no 'flagged' state exists)`
- **[medium] NavPanel 'Flagged' square state + legend entry** — missing/composition
  - design: Active-mode NavPanel legend has two swatches: 'Answered' (primary) and 'Flagged' (warning/orange); the square-state palette includes a distinct 'flagged' color and the grid renders a flagged square (idx 12) alongside the current square (idx 11).
  - app: MockExamNavPanel's active-mode legend shows 'Answered' and 'Current' instead of 'Answered' and 'Flagged'; NavSquareState type has no 'flagged' variant at all, so a flagged question can never render distinctly in the grid.
  - evidence: `design: openspec/design/MockExam.html:203-206 (active legend), 174 (flagged color); app: apps/web/app/components/MockExamNavPanel.vue:70-73 (legend), apps/web/app/composables/examNavSquares.ts:5 (NavSquareState)`
- **[medium] Header brand/logo mark** — missing/composition
  - design: ExamHeader includes a small accent-colored rounded-square logo mark with a star SVG icon next to the cert code, establishing brand identity within the exam chrome itself.
  - app: ExamHeader.vue renders only the cert code chip (and optional cert name) — no logo mark icon; the only 'Readion' branding lives in the separate outer minimal-layout header as plain text, not as the icon+badge design depicts.
  - evidence: `design: openspec/design/MockExam.html:88-93; app: apps/web/app/components/ExamHeader.vue:48-56`
- **[low] Flag button icon** — simplified/composition
  - design: Flag button shows a flag-shaped SVG icon (filled/stroked based on flagged state) alongside the 'Flag' text label.
  - app: Flag button renders only the text 'Flag' with color/border state changes — no icon.
  - evidence: `design: openspec/design/MockExam.html:120-125; app: apps/web/app/components/ExamHeader.vue:91-105`
- **[low] Timer clock icon** — simplified/composition
  - design: Timer pill includes a small clock SVG icon before the time string, color-matched to the urgent/neutral state.
  - app: Timer span renders only the mono time string (or paused placeholder) with border/text color changes — no icon.
  - evidence: `design: openspec/design/MockExam.html:113-116; app: apps/web/app/components/ExamHeader.vue:74-89`
- **[low] Header cert identity text** — divergent/composition
  - design: Header shows only the uppercase cert code (e.g. 'SAA-C03') next to the logo mark, nothing else.
  - app: ExamHeader additionally renders the full cert name text next to the code chip when available, an element not present in the design's active-state header.
  - evidence: `design: openspec/design/MockExam.html:92; app: apps/web/app/components/ExamHeader.vue:55`
