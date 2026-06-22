import * as http from 'node:http'
import * as net from 'node:net'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ScrapperClient } from './scrapper.client'
import { buildScrapperUrl } from './scrapper.client'
import { ScrapperError } from './scrapper.errors'
import { SCRAPPER_CLIENT, ScrapperModule } from './scrapper.module'

describe('ScrapperClient', () => {
  let stubPort: number
  let stubServer: http.Server
  let scrapper: ScrapperClient

  beforeAll(async () => {
    stubServer = http.createServer((req, res) => {
      const params = new URL(req.url ?? '/', 'http://localhost').searchParams
      const targetUrl = params.get('url') ?? ''

      if (targetUrl.includes('timeout')) {
        // Never responds — relies on client timeout
        return
      }

      if (targetUrl.includes('500')) {
        res.writeHead(500)
        res.end()
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('# Cleaned Content\n\nSome markdown text.')
      }
    })

    await new Promise<void>((resolve) => stubServer.listen(0, '127.0.0.1', resolve))
    stubPort = (stubServer.address() as net.AddressInfo).port

    process.env.SCRAPPER_URL = `http://127.0.0.1:${stubPort}`

    const moduleRef = await Test.createTestingModule({
      imports: [ScrapperModule],
    }).compile()

    scrapper = moduleRef.get<ScrapperClient>(SCRAPPER_CLIENT)
  }, 30_000)

  afterAll(() => {
    stubServer?.close()
  })

  describe('buildScrapperUrl', () => {
    it('Base URL comes from validated config', () => {
      const url = buildScrapperUrl('http://scrapper:3001', 'https://example.com/page')
      expect(url).toContain('http://scrapper:3001/')
      expect(url).toContain('url=')
      expect(url).toContain(encodeURIComponent('https://example.com/page'))
    })
  })

  describe('fetch', () => {
    it('Successful fetch returns cleaned content', async () => {
      const result = await scrapper.fetch('https://example.com/success')
      expect(result.content).toContain('Cleaned Content')
      expect(result.url).toBe('https://example.com/success')
    })

    it('Upstream error becomes a typed client error (500)', async () => {
      await expect(scrapper.fetch('https://example.com/500')).rejects.toBeInstanceOf(ScrapperError)
    })

    it('Upstream error carries the failed URL and status', async () => {
      try {
        await scrapper.fetch('https://example.com/500')
      } catch (err) {
        expect(err).toBeInstanceOf(ScrapperError)
        const scrapperErr = err as ScrapperError
        expect(scrapperErr.url).toBe('https://example.com/500')
        expect(scrapperErr.status).toBe(500)
      }
    })

    it('Timeout becomes a typed ScrapperError without a status', async () => {
      // ScrapperClient with a 50ms timeout
      const { ScrapperClient: SC } = await import('./scrapper.client')
      const shortTimeout = new SC(`http://127.0.0.1:${stubPort}`, 50)
      try {
        await shortTimeout.fetch('https://example.com/timeout')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ScrapperError)
        const scrapperErr = err as ScrapperError
        expect(scrapperErr.url).toBe('https://example.com/timeout')
        expect(scrapperErr.status).toBeUndefined()
      }
    })
  })
})
