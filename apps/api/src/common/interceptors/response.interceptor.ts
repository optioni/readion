import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { CollectionMeta } from '@readion/shared'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface CollectionResult<T> {
  items: T[]
  meta: CollectionMeta
}

export const SKIP_ENVELOPE_KEY = 'skipEnvelope'
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true)

export function isEnveloped(value: unknown): value is { data: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value
}

export function isCollectionResult<T>(value: unknown): value is CollectionResult<T> {
  if (typeof value !== 'object' || value === null) return false
  if ('data' in value) return false
  return 'items' in value && Array.isArray((value as CollectionResult<T>).items) && 'meta' in value
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (skip) return next.handle()

    return next.handle().pipe(
      map((value) => {
        if (isEnveloped(value)) return value
        if (isCollectionResult(value)) {
          return { data: value.items, meta: value.meta }
        }
        return { data: value }
      }),
    )
  }
}
