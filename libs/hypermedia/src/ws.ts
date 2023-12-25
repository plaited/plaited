/** Utility function for enabling hypermedia patterns */
import { isTypeOf } from '@plaited/utils'
import { DelegatedListener, delegates } from '@plaited/component/utils'
import { Trigger, BPEvent } from '@plaited/behavioral'
import { WS } from '@plaited/component-types'
import { isMessageEvent } from './utils.js'
import { createTemplate } from './fetch-html.js'
const isCloseEvent = (event: CloseEvent | Event): event is CloseEvent => event.type === 'close'

export const ws = (url: string): WS => {
  const maxRetries = 3
  let retryCount = 0
  let socket: WebSocket | undefined
  const connect = (trigger: Trigger) => {
    if (retryCount < maxRetries) {
      socket = new WebSocket(url, [])
    }
    const callback = (event: MessageEvent | Event) => {
      if (isMessageEvent(event)) {
        try {
          const message: BPEvent = JSON.parse(event.data)
          if ('type' in message && isTypeOf<string>(message.detail, 'string')) {
            const template = createTemplate(message.detail)
            trigger({ type: message.type, detail: template.content })
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error)
        }
      } else if (isCloseEvent(event)) {
        trigger({ type: `ws:${event.type}`, detail: event })
        if ([1006, 1012, 1013].indexOf(event.code) >= 0) {
          // Abnormal Closure/Service Restart/Try Again Later
          setTimeout(connect, Math.pow(2, retryCount) * 1000) // Retry the connection after a delay (e.g., exponential backoff)
        }
      } else if (event.type === 'open') {
        retryCount = 0
        trigger({ type: `ws:open`, detail: event })
      } else {
        trigger({ type: `ws:${event.type}`, detail: event })
      }
    }
    if (socket) {
      delegates.set(socket, new DelegatedListener(callback))
      // WebSocket connection opened
      socket.addEventListener('open', delegates.get(socket))
      // Handle incoming messages
      socket.addEventListener('message', delegates.get(socket))
      // Handle WebSocket errors
      socket.addEventListener('error', delegates.get(socket))
      // WebSocket connection closed
      socket.addEventListener('close', delegates.get(socket))
    }
    return () => {
      if (socket) {
        socket.close()
        socket = undefined
      }
    }
  }
  const send = (message: BPEvent) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }
  send.connect = connect
  send.type = 'ws' as const
  return send
}
