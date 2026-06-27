import { z } from 'zod'
import {
  DIGEST_SEND_HOUR_DEFAULT,
  DIGEST_SEND_WEEKDAY_DEFAULT,
  EXAM_READY_THRESHOLD_DEFAULT,
  NUDGE_ACTIVITY_LULL_DAYS_DEFAULT,
  NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT,
  NUDGE_MAX_FOLLOWUPS_DEFAULT,
} from '../lifecycle-email'
import { zodCoerceNumber, zodRequiredUrl } from './helpers'

const weekday = () =>
  zodCoerceNumber().refine((n) => Number.isInteger(n) && n >= 0 && n <= 6, {
    message: 'Must be an integer between 0 and 6',
  })

const hourOfDay = () =>
  zodCoerceNumber().refine((n) => Number.isInteger(n) && n >= 0 && n <= 23, {
    message: 'Must be an integer between 0 and 23',
  })

const positiveIntDays = () =>
  zodCoerceNumber().refine((n) => Number.isInteger(n) && n > 0, {
    message: 'Must be a positive integer',
  })

export const lifecycleEmailSharedEnvFragment = {
  DIGEST_SEND_WEEKDAY: weekday().default(DIGEST_SEND_WEEKDAY_DEFAULT),
  DIGEST_SEND_HOUR: hourOfDay().default(DIGEST_SEND_HOUR_DEFAULT),
  NUDGE_ACTIVITY_LULL_DAYS: positiveIntDays().default(NUDGE_ACTIVITY_LULL_DAYS_DEFAULT),
  INTERNAL_API_SECRET: z.string().min(1),
}

export const lifecycleEmailApiEnvFragment = {
  ...lifecycleEmailSharedEnvFragment,
  EXAM_READY_THRESHOLD: zodCoerceNumber()
    .refine((n) => n >= 0 && n <= 100, { message: 'Must be between 0 and 100' })
    .default(EXAM_READY_THRESHOLD_DEFAULT),
  NUDGE_FOLLOWUP_DELAY_DAYS: positiveIntDays().default(NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT),
  NUDGE_MAX_FOLLOWUPS: zodCoerceNumber()
    .refine((n) => Number.isInteger(n) && n >= 0, { message: 'Must be a non-negative integer' })
    .default(NUDGE_MAX_FOLLOWUPS_DEFAULT),
  PUBLIC_API_URL: zodRequiredUrl(),
}

export const lifecycleEmailWorkerEnvFragment = {
  ...lifecycleEmailSharedEnvFragment,
  INTERNAL_API_BASE_URL: zodRequiredUrl(),
}
