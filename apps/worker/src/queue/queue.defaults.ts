import type { JobsOptions } from 'bullmq'

export const DEFAULT_ATTEMPTS = 3
export const DEFAULT_BACKOFF_BASE_MS = 1_000
export const DEFAULT_REMOVE_ON_COMPLETE_COUNT = 1_000
export const DEFAULT_REMOVE_ON_FAIL_COUNT = 5_000

export type JobOptionsOverrides = Pick<
  JobsOptions,
  'attempts' | 'removeOnComplete' | 'removeOnFail'
> & {
  backoffDelayMs?: number
}

export function buildDefaultJobOptions(overrides?: JobOptionsOverrides): JobsOptions {
  return {
    attempts: overrides?.attempts ?? DEFAULT_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: overrides?.backoffDelayMs ?? DEFAULT_BACKOFF_BASE_MS,
    },
    removeOnComplete: overrides?.removeOnComplete ?? { count: DEFAULT_REMOVE_ON_COMPLETE_COUNT },
    removeOnFail: overrides?.removeOnFail ?? { count: DEFAULT_REMOVE_ON_FAIL_COUNT },
  }
}
