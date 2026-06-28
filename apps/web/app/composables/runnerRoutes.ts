export function sessionRunPath(sessionId: string): string {
  return `/sessions/${sessionId}`
}

export function mockExamRunPath(mockExamId: string): string {
  return `/mock-exams/${mockExamId}`
}

export function reviewRunPath(enrollmentId: string): string {
  return `/user-certifications/${enrollmentId}/review`
}
