import { type Component, markRaw } from 'vue'
import ToolCardExamStrategy from '~/components/agent/ToolCardExamStrategy.vue'
import ToolCardExplanation from '~/components/agent/ToolCardExplanation.vue'
import ToolCardMaterial from '~/components/agent/ToolCardMaterial.vue'
import ToolCardProgress from '~/components/agent/ToolCardProgress.vue'
import ToolCardSessionHistory from '~/components/agent/ToolCardSessionHistory.vue'

// Tools that run for grounding only (semanticSearch) are intentionally absent: their
// results are internal and must never render a card — only the agent's text response shows.
export const TOOL_CARD_REGISTRY: Readonly<Record<string, Component>> = {
  getUserProgress: markRaw(ToolCardProgress),
  getSessionHistory: markRaw(ToolCardSessionHistory),
  explainAnswer: markRaw(ToolCardExplanation),
  examStrategy: markRaw(ToolCardExamStrategy),
  fetchMoreMaterial: markRaw(ToolCardMaterial),
}

export function resolveToolCard(toolName: string): Component | null {
  return TOOL_CARD_REGISTRY[toolName] ?? null
}
