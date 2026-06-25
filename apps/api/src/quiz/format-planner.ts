import { createHash } from 'node:crypto'
import type { QuestionFormat } from '@readion/shared'

export type ChunkCharacteristics = {
  id: string
  primaryDomain: string
}

export function planFormat(chunk: ChunkCharacteristics, difficulty: string): QuestionFormat {
  const hash = createHash('sha256')
    .update(`${chunk.id}:${chunk.primaryDomain}:${difficulty}`)
    .digest('hex')
  const bucket = Number.parseInt(hash.slice(0, 8), 16)

  if (difficulty === 'exam-ready') {
    const formats: QuestionFormat[] = ['multiple_choice', 'true_false', 'scenario']
    return formats[bucket % 3]!
  }

  const formats: QuestionFormat[] = ['multiple_choice', 'true_false']
  return formats[bucket % 2]!
}
