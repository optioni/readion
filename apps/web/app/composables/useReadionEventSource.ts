import { type MaybeRefOrGetter, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'

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

// `path` may be reactive: an empty resolved path opens nothing (the stream target is not known yet),
// and a change re-opens against the new path. This lets a caller whose job id arrives asynchronously
// (e.g. the re-verification flow) subscribe once the id is known, while a static string path opens
// immediately.
export const useReadionEventSource = <TPayload>(
  path: MaybeRefOrGetter<string>,
  options: ReadionEventSourceOptions = {},
) => {
  const latestMessage = ref<ReadionStreamMessage<TPayload>>()
  const status = ref<ReadionEventSourceStatus>('closed')
  const source = shallowRef<EventSource>()
  const apiBaseUrl = options.apiBaseUrl ?? getRuntimeApiBaseUrl()

  const close = () => {
    source.value?.close()
    source.value = undefined
    status.value = 'closed'
  }

  const open = (resolvedPath: string) => {
    if (typeof EventSource === 'undefined' || !apiBaseUrl || !resolvedPath) {
      return
    }

    source.value = new EventSource(createReadionEventSourceUrl(apiBaseUrl, resolvedPath), {
      withCredentials: true,
    })
    status.value = 'open'

    source.value.addEventListener('message', (event) => {
      latestMessage.value = JSON.parse(event.data) as ReadionStreamMessage<TPayload>
    })
  }

  watch(
    () => toValue(path),
    (resolvedPath) => {
      close()
      open(resolvedPath)
    },
    { immediate: true },
  )

  onScopeDispose(close)

  return {
    close,
    latestMessage,
    source,
    status,
  }
}
