import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { bootstrapApp } from './bootstrap'

function makeProductionApp() {
  const registeredRoutes: string[] = []
  return {
    app: {
      get: (token: unknown) => {
        if (token === ConfigService) {
          return {
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'production'
              if (key === 'CORS_ORIGIN') return 'http://localhost:3000'
              return undefined
            },
          }
        }
        return undefined
      },
      setGlobalPrefix: vi.fn(),
      use: vi.fn(),
      enableCors: vi.fn(),
      useGlobalFilters: vi.fn(),
      useGlobalPipes: vi.fn(),
      getHttpAdapter: () => ({
        get: (path: string) => registeredRoutes.push(path),
      }),
    } as unknown as INestApplication,
    registeredRoutes,
  }
}

describe('bootstrapApp', () => {
  it('does not register /api-json in production', async () => {
    const { app, registeredRoutes } = makeProductionApp()
    await bootstrapApp(app)
    expect(registeredRoutes).not.toContain('/api-json')
  })
})
