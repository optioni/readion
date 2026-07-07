import { z } from 'zod'
import { zodCoerceNumber } from './helpers'

const CERT_SEARCH_PROVIDERS = ['tavily'] as const
export type CertSearchProvider = (typeof CERT_SEARCH_PROVIDERS)[number]

export const CERT_SEARCH_MAX_RESULTS_DEFAULT = 8

export const certSearchEnvFragment = {
  CERT_SEARCH_PROVIDER: z.enum(CERT_SEARCH_PROVIDERS).default('tavily'),
  TAVILY_API_KEY: z.string().min(1).optional(),
  CERT_SEARCH_MAX_RESULTS: zodCoerceNumber()
    .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
    .default(CERT_SEARCH_MAX_RESULTS_DEFAULT),
}
