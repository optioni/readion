import { type WatchSource, watch } from 'vue'

export type UmamiConfig = { host: string; websiteId: string }

export function umamiScriptSrc(host: string): string {
  return `${host.replace(/\/$/, '')}/script.js`
}

// Injects the Umami tracker exactly once. Returns false (and injects nothing) when the config is
// incomplete or the script is already present, so local dev / tests stay tracking-free by default.
export function injectUmamiScript(doc: Document, config: UmamiConfig): boolean {
  if (!config.host || !config.websiteId) return false

  const src = umamiScriptSrc(config.host)
  if (doc.querySelector(`script[src="${src}"]`)) return false

  const el = doc.createElement('script')
  el.async = true
  el.defer = true
  el.src = src
  el.setAttribute('data-website-id', config.websiteId)
  doc.head.appendChild(el)
  return true
}

// Identifies the user with their UUID only. Fires on the initial value and whenever the user
// transitions to authenticated. Never receives email or any other PII.
export function watchIdentify(
  userId: WatchSource<string | null | undefined>,
  identify: (userId: string) => void,
) {
  return watch(
    userId,
    (id) => {
      if (id) identify(id)
    },
    { immediate: true },
  )
}
