import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  type SystemPromptCertification,
  type SystemPromptReadiness,
  type SystemPromptWeakArea,
} from './system-prompt.builder'

const certification: SystemPromptCertification = {
  name: 'AWS Certified Solutions Architect - Associate',
  provider: 'Amazon Web Services',
  code: 'SAA-C03',
  domains: [
    { name: 'Design Secure Architectures', weight: 0.3 },
    { name: 'Design Resilient Architectures', weight: 0.26 },
    { name: 'Design High-Performing Architectures', weight: 0.24 },
    { name: 'Design Cost-Optimized Architectures', weight: 0.2 },
  ],
  questionCount: 65,
  passingScore: 720,
  timeLimitMinutes: 130,
}

const weakAreas: SystemPromptWeakArea[] = [
  { domain: 'Networking', score: 0.21, accuracy: 0.3, meanConfidence: 0.4, responseCount: 12 },
  { domain: 'Security', score: 0.34, accuracy: 0.45, meanConfidence: 0.5, responseCount: 9 },
  { domain: 'Storage', score: 0.41, accuracy: 0.5, meanConfidence: 0.55, responseCount: 8 },
  { domain: 'Compute', score: 0.52, accuracy: 0.6, meanConfidence: 0.6, responseCount: 7 },
  { domain: 'Databases', score: 0.6, accuracy: 0.65, meanConfidence: 0.7, responseCount: 6 },
  { domain: 'Monitoring', score: 0.71, accuracy: 0.75, meanConfidence: 0.8, responseCount: 5 },
]

const readiness: SystemPromptReadiness = { calibrated: true, score: 0.58 }

const collectText = (messages: ModelMessage[]): string =>
  messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n\n')

describe('buildSystemPrompt', () => {
  describe('in-session mode', () => {
    const build = () =>
      buildSystemPrompt(
        {
          mode: 'in_session',
          certification,
          weakAreas,
          readiness,
          sessionFocus: { mode: 'domains', domains: ['Networking', 'Security'] },
        },
        'anthropic',
      )

    it('returns only system-role messages', () => {
      const messages = build()
      expect(messages.length).toBeGreaterThan(0)
      for (const message of messages) {
        expect(message.role).toBe('system')
      }
    })

    it('static layer includes certification name, provider and exam format', () => {
      const text = collectText(build())
      expect(text).toContain('AWS Certified Solutions Architect - Associate')
      expect(text).toContain('Amazon Web Services')
      expect(text).toContain('65')
      expect(text).toContain('720')
      expect(text).toContain('130')
    })

    it('static layer includes every domain with its weight', () => {
      const text = collectText(build())
      for (const domain of certification.domains) {
        expect(text).toContain(domain.name)
        expect(text).toContain(`${Math.round(domain.weight * 100)}%`)
      }
    })

    it('static layer includes exam-strategy guidance', () => {
      const text = collectText(build()).toLowerCase()
      expect(text).toContain('strategy')
    })

    it('includes the grounding and abstention contract', () => {
      const text = collectText(build())
      expect(text.toLowerCase()).toContain('retrieved context')
      expect(text).toContain("I don't have enough material on that")
      expect(text).toContain('fetchMoreMaterial')
    })

    it('semi-static layer includes only the top-5 weakest areas with scores', () => {
      const text = collectText(build())
      for (const area of weakAreas.slice(0, 5)) {
        expect(text).toContain(area.domain)
      }
      expect(text).not.toContain('Monitoring')
    })

    it('semi-static layer includes the readiness score', () => {
      const text = collectText(build())
      expect(text).toContain('58%')
    })

    it('describes readiness as not yet calibrated when score is null', () => {
      const text = collectText(
        buildSystemPrompt(
          {
            mode: 'in_session',
            certification,
            weakAreas,
            readiness: { calibrated: false, score: null },
            sessionFocus: { mode: 'auto' },
          },
          'anthropic',
        ),
      )
      expect(text.toLowerCase()).toContain('not yet calibrated')
    })

    it('semi-static layer reflects the active-session domain focus', () => {
      const text = collectText(build())
      expect(text).toContain('Networking')
      expect(text).toContain('Security')
    })

    it('applies anthropic cache-control to the stable prefix', () => {
      const messages = build()
      for (const message of messages) {
        expect(message.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
      }
    })

    it('omits cache-control for providers without prompt caching', () => {
      const messages = buildSystemPrompt(
        {
          mode: 'in_session',
          certification,
          weakAreas,
          readiness,
          sessionFocus: { mode: 'auto' },
        },
        'openai',
      )
      for (const message of messages) {
        expect(message.providerOptions?.anthropic).toBeUndefined()
      }
    })
  })

  describe('standalone mode', () => {
    const build = () => buildSystemPrompt({ mode: 'standalone' }, 'anthropic')

    it('returns a single minimal general-tutor system message', () => {
      const messages = build()
      expect(messages).toHaveLength(1)
      expect(messages[0]?.role).toBe('system')
    })

    it('contains no certification or weak-area context', () => {
      const text = collectText(build())
      expect(text).not.toContain('AWS Certified Solutions Architect - Associate')
      expect(text).not.toContain('Networking')
      expect(text.toLowerCase()).not.toContain('exam format')
      expect(text.toLowerCase()).not.toContain('cite')
    })

    it('carries no cache-control breakpoint', () => {
      const messages = build()
      expect(messages[0]?.providerOptions?.anthropic).toBeUndefined()
    })
  })
})
