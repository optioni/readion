import { agentControllerCreateStandalone } from '~~/src/api/agent/agent'
import type { AgentConversationDetailResponseDto } from '~~/src/api/model'

export async function createStandaloneAgentConversation(): Promise<AgentConversationDetailResponseDto> {
  const response = await agentControllerCreateStandalone()
  return response.data
}
