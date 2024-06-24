/** Utility function for enabling hypermedia patterns */
import { Trigger, Message, UseServerSentEvents } from '../types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { createTemplateElement } from '../shared/parser-utils.js'
import { isMessageEvent, isMessage } from './is-message-event.js'

export const useSSE = (url: string): UseServerSentEvents => {
  let eventSource: EventSource | undefined = new EventSource(url, { withCredentials: true })
  const connect = (trigger: Trigger, subscriber: string) => {
    const callback = (event: MessageEvent | Event) => {
      if (isMessageEvent(event)) {
        try {
          const message: Message<string> = JSON.parse(event.data)
          if (isMessage(message) && message.address === subscriber) {
            const { event } = message
            const template = createTemplateElement(event.detail ?? '')
            trigger({ type: event.type, detail: template.content })
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
