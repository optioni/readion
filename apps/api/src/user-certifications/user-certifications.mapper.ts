import type { UserCertification } from '@readion/db'
import type { EnrollmentResponse } from '@readion/shared'

export function mapUserCertificationToDto(enrollment: UserCertification): EnrollmentResponse {
  return {
    id: enrollment.id,
    certificationId: enrollment.certification.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    sessionDefaults: {
      duration: enrollment.sessionOverrideDuration,
      contentMix: enrollment.sessionOverrideContentMix,
      difficulty: enrollment.sessionOverrideDifficulty,
      focusArea: enrollment.sessionOverrideFocusArea,
      learningStyle: enrollment.sessionOverrideLearningStyle,
    },
  }
}
