import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadApiEnvFile } from './env-file'

const savedEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
}
const savedCwd = process.cwd()

describe('loadApiEnvFile', () => {
  afterEach(() => {
    process.chdir(savedCwd)

    if (savedEnv.DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = savedEnv.DATABASE_URL
    }

    if (savedEnv.REDIS_URL === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = savedEnv.REDIS_URL
    }
  })

  it('loads apps/api/.env before bootstrap validation reads process.env', () => {
    delete process.env.DATABASE_URL
    delete process.env.REDIS_URL

    const root = mkdtempSync(join(tmpdir(), 'readion-api-env-'))
    writeFileSync(
      join(root, 'apps-api.env'),
      [
        'DATABASE_URL=postgresql://readion:readion@localhost:5432/readion',
        'REDIS_URL=redis://localhost:6379',
      ].join('\n'),
    )

    try {
      loadApiEnvFile(join(root, 'apps-api.env'))
      expect(process.env.DATABASE_URL).toBe('postgresql://readion:readion@localhost:5432/readion')
      expect(process.env.REDIS_URL).toBe('redis://localhost:6379')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('loads .env from the package cwd used by yarn workspace scripts', () => {
    delete process.env.DATABASE_URL
    delete process.env.REDIS_URL

    const apiRoot = mkdtempSync(join(tmpdir(), 'readion-api-cwd-'))
    writeFileSync(
      join(apiRoot, '.env'),
      [
        'DATABASE_URL=postgresql://readion:readion@localhost:5432/readion',
        'REDIS_URL=redis://localhost:6379',
      ].join('\n'),
    )

    try {
      process.chdir(apiRoot)
      loadApiEnvFile()
      expect(process.env.DATABASE_URL).toBe('postgresql://readion:readion@localhost:5432/readion')
      expect(process.env.REDIS_URL).toBe('redis://localhost:6379')
    } finally {
      rmSync(apiRoot, { recursive: true, force: true })
    }
  })
})
