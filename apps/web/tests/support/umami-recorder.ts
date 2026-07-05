import { vi } from 'vitest'

export type RecordedEvent = { event: string; props?: unknown }

export type UmamiRecorder = {
  track: ReturnType<typeof vi.fn>
  identify: ReturnType<typeof vi.fn>
  events: RecordedEvent[]
}

export function installUmamiRecorder(): UmamiRecorder {
  const events: RecordedEvent[] = []
  const track = vi.fn((event: string, props?: unknown) => {
    events.push({ event, props })
  })
  const identify = vi.fn()
  ;(window as unknown as { umami: unknown }).umami = { track, identify }
  return { track, identify, events }
}

export function clearUmamiRecorder(): void {
  ;(window as unknown as { umami?: unknown }).umami = undefined
}
