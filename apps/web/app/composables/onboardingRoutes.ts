// Placeholder navigation targets for routes owned by changes that have not landed yet.
// Reconcile these when `web-admin` (cert setup) and `web-mock-exam` (runner) ship.
export const ADMIN_CERT_SETUP_ROUTE = '/admin/certifications'

export const onboardingMockExamRunPath = (attemptId: string) => `/mock-exams/${attemptId}`
