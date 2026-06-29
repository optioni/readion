export const mockExamQueryKeys = {
  detail: (mockExamId: string) => ['mock-exam', 'detail', mockExamId] as const,
  summary: (mockExamId: string) => ['mock-exam', 'summary', mockExamId] as const,
}
