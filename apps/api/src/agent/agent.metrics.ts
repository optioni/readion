import { makeCounterProvider } from '@willsoto/nestjs-prometheus'

export const AGENT_TURNS_METRIC = 'readion_agent_turns_total'

export function agentMetricProviders() {
  return [
    makeCounterProvider({
      name: AGENT_TURNS_METRIC,
      help: 'Agent conversation turn outcomes',
      labelNames: ['outcome'],
    }),
  ]
}
