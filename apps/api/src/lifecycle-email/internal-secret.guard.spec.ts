import type { ExecutionContext } from '@nestjs/common'
import { UnauthorizedException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { INTERNAL_API_SECRET_HEADER, InternalSecretGuard } from './internal-secret.guard'

const EXPECTED_SECRET = 'the-real-internal-secret'

function makeGuard(): InternalSecretGuard {
  const config = {
    getOrThrow: () => EXPECTED_SECRET,
  } as unknown as ConfigService<EnvConfig>
  return new InternalSecretGuard(config)
}

function contextWithHeader(value: string | string[] | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: value === undefined ? {} : { [INTERNAL_API_SECRET_HEADER]: value },
      }),
    }),
  } as unknown as ExecutionContext
}

describe('InternalSecretGuard', () => {
  it('allows a request carrying the exact secret', () => {
    expect(makeGuard().canActivate(contextWithHeader(EXPECTED_SECRET))).toBe(true)
  })

  it('rejects a missing secret header', () => {
    expect(() => makeGuard().canActivate(contextWithHeader(undefined))).toThrow(
      UnauthorizedException,
    )
  })

  it('rejects a wrong secret of the same length', () => {
    const sameLengthWrong = 'X'.repeat(EXPECTED_SECRET.length)
    expect(() => makeGuard().canActivate(contextWithHeader(sameLengthWrong))).toThrow(
      UnauthorizedException,
    )
  })

  it('rejects a wrong secret of a different length without leaking length via an early return', () => {
    expect(() => makeGuard().canActivate(contextWithHeader('short'))).toThrow(UnauthorizedException)
    expect(() =>
      makeGuard().canActivate(contextWithHeader(`${EXPECTED_SECRET}-with-extra-bytes`)),
    ).toThrow(UnauthorizedException)
  })

  it('rejects an array-valued header', () => {
    expect(() => makeGuard().canActivate(contextWithHeader([EXPECTED_SECRET]))).toThrow(
      UnauthorizedException,
    )
  })
})
