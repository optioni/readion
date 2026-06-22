import { onScopeDispose, ref, shallowRef } from 'vue'

export type ReadionEventSourceStatus = 'closed' | 'open'
export type ReadionStreamMessage<TPayload = unknown> = TPayload

type ReadionEventSourceOptions = {
  apiBaseUrl?: string
}

const getRuntimeApiBaseUrl = () => {
  if (typeof useRuntimeConfig === 'undefined') {
    return undefined
  }

  return useRuntimeConfig().public.apiBaseUrl
}

export const createReadionEventSourceUrl = (apiBaseUrl: string, path: string) => {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBaseUrl}${normalizedPath}`
}

export const useReadionEventSource = <TPayload>(
  path: string,
  options: ReadionEventSourceOptions = {},
) => {
  const latestMessage = ref<ReadionStreamMessage<TPayload>>()
  const status = ref<ReadionEventSourceStatus>('closed')
  const source = shallowRef<EventSource>()
  const apiBaseUrl = options.apiBaseUrl ?? getRuntimeApiBaseUrl()

  if (typeof EventSource !== 'undefined' && apiBaseUrl) {
    source.value = new EventSource(createReadionEventSourceUrl(apiBaseUrl, path), {
      withCredentials: true,
    })
    status.value = 'open'

    source.value.addEventListener('message', (event) => {
      latestMessage.value = JSON.parse(event.data) as ReadionStreamMessage<TPayload>
    })
  }

  const close = () => {
    source.value?.close()
    status.value = 'closed'
  }

  onScopeDispose(close)

  return {
    close,
    latestMessage,
    source,
    status,
  }
}
