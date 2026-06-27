import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import {
  type ContentAcceptanceHarness,
  createContentAcceptanceHarness,
} from './content-acceptance-harness'

export type ContentTestContext = {
  readonly app: INestApplication
  readonly harness: ContentAcceptanceHarness
}

export function useContentHarness(): ContentTestContext {
  let harness: ContentAcceptanceHarness

  beforeAll(async () => {
    harness = await createContentAcceptanceHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  return {
    get app() {
      return harness.app
    },
    get harness() {
      return harness
    },
  }
}
