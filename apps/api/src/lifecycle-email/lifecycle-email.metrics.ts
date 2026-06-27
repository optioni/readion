import { Module } from '@nestjs/common'
import { makeCounterProvider } from '@willsoto/nestjs-prometheus'

export const LIFECYCLE_EMAILS_SENT_METRIC = 'readion_lifecycle_emails_sent_total'

export type LifecycleEmailType = 'welcome' | 'digest' | 'nudge'

const lifecycleEmailsSentProvider = makeCounterProvider({
  name: LIFECYCLE_EMAILS_SENT_METRIC,
  help: 'Total lifecycle emails sent by type',
  labelNames: ['type'],
})

// A single shared provider so the counter registers against the global Prometheus
// registry exactly once, yet is injectable wherever a lifecycle email is sent
// (welcome in AuthService, digest/nudge in LifecycleEmailService).
@Module({
  providers: [lifecycleEmailsSentProvider],
  exports: [lifecycleEmailsSentProvider],
})
export class LifecycleEmailMetricsModule {}
