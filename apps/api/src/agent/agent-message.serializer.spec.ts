import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import {
  type AgentMessageRowData,
  buildReplayMessages,
  deserializeMessageRow,
  serializeModelMessage,
} from './agent-message.serializer'

describe('agent message serializer', () => {
  describe('serializeModelMessage', () => {
    it('serializes a user message with string content', () => {
      const message: ModelMessage = { role: 'user', content: 'How does EC2 scale?' }

      expect(serializeModelMessage(message)).toEqual({
        role: 'user',
        content: 'How does EC2 scale?',
      })
    })

    it('serializes a system message with string content', () => {
      const message: ModelMessage = { role: 'system', content: 'You are a tutor.' }

      expect(serializeModelMessage(message)).toEqual({
        role: 'system',
        content: 'You are a tutor.',
      })
    })

    it('serializes an assistant message with a content-part array', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: 'EC2 scales horizontally.' }],
      }

      expect(serializeModelMessage(message)).toEqual({
        role: 'assistant',
        content: [{ type: 'text', text: 'EC2 scales horizontally.' }],
      })
    })

    it('serializes an assistant tool-call as a content-part array row', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'getUserProgress', input: {} },
        ],
      }

      expect(serializeModelMessage(message)).toEqual({
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'getUserProgress', input: {} },
        ],
      })
    })

    it('serializes a tool-result message as a content-part array row', () => {
      const message: ModelMessage = {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getUserProgress',
            output: { type: 'json', value: { readiness: 72 } },
          },
        ],
      }

      expect(serializeModelMessage(message)).toEqual({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getUserProgress',
            output: { type: 'json', value: { readiness: 72 } },
          },
        ],
      })
    })
  })

  describe('deserializeMessageRow', () => {
    it('round-trips a user string row to a ModelMessage', () => {
      const row: AgentMessageRowData = { role: 'user', content: 'Hello' }

      expect(deserializeMessageRow(row)).toEqual({ role: 'user', content: 'Hello' })
    })

    it('round-trips a system string row to a ModelMessage', () => {
      const row: AgentMessageRowData = { role: 'system', content: 'You are a tutor.' }

      expect(deserializeMessageRow(row)).toEqual({ role: 'system', content: 'You are a tutor.' })
    })

    it('round-trips an assistant content-part array row', () => {
      const row: AgentMessageRowData = {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there.' }],
      }

      expect(deserializeMessageRow(row)).toEqual({
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there.' }],
      })
    })

    it('round-trips an assistant tool-call row', () => {
      const row: AgentMessageRowData = {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-9', toolName: 'semanticSearch', input: { q: 'x' } },
        ],
      }

      expect(deserializeMessageRow(row)).toEqual({
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-9', toolName: 'semanticSearch', input: { q: 'x' } },
        ],
      })
    })

    it('round-trips a tool-result row', () => {
      const row: AgentMessageRowData = {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-9',
            toolName: 'semanticSearch',
            output: { type: 'json', value: ['chunk-1'] },
          },
        ],
      }

      expect(deserializeMessageRow(row)).toEqual({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-9',
            toolName: 'semanticSearch',
            output: { type: 'json', value: ['chunk-1'] },
          },
        ],
      })
    })
  })

  describe('buildReplayMessages', () => {
    it('maps ordered rows to a ModelMessage array preserving order', () => {
      const rows: AgentMessageRowData[] = [
        { role: 'system', content: 'You are a tutor.' },
        { role: 'user', content: 'First question' },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'c1', toolName: 'getUserProgress', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'c1',
              toolName: 'getUserProgress',
              output: { type: 'json', value: { readiness: 60 } },
            },
          ],
        },
        { role: 'assistant', content: [{ type: 'text', text: 'Focus on Security.' }] },
        { role: 'user', content: 'Second question' },
      ]

      const replay = buildReplayMessages(rows)

      expect(replay).toHaveLength(6)
      expect(replay.map((m) => m.role)).toEqual([
        'system',
        'user',
        'assistant',
        'tool',
        'assistant',
        'user',
      ])
      expect(replay[1]).toEqual({ role: 'user', content: 'First question' })
      expect(replay[5]).toEqual({ role: 'user', content: 'Second question' })
    })

    it('returns an empty array for no rows', () => {
      expect(buildReplayMessages([])).toEqual([])
    })
  })
})
