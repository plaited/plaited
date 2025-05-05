import { type PlaitedMessage, type PlaitedElement } from '../main/plaited.types.js'
import { isPlaitedMessage } from '../main/plaited.guards.js'
import { type CustomElementTag } from '../jsx/jsx.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { DelegatedListener, delegates } from '../utils/delegated-listener.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'

/** @internal Type guard to check if an event is a WebSocket CloseEvent. */
const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

/**
 * Generates a unique address string for a Plaited element based on its tag name and optional ID.
 * Used for BroadcastChannel communication.
 * @param tag The custom element tag name.
 * @param id Optional ID attribute of the element.
 * @returns A unique address string (e.g., 'my-component#instance-1').
 * @internal
 */
export const getAddress = (tag: CustomElementTag, id?: string): string => `${tag}${id ? `#${id}` : ''}`

/**
 * Connects a Plaited test fixture element to the test runner using a BroadcastChannel.
 * Listens for messages on the channel and triggers corresponding events on the host element.
 * Automatically cleans up the listener when the host disconnects.
 *
 * @param host The PlaitedElement instance representing the test fixture.
 * @param trigger The PlaitedTrigger instance associated with the host.
 * @returns A function to manually disconnect the BroadcastChannel listener.
 * @internal
 */
export const connectTestRunner = (host: PlaitedElement, trigger: PlaitedTrigger) => {
  const address = getAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
  const channel = new BroadcastChannel(address)
  const handler = (evt: MessageEvent<PlaitedMessage>) => {
    host.trigger({ type: evt.data.type, detail: evt.data.detail })
  }
  channel.addEventListener('message', handler)
  const disconnect = () => {
    channel.removeEventListener('message', handler)
    channel.close()
  }
  trigger.addDisconnectCallback(disconnect)
  return disconnect
}

/**
 * Creates a function (`send`) for sending messages from the test fixture (browser)
 * back to the test runner server via WebSocket. Handles WebSocket connection,
 * message queuing, automatic reconnection with exponential backoff on specific close codes,
 * and forwarding incoming messages from the server to the appropriate BroadcastChannel.
 *
 * @param url The WebSocket server URL. Can be a full URL or a path starting with '/'.
 * @param protocols Optional WebSocket subprotocols.
 * @returns A `send` function `(message: PlaitedMessage) => void` that queues or sends messages to the WebSocket server.
 * @internal
 */
export const useSendRunner = (url: string | `/${string}` | URL, protocols?: string | string[]) => {
  const retryStatusCodes = new Set([1006, 1012, 1013])
  const maxRetries = 3
  let socket: WebSocket | undefined
  let retryCount = 0
  const ws = {
    async callback(evt: MessageEvent) {
      if (evt.type === 'message') {
        try {
          const { data } = evt
          const message = isTypeOf<string>(data, 'string') ? JSON.parse(data) : data
          if (isPlaitedMessage(message)) {
            const { address, ...event } = message
            const channel = new BroadcastChannel(address)
            channel.postMessage(event)
            channel.close()
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
  const send = (message: PlaitedMessage) => {
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
  return send
}
