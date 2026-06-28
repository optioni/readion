import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'

export const ANALYTICS_ACTIVE_USERS_GAUGE = 'readion_analytics_active_users'
export const ANALYTICS_NORTHSTAR_GAIN_GAUGE = 'readion_analytics_northstar_gain'

// Two gauges set whenever the admin overview is computed, so the active-user count and the
// north-star readiness gain are scrapable from the existing global Prometheus registry without a
// separate collection job. They reuse the registry the observability module owns.
export const analyticsGaugeProviders = [
  makeGaugeProvider({
    name: ANALYTICS_ACTIVE_USERS_GAUGE,
    help: 'Active users over the trailing analytics window, as of the last overview computation',
  }),
  makeGaugeProvider({
    name: ANALYTICS_NORTHSTAR_GAIN_GAUGE,
    help: 'Median per-user readiness gain (north-star), as of the last overview computation',
  }),
]
