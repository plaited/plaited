import type { BPEvent, PlaitedTrigger } from '../main.ts'
import { DelegatedListener, delegates } from './delegated-listener.ts'
import { CONSOLE_ERRORS, SHELL_EVENTS } from './shell.constants.ts'
import { BPEventSchema, type RootConnectedMessage } from './shell.schema.ts'

/** @internal Retry status codes that warrant reconnection attempts. */
const RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum number of reconnection attempts before giving up. */
const MAX_RETRIES = 3

export const useWebSocket = (trigger: PlaitedTrigger, host: Document | Element) => {
  // ─── WebSocket lifecycle ───────────────────────────────────────────
  let socket: WebSocket | undefined
  let retryCount = 0

  const send = <T extends BPEvent>(message: T) => {
    const fallback = () => {
      send(message)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      return socket.send(JSON.stringify(message))
    }
    if (!socket) ws.connect()
    socket?.addEventListener('open', fallback)
  }

  const disconnect = () => {
    socket?.close()
  }

  const ws = {
    callback(evt: CloseEvent | MessageEvent) {
      if (evt instanceof MessageEvent) {
        const result = BPEventSchema.safeParse(JSON.parse(evt.data))
        if (result.success) trigger(result.data)
        else console.error(CONSOLE_ERRORS.ws_invalid_message, result.error)
      }
      if (evt.type === 'open') {
        retryCount = 0
        send<RootConnectedMessage>({
          type: SHELL_EVENTS.root_connected,
          detail: host instanceof HTMLElement ? host.tagName.toLowerCase() : 'document',
        })
      }
      if (evt instanceof CloseEvent && RETRY_STATUS_CODES.has(evt.code)) {
        ws.retry()
      }
      if (evt.type === 'error') {
        console.error(CONSOLE_ERRORS.ws_error_message, evt)
      }
    },
    connect() {
      socket = new WebSocket(self.location.origin.replace(/^http/, 'ws'))
      const listener = new DelegatedListener(ws.callback)
      delegates.set(socket, listener)
      socket.addEventListener('open', listener)
      socket.addEventListener('message', listener)
      socket.addEventListener('error', listener)
      socket.addEventListener('close', listener)
    },
    retry() {
      socket = undefined
      if (retryCount < MAX_RETRIES) {
        const max = Math.min(9999, 1000 * 2 ** retryCount)
        setTimeout(ws.connect, Math.floor(Math.random() * max))
        retryCount++
      }
    },
  }

  ws.connect()

  trigger.addDisconnectCallback(disconnect)

  return send
}
