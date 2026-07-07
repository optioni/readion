import { z } from 'zod'
import { zodCoerceNumber } from './helpers'

const CERT_SEARCH_PROVIDERS = ['tavily'] as const
export type CertSearchProvider = (typeof CERT_SEARCH_PROVIDERS)[number]

export const CERT_SEARCH_MAX_RESULTS_DEFAULT = 8

export const certSearchEnvFragment = {
  CERT_SEARCH_PROVIDER: z.enum(CERT_SEARCH_PROVIDERS).default('tavily'),
  // A blank value (the shipped .env.example / k8s secret default) must read as
  // "unconfigured", not a validation error — otherwise the documented
  // inert-but-healthy deploy would fail to boot. An unset key is the same case.
  TAVILY_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  CERT_SEARCH_MAX_RESULTS: zodCoerceNumber()
    .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' })
    .default(CERT_SEARCH_MAX_RESULTS_DEFAULT),
}
