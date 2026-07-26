import { expect, test } from '@playwright/test'
import { gotoAuthenticated, mockAgentChat, SUGGESTIONS } from './support/agent-chat-seed'
import { requireBoundingBoxes } from './support/fidelity-helpers'

// ============================================================================
// web-agent-chat — design-fidelity acceptance test (outer-loop RED).
//
// Companion to agent-chat.e2e.ts (functional journey + TTL display). This spec pins the REMAINING
// fix-web-fidelity-polish deviations from openspec/design/AgentChat.html per design.md /
// specs/web-agent-chat/spec.md:
//   (a) the chat header shows a circular star avatar beside the title "Study assistant" — not
//       "Ask AI" (apps/web/app/pages/agent.vue currently renders `<h1>Ask AI</h1>` with no avatar)
//   (b) the empty-state suggestion chips render as a VERTICAL, full-width stack, each carrying a
//       trailing `→` arrow — not the current horizontal `flex flex-wrap justify-center` row of
//       arrow-less pills
//
// Route-mock style per design.md Test Boundaries: drives the real apps/web against a fully mocked
// HTTP API (including the `text/event-stream` agent-turn mock) — no running NestJS API or Postgres
// required.
//
// The exact star-avatar SVG path (`M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z`)
// and the trailing-arrow SVG path (`M5 12h14M12 5l7 7-7 7`) come straight from AgentChat.html so the
// assertions target the exact mark the artboard uses, not an invented proxy.
// ============================================================================

const STAR_PATH_D = 'M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z'
const ARROW_PATH_D = 'M5 12h14M12 5l7 7-7 7'

test.describe('web-agent-chat — design fidelity (AgentChat.html)', () => {
  test('header shows a star avatar and the "Study assistant" title, not "Ask AI"', async ({
    page,
  }) => {
    mockAgentChat(page)
    await gotoAuthenticated(page, '/agent')

    await expect(page.getByTestId('agent-chat-page')).toBeVisible()

    // RED: the header title currently reads "Ask AI".
    await expect(page.locator('h1')).toHaveText('Study assistant')

    await expect(
      page.getByTestId('agent-header-avatar').locator(`svg path[d="${STAR_PATH_D}"]`),
    ).toHaveCount(1)
  })

  test('empty-state suggestions are a vertical, full-width stack with trailing arrows', async ({
    page,
  }) => {
    mockAgentChat(page)
    await gotoAuthenticated(page, '/agent')

    const emptyState = page.getByTestId('agent-empty-state')
    await expect(emptyState).toBeVisible()

    const chips = page.getByTestId('agent-suggestion')
    await expect(chips).toHaveCount(SUGGESTIONS.length)

    const { chip0, chip1, emptyStateBox } = await requireBoundingBoxes({
      chip0: chips.nth(0),
      chip1: chips.nth(1),
      emptyStateBox: emptyState,
    })

    // RED: a vertical stack puts chip1 strictly below chip0. The current
    // `flex flex-wrap justify-center` row instead places them side by side on the same line at a
    // typical desktop viewport width, so chip1.y is not below chip0's bottom edge.
    expect(chip1.y).toBeGreaterThanOrEqual(chip0.y + chip0.height - 2)

    // RED: "full-width" means each chip spans (most of) the empty state's width, not a
    // content-sized pill. The current rounded-full chips are far narrower than their container.
    expect(chip0.width).toBeGreaterThan(emptyStateBox.width * 0.6)

    // RED: each chip carries a trailing arrow matching the artboard's exact path — the current
    // chips render only text, no svg at all.
    await expect(chips.first().locator(`svg path[d="${ARROW_PATH_D}"]`)).toHaveCount(1)
  })
})
