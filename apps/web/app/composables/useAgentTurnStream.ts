import { getCsrfTokenFromCookie } from '~/api/mutator'

export type AgentStreamEvent = { type: string; [key: string]: unknown }

export const AGENT_STREAM_DONE = '[DONE]'

const DATA_PREFIX = 'data:'

export function extractTextDelta(event: AgentStreamEvent): string | null {
  // The live Vercel AI SDK (v6) emits `text`; the e2e fixture emits `textDelta`. Support both.
  if (typeof event.text === 'string') {
    return event.text
  }
  if (typeof event.textDelta === 'string') {
    return event.textDelta
  }
  return null
}

export async function readAgentTurnStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })

    const segments = buffer.split('\n\n')
    buffer = segments.pop() ?? ''

    for (const segment of segments) {
      const line = segment.trim()
      if (!line.startsWith(DATA_PREFIX)) {
        continue
      }
      const payload = line.slice(DATA_PREFIX.length).trim()
      if (payload === AGENT_STREAM_DONE) {
        return
      }
      onEvent(JSON.parse(payload) as AgentStreamEvent)
    }
  }
}

export type StreamTurnOptions = {
  apiBaseUrl?: string
  accessToken?: string | null
  csrfToken?: string | null
  fetchImpl?: typeof fetch
}

function resolveApiBaseUrl(override?: string): string {
  if (override) {
    return override
  }
  return useRuntimeConfig().public.apiBaseUrl
}

async function resolveAccessToken(override?: string | null): Promise<string | null> {
  if (override !== undefined) {
    return override
  }
  const { useAuthStore } = await import('~/stores/auth')
  return useAuthStore().accessToken
}

export function useAgentTurnStream() {
  async function streamTurn(
    conversationId: string,
    content: string,
    onEvent: (event: AgentStreamEvent) => void,
    options: StreamTurnOptions = {},
  ): Promise<void> {
    const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl).replace(/\/$/, '')
    const accessToken = await resolveAccessToken(options.accessToken)
    const csrfToken = options.csrfToken ?? getCsrfTokenFromCookie()
    const doFetch = options.fetchImpl ?? fetch

    const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' })
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken)
    }

    const response = await doFetch(
      `${apiBaseUrl}/api/v1/agent-conversations/${conversationId}/messages`,
      {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ content }),
      },
    )

    if (!response.ok || !response.body) {
      onEvent({ type: 'error', error: `Agent request failed (${response.status})` })
      return
    }

    await readAgentTurnStream(response.body.getReader(), onEvent)
  }

  return { streamTurn }
}
