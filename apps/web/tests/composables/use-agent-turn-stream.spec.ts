import { describe, expect, it, vi } from 'vitest'
import {
  type AgentStreamEvent,
  extractTextDelta,
  readAgentTurnStream,
  useAgentTurnStream,
} from '~/composables/useAgentTurnStream'

function readerFromChunks(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return {
    read() {
      if (index < chunks.length) {
        const chunk = chunks[index++] ?? ''
        return Promise.resolve({ done: false, value: encoder.encode(chunk) })
      }
      return Promise.resolve({ done: true, value: undefined })
    },
    releaseLock() {},
    cancel() {
      return Promise.resolve()
    },
  } as unknown as ReadableStreamDefaultReader<Uint8Array>
}

async function collect(chunks: string[]): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = []
  await readAgentTurnStream(readerFromChunks(chunks), (event) => events.push(event))
  return events
}

describe('extractTextDelta', () => {
  it('reads the AI SDK `text` field', () => {
    expect(extractTextDelta({ type: 'text-delta', text: 'hello' })).toBe('hello')
  })

  it('reads the e2e fixture `textDelta` field', () => {
    expect(extractTextDelta({ type: 'text-delta', textDelta: 'world' })).toBe('world')
  })

  it('returns null when neither field is a string', () => {
    expect(extractTextDelta({ type: 'text-delta' })).toBeNull()
    expect(extractTextDelta({ type: 'text-delta', text: 42 })).toBeNull()
  })
})

describe('readAgentTurnStream', () => {
  it('parses sequential data events until [DONE] and ignores anything after', async () => {
    const events = await collect([
      'data: {"type":"text-delta","textDelta":"Hello "}\n\n',
      'data: {"type":"text-delta","text":"world"}\n\ndata: {"type":"tool-result","toolName":"explainAnswer","output":{}}\n\n',
      'data: [DONE]\n\n',
      'data: {"type":"text-delta","text":"ignored"}\n\n',
    ])

    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({ type: 'text-delta', textDelta: 'Hello ' })
    expect(events[2]).toEqual({
      type: 'tool-result',
      toolName: 'explainAnswer',
      output: {},
    })
  })

  it('reassembles an event split across chunk boundaries', async () => {
    const events = await collect([
      'data: {"type":"text-de',
      'lta","textDelta":"Hi"}\n\n',
      'data: [DONE]\n\n',
    ])

    expect(events).toEqual([{ type: 'text-delta', textDelta: 'Hi' }])
  })

  it('forwards error and job-event parts to the consumer', async () => {
    const events = await collect([
      'data: {"type":"text-delta","textDelta":"Let me look"}\n\n',
      'data: {"type":"error","error":"upstream model timeout"}\n\n',
      'data: {"type":"job-event","jobId":"job-1","status":"completed"}\n\n',
      'data: [DONE]\n\n',
    ])

    expect(events.map((e) => e.type)).toEqual(['text-delta', 'error', 'job-event'])
    expect(events[1]).toMatchObject({ type: 'error', error: 'upstream model timeout' })
  })
})

describe('useAgentTurnStream().streamTurn', () => {
  it('POSTs the message with auth headers and streams parsed events', async () => {
    const reader = readerFromChunks([
      'data: {"type":"text-delta","textDelta":"Ok"}\n\n',
      'data: [DONE]\n\n',
    ])
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    })

    const { streamTurn } = useAgentTurnStream()
    const events: AgentStreamEvent[] = []
    await streamTurn('conv-1', 'Why SCP?', (event) => events.push(event), {
      apiBaseUrl: 'http://localhost:3001/api/v1',
      accessToken: 'token-abc',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3001/api/v1/agent-conversations/conv-1/messages')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body as string)).toEqual({ content: 'Why SCP?' })
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer token-abc')
    expect(headers.get('Content-Type')).toBe('application/json')

    expect(events).toEqual([{ type: 'text-delta', textDelta: 'Ok' }])
  })

  it('emits a synthetic error event when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, body: null })

    const { streamTurn } = useAgentTurnStream()
    const events: AgentStreamEvent[] = []
    await streamTurn('conv-1', 'hi', (event) => events.push(event), {
      apiBaseUrl: 'http://localhost:3001/api/v1',
      accessToken: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('error')
  })
})
