export const sessionViewQueryKeys = {
  sessionDetail: (sessionId: string) => ['session-view', 'session', sessionId] as const,
  sessionSummary: (sessionId: string) => ['session-view', 'summary', sessionId] as const,
  agentConversation: (conversationId: string) =>
    ['session-view', 'agent-conversation', conversationId] as const,
}
