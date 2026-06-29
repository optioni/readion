export function sessionRunPath(sessionId: string): string {
  return `/sessions/${sessionId}`
}

export function mockExamRunPath(mockExamId: string): string {
  return `/mock-exams/${mockExamId}`
}

export function reviewRunPath(enrollmentId: string): string {
  return `/user-certifications/${enrollmentId}/review`
}

export function sessionStartPath(enrollmentId: string): string {
  return `/user-certifications/${enrollmentId}/session/start`
}

export function sessionSummaryPath(sessionId: string): string {
  return `/sessions/${sessionId}/summary`
}

export function progressPath(enrollmentId: string): string {
  return `/user-certifications/${enrollmentId}/progress`
}
