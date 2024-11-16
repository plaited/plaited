import { isTypeOf } from '../utils/is-type-of.js'
import type { PlaitedMessage } from './client.types.js'
import { DelegatedListener, delegates } from './delegated-listener.js'
import { isPlaitedMessage } from './client.guards.js'
import { updateInbox } from './use-stream.utils.js'

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

export const useStream = ({ url, protocols }: { url: string | `/${string}` | URL; protocols?: string | string[] }) => {
  const retryStatusCodes = new Set([1006, 1012, 1013])
  const maxRetries = 3
  let socket: WebSocket | undefined
  let retryCount = 0
  let documentIsHidden = document.hidden
  const ws = {
    async callback(evt: MessageEvent) {
      if (evt.type === 'message') {
        try {
          const { data } = evt
          const message = isTypeOf<string>(data, 'string') ? JSON.parse(data) : data
          if (isPlaitedMessage(message)) {
            await updateInbox(message)
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error)
        }
      }
      if (isCloseEvent(evt) && retryStatusCodes.has(evt.code)) ws.retry()
      if (evt.type === 'open') {
        retryCount = 0
      }
      if (evt.type === 'error') {
        console.error('WebSocket error: ', evt)
      }
    },
    connect() {
      const path =
        isTypeOf<string>(url, 'string') && url.startsWith('/') ?
          `${self?.location?.origin.replace(/^http/, 'ws')}${url}`
        : url
      if (!documentIsHidden) {
        socket = new WebSocket(path, protocols)
        delegates.set(socket, new DelegatedListener(ws.callback))
        // WebSocket connection opened
        socket.addEventListener('open', delegates.get(socket))
        // Handle incoming messages
        socket.addEventListener('message', delegates.get(socket))
        // Handle WebSocket errors
        socket.addEventListener('error', delegates.get(socket))
        // WebSocket connection closed
        socket.addEventListener('close', delegates.get(socket))
      }
    },
    retry() {
      if (retryCount < maxRetries) {
        // To get max we use a cap: 9999ms base: 1000ms
        const max = Math.min(9999, 1000 * Math.pow(2, retryCount))
        // We then select a random value between 0 and max
        setTimeout(ws.connect, Math.floor(Math.random() * max))
        retryCount++
      }
      socket = undefined
    },
  }
  const send = <T extends PlaitedMessage>(message: T) => {
    const fallback = () => {
      send(message)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      if (documentIsHidden) {
        socket?.close()
        socket = undefined
      }
      return
    }
    if (!socket) ws.connect()
    socket?.addEventListener('open', fallback)
  }
  const documentVisibilityCallback = () => {
    documentIsHidden = document.hidden
    if (documentIsHidden) {
      socket?.close()
      socket = undefined
    } else {
      ws.connect()
    }
  }
  delegates.set(document, new DelegatedListener(documentVisibilityCallback))
  document.addEventListener('visibilitychange', delegates.get(document))
  return send
}
