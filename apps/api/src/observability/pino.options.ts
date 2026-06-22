import type { IncomingMessage, ServerResponse } from 'node:http'

const REDACTED_VALUE = '[Redacted]'

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.secret',
]

export function pinoHttpOptions(extraOptions: Record<string, unknown> = {}) {
  return {
    redact: {
      paths: REDACT_PATHS,
      censor: REDACTED_VALUE,
    },
    genReqId(req: IncomingMessage, res: ServerResponse): string {
      const existing = req.headers['x-request-id']
      const id = typeof existing === 'string' && existing ? existing : crypto.randomUUID()
      res.setHeader('x-request-id', id)
      return id
    },
    ...extraOptions,
  }
}
