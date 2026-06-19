import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'

describe('Worker application context', () => {
  let moduleRef: TestingModule

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  it('boots and reaches a ready state', () => {
    expect(moduleRef).toBeDefined()
  })

  it('does not open an HTTP listener', () => {
    const app = moduleRef.createNestApplication()
    expect(app.getHttpServer()?.listening).toBeFalsy()
  })
})
