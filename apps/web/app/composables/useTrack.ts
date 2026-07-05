type ScalarProp = string | number | boolean

// Events that carry props. Every value is a non-PII scalar — never an email, display name, or
// other free-text identifying field. Adding an event with props here is the only way to pass props.
export type EventPropsMap = {
  cert_enrolled: { certId: string }
  diagnostic_started: { enrollmentId: string }
  diagnostic_skipped: { enrollmentId: string }
  session_started: { enrollmentId: string; resumed: boolean }
  quiz_answer_submitted: { correct: boolean }
  session_completed: { itemCount: number }
  mock_exam_started: { enrollmentId: string }
  mock_exam_submitted: { auto: boolean }
  agent_chat_opened: { standalone: boolean }
  agent_message_sent: { inSession: boolean }
  progress_viewed: { enrollmentId: string }
  review_started: { enrollmentId: string }
}

type ProplessEvent =
  | 'sign_up'
  | 'log_in'
  | 'log_out'
  | 'email_verified'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'onboarding_started'
  | 'go_deeper_used'
  | 'quiz_explanation_generated'
  | 'quiz_question_reported'
  | 'session_ended'
  | 'drill_started'
  | 'agent_new_chat'

export type TrackEvent = keyof EventPropsMap | ProplessEvent

type TrackArgs<E extends TrackEvent> = E extends keyof EventPropsMap
  ? [props: EventPropsMap[E]]
  : []

type UmamiApi = {
  track: (event: string, props?: Record<string, ScalarProp>) => void
  identify: (data: Record<string, ScalarProp>) => void
}

function getUmami(): UmamiApi | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { umami?: UmamiApi }).umami
}

export function useTrack() {
  function track<E extends TrackEvent>(event: E, ...args: TrackArgs<E>): void {
    getUmami()?.track(event, args[0])
  }

  function identify(userId: string): void {
    getUmami()?.identify({ userId })
  }

  return { track, identify }
}
