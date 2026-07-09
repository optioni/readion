import { expect, test } from '@playwright/test'
import { gotoAuthenticated, mockAgentChat } from './support/agent-chat-seed'

// ============================================================================
// web-agent-chat — full-height shell + bubble-role design-fidelity acceptance test
// (outer-loop RED).
//
// Companion to agent-chat.e2e.ts / agent-chat-fidelity.e2e.ts. This spec pins the remaining
// fix-web-settings-agent-parity deviations from openspec/design/AgentChat.html per design.md /
// specs/web-agent-chat/spec.md:
//   (a) agent.vue inherits the default padded, non-height-constrained layout — the whole page
//       scrolls instead of only the message region
//   (b) user and assistant bubble colors are inverted relative to the design (user should be
//       surface + secondary text, assistant should be primary + white)
//   (c) the Send button is enabled purely off `isStreaming`, not off textarea emptiness
//
// Route-mock style per design.md Test Boundaries: drives the real apps/web against a fully mocked
// HTTP API — no running NestJS API or Postgres required.
// ============================================================================

// A long seeded history so the message region genuinely overflows the viewport — the only way to
// tell "only the inner region scrolls" apart from "the whole page scrolls" is to force scroll to
// become necessary somewhere.
function longHistory(): unknown[] {
  const messages: unknown[] = []
  for (let i = 0; i < 20; i++) {
    messages.push({
      role: 'user',
      content: `Question number ${i} about a certification topic, long enough to take real space.`,
      createdAt: '2026-06-29T09:05:00.000Z',
    })
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `Answer number ${i}. This is a reasonably long explanation paragraph so that the message list grows tall enough to require internal scrolling once there are twenty exchanges like this one.`,
        },
      ],
      createdAt: '2026-06-29T09:05:01.000Z',
    })
  }
  return messages
}

test.describe('web-agent-chat — full-height shell design fidelity (AgentChat.html)', () => {
  test('header stays pinned and the whole page does not scroll — only the message region does', async ({
    page,
  }) => {
    mockAgentChat(page, { messages: longHistory() })
    await gotoAuthenticated(page, '/agent')

    await expect(page.getByTestId('agent-chat-page')).toBeVisible()
    const messageList = page.getByTestId('agent-message-list')
    await expect(messageList).toBeVisible()

    // The message list must actually need to scroll internally (its content overflows its box) —
    // otherwise the assertions below would trivially pass on a short page.
    const overflows = await messageList.evaluate(
      (el) => el.scrollHeight > el.clientHeight + 4,
    )
    expect(overflows).toBe(true)

    // RED: agent.vue currently inherits the default padded layout (no `definePageMeta({ layout
    // })`), so the whole document grows to fit the tall message list and the window scrolls.
    const documentScrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 4,
    )
    expect(documentScrollable).toBe(false)

    const headerTopBefore = await page.getByTestId('agent-header').boundingBox()
    await messageList.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    const headerTopAfter = await page.getByTestId('agent-header').boundingBox()
    if (!headerTopBefore || !headerTopAfter) {
      throw new Error('missing header bounding box')
    }
    // The header stays pinned at the same position whether or not the message list is scrolled.
    expect(headerTopAfter.y).toBeCloseTo(headerTopBefore.y, 0)
  })

  test('composer stays pinned to the bottom of the viewport', async ({ page }) => {
    mockAgentChat(page, { messages: longHistory() })
    await gotoAuthenticated(page, '/agent')

    await expect(page.getByTestId('agent-chat-page')).toBeVisible()

    // RED: `agent-composer` does not exist yet.
    await expect(page.getByTestId('agent-composer')).toBeVisible({ timeout: 5000 })

    const composer = await page.getByTestId('agent-composer').boundingBox()
    const viewport = page.viewportSize()
    if (!composer || !viewport) {
      throw new Error('missing composer bounding box or viewport size')
    }
    expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height + 2)
    expect(composer.y + composer.height).toBeGreaterThan(viewport.height - 120)
  })

  test('bubble color roles match the design: user = surface/secondary, assistant = primary/white', async ({
    page,
  }) => {
    mockAgentChat(page, { messages: longHistory() })
    await gotoAuthenticated(page, '/agent')

    // RED: `agent-message-bubble` (the colored inner element) does not exist yet.
    const bubbles = page.getByTestId('agent-message-bubble')
    await expect(bubbles.first()).toBeVisible({ timeout: 5000 })

    const userBubble = bubbles.first()
    const assistantBubble = bubbles.nth(1)

    // RED: the current markup swaps these — user renders bg-readion-primary, assistant renders
    // bg-readion-background-surface.
    const userBg = await userBubble.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(userBg).toBe('rgb(30, 41, 59)') // --color-readion-background-surface: #1e293b

    const assistantBg = await assistantBubble.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(assistantBg).toBe('rgb(29, 78, 216)') // --color-readion-primary: #1d4ed8
  })

  test('Send button is disabled while the textarea is empty and active once it has content', async ({
    page,
  }) => {
    mockAgentChat(page)
    await gotoAuthenticated(page, '/agent')

    await expect(page.getByTestId('agent-chat-page')).toBeVisible()

    const sendButton = page.getByTestId('agent-send-button')
    // RED: the current button is only disabled while streaming, so an empty textarea leaves it
    // enabled.
    await expect(sendButton).toBeDisabled()

    await page.getByTestId('agent-input').fill('Hello there')
    await expect(sendButton).toBeEnabled()

    await page.getByTestId('agent-input').fill('')
    await expect(sendButton).toBeDisabled()
  })
})
