/** Utility function for enabling hypermedia patterns */
import { Trigger, UseServerSentEvents, BPEvent } from '../types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { createTemplateElement } from '../shared/parser-utils.js'
import { isBPEvent } from './is-bp-event.js'

export const useSSE: UseServerSentEvents = (url, eventSourceInitDict) => {
  let eventSource: EventSource | undefined = new EventSource(url, eventSourceInitDict)
  const connect = (trigger: Trigger, address: string) => {
    const callback = (event: MessageEvent) => {
      if (event.type === address) {
        try {
          const evt: BPEvent<string> = JSON.parse(event.data)
          if (isBPEvent(evt)) {
            const template = createTemplateElement(evt.detail ?? '')
            trigger({ type: evt.type, detail: template.content })
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error)
        }
      }
      if (event.type === 'error') {
        console.error('Server-sent event error: ', event)
      }
    }
    if (eventSource) {
      delegates.set(eventSource, new DelegatedListener(callback))
      // SSE connection opened
      eventSource.addEventListener('open', delegates.get(eventSource))
      // Handle incoming messages
      eventSource.addEventListener(address, delegates.get(eventSource))
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
