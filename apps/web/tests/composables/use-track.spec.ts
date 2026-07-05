import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTrack } from '~/composables/useTrack'

type UmamiStub = { track: ReturnType<typeof vi.fn>; identify: ReturnType<typeof vi.fn> }

function installUmami(): UmamiStub {
  const stub: UmamiStub = { track: vi.fn(), identify: vi.fn() }
  ;(window as unknown as { umami: UmamiStub }).umami = stub
  return stub
}

describe('useTrack', () => {
  beforeEach(() => {
    ;(window as unknown as { umami?: unknown }).umami = undefined
  })

  afterEach(() => {
    ;(window as unknown as { umami?: unknown }).umami = undefined
  })

  it('forwards event and props to window.umami.track when present', () => {
    const umami = installUmami()
    const { track } = useTrack()

    track('session_started', { enrollmentId: 'e1', resumed: false })

    expect(umami.track).toHaveBeenCalledTimes(1)
    expect(umami.track).toHaveBeenCalledWith('session_started', {
      enrollmentId: 'e1',
      resumed: false,
    })
  })

  it('forwards a propless event with no props argument', () => {
    const umami = installUmami()
    const { track } = useTrack()

    track('log_in')

    expect(umami.track).toHaveBeenCalledWith('log_in', undefined)
  })

  it('is a safe no-op when window.umami is undefined', () => {
    const { track } = useTrack()
    expect(() => track('log_in')).not.toThrow()
  })

  it('identify sends only the userId — never email or other PII', () => {
    const umami = installUmami()
    const { identify } = useTrack()

    identify('11111111-1111-1111-1111-111111111111')

    expect(umami.identify).toHaveBeenCalledWith({ userId: '11111111-1111-1111-1111-111111111111' })
    const payload = umami.identify.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(['userId'])
  })

  it('identify is a safe no-op when the tracker is absent', () => {
    const { identify } = useTrack()
    expect(() => identify('some-id')).not.toThrow()
  })

  it('rejects an unknown event name at compile time', () => {
    const umami = installUmami()
    const { track } = useTrack()

    // @ts-expect-error 'not_a_real_event' is not a member of TrackEvent
    track('not_a_real_event')

    // The call still runs at runtime; the guarantee under test is the compile-time rejection above.
    expect(umami.track).toHaveBeenCalled()
  })

  it('requires typed props for events that declare them', () => {
    const umami = installUmami()
    const { track } = useTrack()

    // @ts-expect-error cert_enrolled requires { certId: string }
    track('cert_enrolled')

    expect(umami.track).toHaveBeenCalled()
  })
})
