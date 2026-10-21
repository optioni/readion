import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

// /favicon.ico is requested whether or not the page links it, and favicon services (DuckDuckGo's,
// which Umami uses) read nothing else. Without a file there, Nitro answers with a text placeholder
// labelled image/x-icon, and that blank is what gets cached.

const faviconPath = resolve(__dirname, '../../public/favicon.ico')

// One 16-byte directory entry per image after the 6-byte header: byte size at 8, file offset at 12.
function icoImages(buffer: Buffer): Buffer[] {
  return Array.from({ length: buffer.readUInt16LE(4) }, (_, i) => {
    const entry = 6 + 16 * i
    const offset = buffer.readUInt32LE(entry + 12)
    return buffer.subarray(offset, offset + buffer.readUInt32LE(entry + 8))
  })
}

// Whether any pixel of an 8-bit RGBA PNG has non-zero alpha. Each scanline opens with a filter
// byte; filters never turn an all-zero image non-zero, so a transparent image reads as zero.
function pngHasVisiblePixels(png: Buffer): boolean {
  const width = png.readUInt32BE(16)
  expect(png.readUInt8(24)).toBe(8)
  expect(png.readUInt8(25)).toBe(6)
  const idat: Buffer[] = []
  for (let pos = 8; pos < png.length; ) {
    const length = png.readUInt32BE(pos)
    if (png.toString('ascii', pos + 4, pos + 8) === 'IDAT') {
      idat.push(png.subarray(pos + 8, pos + 8 + length))
    }
    pos += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = 1 + width * 4
  for (let row = 0; row < raw.length; row += stride) {
    for (let alpha = row + 4; alpha < row + stride; alpha += 4) {
      if (raw[alpha] !== 0) {
        return true
      }
    }
  }
  return false
}

describe('favicon', () => {
  it('ships a favicon.ico that draws the mark in every image', () => {
    const buffer = readFileSync(faviconPath)

    expect(buffer.readUInt16LE(0)).toBe(0)
    expect(buffer.readUInt16LE(2)).toBe(1)
    const images = icoImages(buffer)
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      expect(pngHasVisiblePixels(image)).toBe(true)
    }
  })

  it('links the SVG icon first and the favicon.ico fallback after it', async () => {
    process.env.NUXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api/v1'

    const { default: config } = await import('../../nuxt.config')
    const icons = (config.app?.head?.link ?? []).filter((link) => link && link.rel === 'icon')

    expect(icons).toEqual([
      { rel: 'icon', type: 'image/svg+xml', href: '/icons/readion.svg' },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ])
  })
})
