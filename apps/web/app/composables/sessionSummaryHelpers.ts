import type { SessionResponseDto } from '~~/src/api/model'

export const isCompletedSession = (session: SessionResponseDto): boolean =>
  String(session.status) === 'completed'

export const chronologicalByStartedAt = (a: SessionResponseDto, b: SessionResponseDto): number =>
  a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0
