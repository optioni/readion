import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLlmCostHarness, type LlmCostHarness } from './test/analytics-llm-cost-harness'

// Integration coverage for the ESTIMATED LLM-cost-per-active-user proxy against a seeded Postgres
// population. Seeded artifact counts (quiz responses, mock-exam question counts, session-item
// generations, assistant/tool agent messages) for two active users produce a deterministic
// per-active-user estimate against the configured default coefficients. Inactive-user artifacts
// and an out-of-window quiz response are excluded.
describe('AnalyticsService LLM-cost-per-active-user proxy (integration)', () => {
  let harness: LlmCostHarness

  beforeAll(async () => {
    harness = await createLlmCostHarness()
  }, 180_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('estimates the coefficient-weighted artifact cost per active user, excluding inactive and out-of-window artifacts', async () => {
    const estimate = await harness.service.getLlmCostPerActiveUser()
    expect(estimate).toBeCloseTo(harness.expectations.estimate)
  })
})
