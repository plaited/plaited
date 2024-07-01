/** Utility function for enabling hypermedia patterns */
import { Trigger, BPEvent, UseSocket } from '../types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { isBPEvent } from './is-bp-event.js'

const isCloseEvent = (event: CloseEvent | Event): event is CloseEvent => event.type === 'close'

export const useSocket: UseSocket = (url, protocols) => {
  const maxRetries = 3
  let retryCount = 0
  let socket: WebSocket | undefined
  const connect = (trigger: Trigger, address: string) => {
    if (retryCount < maxRetries) {
      socket = new WebSocket(url, protocols)
    }
    const callback = (event: MessageEvent) => {
      if (event.type === address) {
        try {
          const evt: BPEvent<string> = JSON.parse(event.data)
          if (isBPEvent(evt)) {
            const tpl = document.createElement('template')
            // @ts-ignore: https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTMLUnsafe
            tpl.setHTMLUnsafe(evt.detail ?? '')
            trigger({ type: evt.type, detail: tpl.content })
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error)
        }
      }
      if (isCloseEvent(event)) {
        if ([1006, 1012, 1013].indexOf(event.code) >= 0) {
          // Abnormal Closure/Service Restart/Try Again Later
          setTimeout(connect, Math.pow(2, retryCount) * 1000) // Retry the connection after a delay (e.g., exponential backoff)
        }
      }
      if (event.type === 'open') {
        retryCount = 0
      }
      if (event.type === 'error') {
        console.error('WebSocket error: ', event)
      }
    }
    if (socket) {
      delegates.set(socket, new DelegatedListener(callback))
      // WebSocket connection opened
      socket.addEventListener('open', delegates.get(socket))
      // Handle incoming messages
      socket.addEventListener(address, delegates.get(socket))
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
  send.type = 'socket' as const
  return send
}
