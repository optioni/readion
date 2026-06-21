import {
  AGENT_LIMIT_DEFAULT,
  AGENT_TTL_DEFAULT,
  AUTH_LIMIT_DEFAULT,
  AUTH_TTL_DEFAULT,
  GENERAL_LIMIT_DEFAULT,
  GENERAL_TTL_DEFAULT,
} from '../config/env.schema'

export const THROTTLER_DEFAULTS = {
  AUTH_LIMIT: AUTH_LIMIT_DEFAULT,
  AUTH_TTL: AUTH_TTL_DEFAULT,
  AGENT_LIMIT: AGENT_LIMIT_DEFAULT,
  AGENT_TTL: AGENT_TTL_DEFAULT,
  GENERAL_LIMIT: GENERAL_LIMIT_DEFAULT,
  GENERAL_TTL: GENERAL_TTL_DEFAULT,
} as const

interface ThrottlerConfig {
  THROTTLER_AUTH_LIMIT: number
  THROTTLER_AUTH_TTL: number
  THROTTLER_AGENT_LIMIT: number
  THROTTLER_AGENT_TTL: number
  THROTTLER_GENERAL_LIMIT: number
  THROTTLER_GENERAL_TTL: number
}

interface ThrottlerTier {
  name: string
  ttl: number
  limit: number
}

interface ThrottlerOptions {
  throttlers: ThrottlerTier[]
}

export function buildThrottlerOptions(config: ThrottlerConfig): ThrottlerOptions {
  return {
    throttlers: [
      { name: 'auth', ttl: config.THROTTLER_AUTH_TTL, limit: config.THROTTLER_AUTH_LIMIT },
      { name: 'agent', ttl: config.THROTTLER_AGENT_TTL, limit: config.THROTTLER_AGENT_LIMIT },
      {
        name: 'general',
        ttl: config.THROTTLER_GENERAL_TTL,
        limit: config.THROTTLER_GENERAL_LIMIT,
      },
    ],
  }
}
