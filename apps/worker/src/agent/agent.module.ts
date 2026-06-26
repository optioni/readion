import { Module } from '@nestjs/common'
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus'
import { ACTIVE_STANDALONE_CONVERSATIONS_GAUGE, AgentTtlCron } from './agent-ttl.cron'

@Module({
  providers: [
    AgentTtlCron,
    makeGaugeProvider({
      name: ACTIVE_STANDALONE_CONVERSATIONS_GAUGE,
      help: 'Current number of active standalone agent conversations',
    }),
  ],
})
export class AgentWorkerModule {}
