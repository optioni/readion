import type { MockExamResponse } from '@readion/shared'

export type MockExamScene = 'preparing' | 'active' | 'results'

export function selectMockExamScene(
  exam: Pick<MockExamResponse, 'generation' | 'status'>,
): MockExamScene {
  if (exam.generation === 'preparing') {
    return 'preparing'
  }
  return exam.status === 'in_progress' ? 'active' : 'results'
}
