import type { Page } from '@playwright/test'

export type RecordedEvent = { event: string; props?: Record<string, unknown> }

// Installs a recording `window.umami` before any app code runs and fulfils the tracker script
// request with an inert body, so the real analytics host is never contacted and every track()/
// identify() call is captured for assertion. The plugin still injects the <script> element, which
// proves the tracker is wired for automatic page-view collection.
export async function installUmamiRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const events: RecordedEvent[] = []
    const identifies: Record<string, unknown>[] = []
    const w = window as unknown as {
      umami: {
        track: (e: string, p?: Record<string, unknown>) => void
        identify: (d: Record<string, unknown>) => void
      }
      __umamiEvents: RecordedEvent[]
      __umamiIdentify: Record<string, unknown>[]
    }
    w.__umamiEvents = events
    w.__umamiIdentify = identifies
    w.umami = {
      track: (event, props) => {
        events.push({ event, props })
      },
      identify: (data) => {
        identifies.push(data)
      },
    }
  })

  await page.route('**/script.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* umami stub */' }),
  )
}

export function readUmamiEvents(page: Page): Promise<RecordedEvent[]> {
  return page.evaluate(
    () => (window as unknown as { __umamiEvents: RecordedEvent[] }).__umamiEvents,
  )
}

export function readUmamiIdentify(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    () => (window as unknown as { __umamiIdentify: Record<string, unknown>[] }).__umamiIdentify,
  )
}

export function umamiScriptCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('script[data-website-id]').length)
}
