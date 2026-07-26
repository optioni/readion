import { expect, test } from '@playwright/test'
import {
  AGENT_STANDALONE_STREAM_EVENTS,
  fulfilJson,
  gotoAuthenticated,
  mock,
  mockAgentChat,
  SUGGESTIONS,
} from './support/agent-chat-seed'

// ============================================================================
// web-agent-chat — acceptance test (outer-loop RED).
//
// Drives apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil + a
// `text/event-stream` agent mock) — see design.md Test Boundaries. No running NestJS API or
// Postgres is required.
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS: the routes and data-testids asserted below are the
// contract the implementation must satisfy. Keep them in sync.
//
// Routes
//   Standalone create : POST /api/v1/agent-conversations
//   Hydrate           : GET  /api/v1/agent-conversations/:id?include=messages
//   Agent turn stream : POST /api/v1/agent-conversations/:id/messages  (text/event-stream)
//
// Key data-testids
//   Page root         : agent-chat-page
//   Empty state       : agent-empty-state
//   Suggestion chips  : agent-suggestion  (one per chip)
//   Message bubbles   : agent-message     (user and assistant; distinguish by text content)
//   Streaming cursor  : agent-streaming-cursor
//   Input + send      : agent-input, agent-send-button
//   New chat          : agent-new-chat-button
//   TTL header chip   : agent-ttl-chip
//   Expiry banner     : agent-expiry-banner  (asserted by later groups)
//
// Negative contract (MUST NOT render in standalone mode)
//   tool-result-card  : no tool cards — standalone mode has an empty tool set
//   citation-chip     : no citation chips
// ============================================================================

test.describe('web-agent-chat — standalone /agent chat', () => {
  test('empty state → activate suggestion → user bubble → assistant streams → cursor clears → no tool cards', async ({
    page,
  }) => {
    mockAgentChat(page)
    await gotoAuthenticated(page, '/agent')

    // Page shell and empty state must be visible before any interaction.
    await expect(page.getByTestId('agent-chat-page')).toBeVisible()
    await expect(page.getByTestId('agent-empty-state')).toBeVisible()

    // At least the first suggestion chip must be rendered.
    const firstSuggestion = page.getByTestId('agent-suggestion').first()
    await expect(firstSuggestion).toBeVisible()
    await expect(firstSuggestion).toContainText(SUGGESTIONS[0]!)

    // Clicking the suggestion submits it as the first user message.
    await firstSuggestion.click()

    // A user message bubble containing the suggestion text must appear.
    await expect(page.getByTestId('agent-message').first()).toContainText(SUGGESTIONS[0]!)

    // The assistant response streams in; wait for the full concatenated phrase to appear.
    const streamedText = (AGENT_STANDALONE_STREAM_EVENTS as Array<{ textDelta: string }>)
      .map((e) => e.textDelta)
      .join('')
    await expect(page.getByTestId('agent-message').last()).toContainText(streamedText)

    // After [DONE] the streaming cursor must disappear.
    await expect(page.getByTestId('agent-streaming-cursor')).toBeHidden()

    // Negative assertions: standalone mode must never render tool cards or citation chips.
    await expect(page.getByTestId('tool-result-card')).not.toBeVisible()
    await expect(page.getByTestId('citation-chip')).not.toBeVisible()
  })

  test('unauthenticated visitor is redirected to /login — standalone create endpoint never requested', async ({
    page,
  }) => {
    // Return 401 from refresh so the client-side bootstrap stays logged out after the SSR redirect.
    mock(page, /\/api\/v1\/auth\/refresh$/, async (route) => {
      await fulfilJson(route, 401, { type: 'about:blank', title: 'Unauthorized', status: 401 })
    })

    let createRequestCount = 0
    mock(page, /\/api\/v1\/agent-conversations$/, async (route) => {
      if (route.request().method() === 'POST') {
        createRequestCount++
      }
      await fulfilJson(route, 403, { type: 'about:blank', title: 'Forbidden', status: 403 })
    })

    await page.goto('/agent')
    await page.waitForLoadState('networkidle')

    // The SSR auth middleware redirects /agent → /login?redirect=/agent.
    expect(page.url()).toContain('/login')
    // The standalone-create endpoint must never have been requested.
    expect(createRequestCount).toBe(0)
  })

  // --- TTL display (web-agent-ttl-display-fix) -------------------------------------------------
  // Standalone conversations carry a sliding 4-hour inactivity TTL derived client-side from the
  // conversation's `lastActivityAt` (`lastActivityAt + 4h - now`). Expiry chrome is actionable only
  // at or below the 30-minute threshold, where the page renders a warning banner.
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

  test('fresh standalone chat: ~full TTL renders no expiry chrome', async ({ page }) => {
    // lastActivityAt at ~now → remaining ≈ the full 4h window.
    mockAgentChat(page, { lastActivityAt: new Date().toISOString() })
    await gotoAuthenticated(page, '/agent')

    await expect(page.getByTestId('agent-chat-page')).toBeVisible()

    await expect(page.getByTestId('agent-ttl-chip')).toHaveCount(0)
    await expect(page.getByTestId('agent-expiry-banner')).not.toBeVisible()
  })

  test('near-expiry standalone chat shows the actionable inactivity warning only', async ({
    page,
  }) => {
    // lastActivityAt ≈ now - (4h - 5min) → remaining ≈ 5 minutes, within the 30-minute threshold.
    const nearExpiry = new Date(Date.now() - (FOUR_HOURS_MS - 5 * 60 * 1000)).toISOString()
    mockAgentChat(page, { lastActivityAt: nearExpiry })
    await gotoAuthenticated(page, '/agent')

    await expect(page.getByTestId('agent-chat-page')).toBeVisible()

    // The near-expiry banner appears and states the remaining whole minutes (tolerant of the 60s tick).
    const banner = page.getByTestId('agent-expiry-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('minute')

    await expect(page.getByTestId('agent-ttl-chip')).toHaveCount(0)
  })
})
