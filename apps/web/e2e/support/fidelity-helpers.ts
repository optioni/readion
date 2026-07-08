import type { Locator } from '@playwright/test'

// Shared assertion helper for the *-fidelity.e2e.ts specs (settings-fidelity, agent-chat-fidelity,
// login-fidelity). Each of those measures two or three locators via Playwright's `boundingBox()`,
// which resolves to `null` when the element isn't in the layout (e.g. `display: none` or not
// attached yet) — every spec repeated its own "fetch all, then throw if any are missing" block.
// This centralises that pattern with a single descriptive error naming every missing key at once.
type BoundingBox = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>

export async function requireBoundingBoxes<T extends Record<string, Locator>>(
  locators: T,
): Promise<{ [K in keyof T]: BoundingBox }> {
  const entries = Object.entries(locators) as [keyof T, Locator][]
  const boxes = await Promise.all(entries.map(([, locator]) => locator.boundingBox()))

  const missingKeys = entries
    .filter((_, index) => boxes[index] === null)
    .map(([key]) => String(key))
  if (missingKeys.length > 0) {
    throw new Error(`missing bounding box for: ${missingKeys.join(', ')}`)
  }

  return Object.fromEntries(entries.map(([key], index) => [key, boxes[index]])) as {
    [K in keyof T]: BoundingBox
  }
}
