import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import {
  createReadionEventSourceUrl,
  useReadionEventSource,
} from '~/composables/useReadionEventSource'

type MessageHandler = (event: MessageEvent<string>) => void

class FakeEventSource {
  static instances: FakeEventSource[] = []
  handlers = new Map<string, MessageHandler[]>()
  readyState: number = EventSource.OPEN
  closed = false

  constructor(
    readonly url: string,
    readonly init?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) ?? []
    handlers.push(handler)
    this.handlers.set(type, handlers)
  }

  close() {
    this.closed = true
    this.readyState = EventSource.CLOSED
  }

  emit(type: string, data: string) {
    if (this.closed) {
      return
    }

    for (const handler of this.handlers.get(type) ?? []) {
      handler(new MessageEvent(type, { data }))
    }
  }
}

describe('useReadionEventSource', () => {
  const originalEventSource = globalThis.EventSource

  afterEach(() => {
    FakeEventSource.instances = []
    globalThis.EventSource = originalEventSource
    vi.unstubAllGlobals()
  })

  it('normalizes runtime-config URLs for relative stream paths', () => {
    expect(createReadionEventSourceUrl('http://localhost:3001/api/v1/', 'agent/events')).toBe(
      'http://localhost:3001/api/v1/agent/events',
    )
  })

  it('tracks latest message data and closes on unmount', async () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource

    const Probe = defineComponent({
      setup() {
        return useReadionEventSource<{ token: string }>('/agent/events', {
          apiBaseUrl: 'http://localhost:3001/api/v1',
        })
      },
      template: '<span>{{ status }}:{{ latestMessage?.token }}</span>',
    })

    const wrapper = mount(Probe)
    const source = FakeEventSource.instances[0]

    expect(source).toBeDefined()
    if (!source) {
      throw new Error('EventSource was not constructed')
    }

    expect(source.url).toBe('http://localhost:3001/api/v1/agent/events')
    expect(source.init?.withCredentials).toBe(true)
    expect(wrapper.text()).toBe('open:')

    source.emit('message', JSON.stringify({ token: 'first' }))
    source.emit('message', JSON.stringify({ token: 'second' }))
    await nextTick()

    expect(wrapper.text()).toBe('open:second')

    wrapper.unmount()
    expect(source.closed).toBe(true)

    source.emit('message', JSON.stringify({ token: 'ignored' }))
    await nextTick()
    expect(wrapper.text()).toBe('open:second')
  })

  it('uses runtime config when no API base URL override is supplied', () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        apiBaseUrl: 'http://localhost:3001/api/v1',
      },
    }))

    const Probe = defineComponent({
      setup() {
        return useReadionEventSource<{ token: string }>('agent/events')
      },
      template: '<span>{{ status }}</span>',
    })

    const wrapper = mount(Probe)
    const source = FakeEventSource.instances[0]

    expect(source).toBeDefined()
    if (!source) {
      throw new Error('EventSource was not constructed')
    }

    expect(source.url).toBe('http://localhost:3001/api/v1/agent/events')

    wrapper.unmount()
  })
})
