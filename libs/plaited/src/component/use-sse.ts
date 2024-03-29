/** Utility function for enabling hypermedia patterns */
import { isTypeOf } from '@plaited/utils'
import { Trigger, BPEvent, SSE } from '../types.js'
import { delegates, DelegatedListener } from './delegated-listener.js'
import { isMessageEvent, createTemplate } from './private-utils.js'

export const useSSE = (url: string): SSE => {
  let eventSource: EventSource | undefined = new EventSource(url, { withCredentials: true })
  const connect = (trigger: Trigger) => {
    const callback = (event: MessageEvent | Event) => {
      if (isMessageEvent(event)) {
        try {
          const message: BPEvent<string> = JSON.parse(event.data)
          if ('type' in message && isTypeOf<string>(message.detail, 'string')) {
            const template = createTemplate(message.detail)
            trigger({ type: message.type, detail: template.content })
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error)
        }
      }
    }
    if (eventSource) {
      delegates.set(eventSource, new DelegatedListener(callback))
      // SSE connection opened
      eventSource.addEventListener('open', delegates.get(eventSource))
      // Handle incoming messages
      eventSource.addEventListener('message', delegates.get(eventSource))
      // Handle SSE errors
      eventSource.addEventListener('error', delegates.get(eventSource))
    }
    return () => {
      if (eventSource) {
        eventSource.close()
        eventSource = undefined
      }
    }
  }
  connect.type = 'sse' as const
  return connect
}
