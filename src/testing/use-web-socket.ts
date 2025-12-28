import { DelegatedListener, delegates } from '../main/delegated-listener.ts'
import type { PlaitedTrigger } from '../main.ts'
import { isTypeOf } from '../utils.ts'
import { AGENT_EVENTS, RELOAD_PAGE, RUNNER_URL } from './testing.constants.ts'
import { AgentMessageSchema } from './testing.schemas.ts'
import type { Send } from './testing.types.ts'

/** @internal Type guard to check if an event is a WebSocket CloseEvent. */
const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

/**
 * @internal
 * Establishes and manages a WebSocket connection to the Plaited test runner server.
 * This utility is responsible for sending test results, snapshots, and other messages
 * from the story fixture to the runner. It handles connection retries and message queuing.
 * Supports bidirectional communication for agent-to-client messaging.
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
 * - Connects to the runner URL (`/.plaited/runner`).
 * - Listens for `open`, `message`, `error`, and `close` events.
 * - Handles page reload requests from the runner.
 * - Handles agent messages (logs to console and dispatches custom events).
 * - Implements an exponential backoff retry mechanism for specific close codes.
 */
export const useWebSocket = (trigger: PlaitedTrigger) => {
  const retryStatusCodes = new Set([1006, 1012, 1013])
  const maxRetries = 3
  let socket: WebSocket | undefined
  let retryCount = 0
  const ws = {
    async callback(evt: MessageEvent) {
      if (evt.type === 'message') {
        const { data } = evt
        // Handle reload page message
        if (isTypeOf<string>(data, 'string') && data === RELOAD_PAGE) {
          window.location.reload()
          return
        }
        // Handle agent messages
        if (isTypeOf<string>(data, 'string')) {
          try {
            const json = JSON.parse(data)
            const parsed = AgentMessageSchema.safeParse(json)
            if (parsed.success) {
              // Log agent message to console
              const { content, agentId, timestamp } = parsed.data.detail
              const time = new Date(timestamp).toLocaleTimeString()
              // biome-ignore lint/suspicious/noConsole: Agent messages should be logged to browser console for debugging
              console.log(`[Agent${agentId ? ` ${agentId}` : ''}] ${time}: ${content}`)
              // Dispatch custom event for UI components to handle
              window.dispatchEvent(
                new CustomEvent(AGENT_EVENTS.agent_message, {
                  detail: parsed.data.detail,
                }),
              )
            }
          } catch {
            // Not a JSON message, ignore
          }
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
      socket.addEventListener('open', delegates.get(socket))
      socket.addEventListener('message', delegates.get(socket))
      socket.addEventListener('error', delegates.get(socket))
      socket.addEventListener('close', delegates.get(socket))
    },
    retry() {
      if (retryCount < maxRetries) {
        const max = Math.min(9999, 1000 * 2 ** retryCount)
        setTimeout(ws.connect, Math.floor(Math.random() * max))
        retryCount++
      }
      socket = undefined
    },
  }
  ws.connect()
  const send: Send = (message) => {
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
  trigger.addDisconnectCallback(disconnect)
  return send
}
