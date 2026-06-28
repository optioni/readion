import { describe, expect, it } from 'vitest'
import { sessionViewQueryKeys } from '~/composables/sessionViewQueryKeys'

describe('sessionViewQueryKeys', () => {
  it('builds the session-detail key from a session id', () => {
    expect(sessionViewQueryKeys.sessionDetail('sess-1')).toEqual([
      'session-view',
      'session',
      'sess-1',
    ])
  })

  it('builds the session-summary key from a session id', () => {
    expect(sessionViewQueryKeys.sessionSummary('sess-1')).toEqual([
      'session-view',
      'summary',
      'sess-1',
    ])
  })

  it('builds the agent-conversation key from a conversation id', () => {
    expect(sessionViewQueryKeys.agentConversation('conv-1')).toEqual([
      'session-view',
      'agent-conversation',
      'conv-1',
    ])
  })
})
