export const AGENT_SUGGESTIONS = [
  "What's the difference between TCP and UDP?",
  'Explain eventual consistency in plain language',
  'How does TLS handshake work?',
  'When would I use a queue vs a topic?',
] as const

export const AGENT_COPY = {
  headerTitle: 'Study assistant',
  emptyHeading: 'Study assistant',
  emptyIntro:
    'Ask me anything — concepts, explanations, analogies. No exam corpus attached here; answers from general knowledge only.',
  suggestionsLabel: 'Suggestions',
  headerSubtitle: 'General knowledge · no session context',
  inputFooter: 'Answers from general knowledge only · no exam-specific tools attached',
} as const
