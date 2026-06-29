import { expect, test } from '@playwright/test'
import {
  AGENT_STANDALONE_STREAM_EVENTS,
  gotoAuthenticated,
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
    await expect(firstSuggestion).toContainText(SUGGESTIONS[0])

    // Clicking the suggestion submits it as the first user message.
    await firstSuggestion.click()

    // A user message bubble containing the suggestion text must appear.
    await expect(page.getByTestId('agent-message').first()).toContainText(SUGGESTIONS[0])

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
})
