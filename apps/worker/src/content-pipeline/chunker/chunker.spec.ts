import { describe, expect, it } from 'vitest'
import { chunkText, deriveContentHash, normalizeText } from './chunker'

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Hello WORLD')).toBe('hello world')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello')
  })

  it('collapses multiple whitespace to a single space', () => {
    expect(normalizeText('hello   world\n\ntab\there')).toBe('hello world tab here')
  })
})

describe('deriveContentHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = deriveContentHash('hello world')
    expect(hash).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
  })

  it('produces the same hash for the same normalized text', () => {
    expect(deriveContentHash('hello world')).toBe(deriveContentHash('hello world'))
  })

  it('produces different hashes for different texts', () => {
    expect(deriveContentHash('hello world')).not.toBe(deriveContentHash('hello earth'))
  })

  it('normalizes before hashing so casing differences produce the same hash', () => {
    expect(deriveContentHash('Hello World')).toBe(deriveContentHash('hello world'))
  })
})

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkText('short text', { chunkSize: 500, overlap: 50 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('short text')
  })

  it('splits long text into ~500-token chunks', () => {
    const words = Array.from({ length: 1200 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      const wordCount = chunk.text.split(/\s+/).length
      expect(wordCount).toBeLessThanOrEqual(600)
    }
  })

  it('overlaps adjacent chunks', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 })
    expect(chunks.length).toBeGreaterThan(1)
    const firstChunkLastWords = chunks[0].text.split(' ').slice(-50).join(' ')
    const secondChunkFirstWords = chunks[1].text.split(' ').slice(0, 50).join(' ')
    expect(firstChunkLastWords).toBe(secondChunkFirstWords)
  })

  it('each chunk has a contentHash', () => {
    const chunks = chunkText('hello world foo bar', { chunkSize: 500, overlap: 50 })
    for (const chunk of chunks) {
      expect(chunk.contentHash).toHaveLength(64)
    }
  })

  it('2000-token document produces roughly 4 chunks', () => {
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`)
    const text = words.join(' ')
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 })
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(chunks.length).toBeLessThanOrEqual(6)
  })
})
