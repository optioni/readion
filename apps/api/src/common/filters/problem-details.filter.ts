import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException } from '@nestjs/common'
import type { ProblemDetails, ValidationErrorItem } from '@readion/shared'
import { ERROR_TYPES } from '@readion/shared'
import * as Sentry from '@sentry/nestjs'

const STATUS_TO_TYPE: Record<number, string> = {
  400: ERROR_TYPES.VALIDATION,
  401: ERROR_TYPES.UNAUTHORIZED,
  403: ERROR_TYPES.FORBIDDEN,
  404: ERROR_TYPES.NOT_FOUND,
  409: ERROR_TYPES.CONFLICT,
  422: ERROR_TYPES.VALIDATION,
  429: '/errors/too-many-requests',
  500: ERROR_TYPES.INTERNAL,
}

const STATUS_TO_TITLE: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
}

function statusToType(status: number): string {
  return STATUS_TO_TYPE[status] ?? ERROR_TYPES.INTERNAL
}

function statusToTitle(status: number): string {
  return STATUS_TO_TITLE[status] ?? 'Internal Server Error'
}

function extractDetail(exception: HttpException): string {
  const res = exception.getResponse()
  if (typeof res === 'string') return res
  if (typeof res === 'object' && res !== null && 'message' in res) {
    const msg = (res as { message: unknown }).message
    return Array.isArray(msg) ? String(msg[0]) : String(msg)
  }
  return exception.message
}

function extractType(exception: HttpException): string | undefined {
  const res = exception.getResponse()
  if (typeof res === 'object' && res !== null && 'type' in res) {
    const type = (res as { type: unknown }).type
    return typeof type === 'string' ? type : undefined
  }
  return undefined
}

function extractErrors(exception: HttpException): ValidationErrorItem[] | undefined {
  const res = exception.getResponse()
  if (typeof res === 'object' && res !== null && 'errors' in res) {
    return (res as { errors: ValidationErrorItem[] }).errors
  }
  return undefined
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void }
      setHeader: (key: string, value: string) => void
    }>()

    let status = 500
    let detail = 'An unexpected error occurred'
    let errors: ValidationErrorItem[] | undefined
    let type: string | undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      detail = extractDetail(exception)
      errors = extractErrors(exception)
      type = extractType(exception)
    } else if (process.env.SENTRY_DSN) {
      Sentry.captureException(exception)
    }

    const body: ProblemDetails = {
      type: type ?? statusToType(status),
      title: statusToTitle(status),
      status,
      detail,
      ...(errors ? { errors } : {}),
    }

    response.setHeader('Content-Type', 'application/problem+json')

    if (status === 429 && exception instanceof HttpException) {
      const res = exception.getResponse()
      if (typeof res === 'object' && res !== null && 'retryAfter' in res) {
        response.setHeader('Retry-After', String((res as { retryAfter: unknown }).retryAfter))
      } else {
        response.setHeader('Retry-After', '60')
      }
    }

    response.status(status).json(body)
  }
}
