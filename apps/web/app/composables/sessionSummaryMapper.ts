import type { SessionSummaryResponse } from '@readion/shared'
import type { SessionSummaryResponseDto } from '~~/src/api/model'

export function toSummary(dto: SessionSummaryResponseDto): SessionSummaryResponse {
  const { before, after, delta } = dto.readiness
  return {
    questionsAnswered: dto.questionsAnswered,
    accuracy: dto.accuracy,
    domains: dto.domains.map((domain) => ({ domain: domain.domain, accuracy: domain.accuracy })),
    weakAreaDeltas: dto.weakAreaDeltas.map((area) => ({ domain: area.domain, delta: area.delta })),
    readiness: {
      before: before == null ? null : Number(before),
      after: after == null ? null : Number(after),
      delta: delta == null ? null : Number(delta),
    },
    strongestQuestion: dto.strongestQuestion ?? null,
    weakestQuestion: dto.weakestQuestion ?? null,
    nextFocus: dto.nextFocus ? { domain: String(dto.nextFocus.domain) } : null,
  }
}
