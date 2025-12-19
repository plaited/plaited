import { DelegatedListener, delegates } from '../main/delegated-listener.ts'
import { isTypeOf } from '../utils.ts'
import { RELOAD_PAGE, RUNNER_URL } from './testing.constants.ts'
import type { RunnerMessage } from './testing.schemas.ts'

/** @internal Type guard to check if an event is a WebSocket CloseEvent. */
const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

/**
 * @internal
 * Establishes and manages a WebSocket connection to the Plaited test runner server.
 * This utility is responsible for sending test results, snapshots, and other messages
 * from the story fixture to the runner. It handles connection retries and message queuing.
 *
 * @returns A `send` function to dispatch messages to the runner, and a `disconnect` method on the `send` function to close the WebSocket.
 *
 * The `send` function:
 * - Takes a `RunnerMessage` object.
 * - Sends the message as a JSON string over the WebSocket.
 * - If the socket is not open, it queues the message and sends it upon connection.
 * - If the socket is not connected, it attempts to connect.
 *
 * The `send.disconnect` method:
 * - Closes the WebSocket connection.
 *
 * Internal WebSocket handling:
 * - Connects to the runner URL (`/.plaited/test-runner`).
 * - Listens for `open`, `message`, `error`, and `close` events.
 * - Handles page reload requests from the runner.
 * - Implements an exponential backoff retry mechanism for specific close codes.
 */
export const useWebSocket = () => {
  const retryStatusCodes = new Set([1006, 1012, 1013])
  const maxRetries = 3
  let socket: WebSocket | undefined
  let retryCount = 0
  const ws = {
    async callback(evt: MessageEvent) {
      if (evt.type === 'message') {
        const { data } = evt
        const message = isTypeOf<string>(data, 'string') && data === RELOAD_PAGE
        if (message) {
          window.location.reload()
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
      socket = new WebSocket(`${self?.location?.origin.replace(/^http/, 'ws')}${RUNNER_URL}`)
      delegates.set(socket, new DelegatedListener(ws.callback))
      // WebSocket connection opened
      socket.addEventListener('open', delegates.get(socket))
      // Handle incoming messages
      socket.addEventListener('message', delegates.get(socket))
      // Handle WebSocket errors
      socket.addEventListener('error', delegates.get(socket))
      // WebSocket connection closed
      socket.addEventListener('close', delegates.get(socket))
    },
    retry() {
      if (retryCount < maxRetries) {
        // To get max we use a cap: 9999ms base: 1000ms
        const max = Math.min(9999, 1000 * 2 ** retryCount)
        // We then select a random value between 0 and max
        setTimeout(ws.connect, Math.floor(Math.random() * max))
        retryCount++
      }
      socket = undefined
    },
  }
  ws.connect()
  const send = (message: RunnerMessage) => {
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
  send.disconnect = () => {
    socket?.close()
  }
  return send
}
