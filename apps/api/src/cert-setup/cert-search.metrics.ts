import { makeCounterProvider } from '@willsoto/nestjs-prometheus'

export const CERT_SEARCH_UNAVAILABLE_METRIC = 'readion_cert_discovery_search_unavailable_total'

export function certSearchMetricProviders() {
  return [
    makeCounterProvider({
      name: CERT_SEARCH_UNAVAILABLE_METRIC,
      help: 'Number of times cert source discovery search was unavailable (not configured or provider error)',
      labelNames: ['reason'],
    }),
  ]
}
