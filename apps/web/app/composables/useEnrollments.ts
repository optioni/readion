import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'

export interface EnrollmentCard {
  enrollmentId: string
  certificationId: string
  name: string
  provider: string
  readinessScore: number | null
  enrolledAt: string
  status: string
}

export function useEnrollments() {
  const enrollmentsQuery = useQuery({
    queryKey: ['dashboard', 'enrollments', 'active'],
    queryFn: async () => {
      const response = await userCertificationsControllerList({ status: 'active' })
      return response.data.data
    },
  })

  const certificationsQuery = useQuery({
    queryKey: ['dashboard', 'certifications'],
    queryFn: async () => {
      const response = await certificationsControllerList()
      return response.data.data
    },
  })

  const cards = computed<EnrollmentCard[]>(() => {
    const enrollments = enrollmentsQuery.data.value
    if (!enrollments) {
      return []
    }

    const certifications = certificationsQuery.data.value ?? []

    return enrollments.map((enrollment) => {
      const certification = certifications.find((entry) => entry.id === enrollment.certificationId)

      return {
        enrollmentId: enrollment.id,
        certificationId: enrollment.certificationId,
        name: certification?.name ?? '',
        provider: certification?.provider ?? '',
        readinessScore: enrollment.readinessScore,
        enrolledAt: enrollment.enrolledAt,
        status: enrollment.status,
      }
    })
  })

  const isLoading = computed(
    () => enrollmentsQuery.isLoading.value || certificationsQuery.isLoading.value,
  )
  const isError = computed(
    () => enrollmentsQuery.isError.value || certificationsQuery.isError.value,
  )

  return { cards, isLoading, isError }
}
