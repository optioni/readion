export interface ValidationErrorItem {
  field: string
  message: string
}

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  errors?: ValidationErrorItem[]
}
