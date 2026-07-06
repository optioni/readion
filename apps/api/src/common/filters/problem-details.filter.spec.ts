import type { ArgumentsHost } from '@nestjs/common'
import { HttpException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { ProblemDetailsFilter } from './problem-details.filter'

function captureResponse(exception: unknown) {
  let capturedStatus: number | undefined
  let capturedBody: unknown
  const capturedHeaders: Record<string, string> = {}

  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (code: number) => {
          capturedStatus = code
          return {
            json: (body: unknown) => {
              capturedBody = body
            },
          }
        },
        setHeader: (key: string, value: string) => {
          capturedHeaders[key] = value
        },
      }),
    }),
  } as unknown as ArgumentsHost

  const filter = new ProblemDetailsFilter()
  filter.catch(exception, host)

  return { status: capturedStatus, body: capturedBody, headers: capturedHeaders }
}

describe('ProblemDetailsFilter', () => {
  it('maps NotFoundException to 404 problem-details', () => {
    const { status, body, headers } = captureResponse(
      new NotFoundException('Certification not found'),
    )
    expect(status).toBe(404)
    expect(headers['Content-Type']).toBe('application/problem+json')
    const b = body as { type: string; status: number; detail: string }
    expect(b.type).toBe('/errors/not-found')
    expect(b.status).toBe(404)
    expect(b.detail).toBe('Certification not found')
  })

  it('maps unhandled Error to 500 without leaking stack trace', () => {
    const { status, body } = captureResponse(new Error('boom'))
    expect(status).toBe(500)
    const b = body as { type: string; status: number; detail: string }
    expect(b.type).toBe('/errors/internal-server-error')
    expect(b.status).toBe(500)
    expect(b.detail).not.toMatch(/boom/)
    expect(b.detail).not.toMatch(/Error/)
  })

  it('response status equals body status', () => {
    const { status, body } = captureResponse(new NotFoundException('not found'))
    expect(status).toBe((body as { status: number }).status)
  })

  it('includes errors array for UnprocessableEntityException with errors payload', () => {
    const exception = new HttpException(
      { errors: [{ field: 'email', message: 'must not be empty' }] },
      422,
    )
    const { body } = captureResponse(exception)
    const b = body as { errors: unknown[] }
    expect(b.errors).toHaveLength(1)
  })

  it('falls back to internal-server-error type for unmapped status codes', () => {
    const exception = new HttpException('Service Unavailable', 503)
    const { status, body } = captureResponse(exception)
    expect(status).toBe(503)
    const b = body as { type: string; title: string }
    expect(b.type).toBe('/errors/internal-server-error')
    expect(b.title).toBe('Internal Server Error')
  })

  it('sets Retry-After from retryAfter field on 429 response', () => {
    const exception = new HttpException({ retryAfter: 120 }, 429)
    const { headers } = captureResponse(exception)
    expect(headers['Retry-After']).toBe('120')
  })

  it('honors a custom type on the exception response payload', () => {
    const exception = new HttpException(
      { message: 'Registration is currently disabled', type: '/errors/signups-disabled' },
      403,
    )
    const { status, body } = captureResponse(exception)
    expect(status).toBe(403)
    const b = body as { type: string; title: string; detail: string }
    expect(b.type).toBe('/errors/signups-disabled')
    expect(b.title).toBe('Forbidden')
    expect(b.detail).toBe('Registration is currently disabled')
  })
})
