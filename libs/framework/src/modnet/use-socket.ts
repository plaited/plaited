import type { Trigger } from '../behavioral/types.js'
import type { PlaitedElement, SocketMessage } from '../client/types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { SOCKET_URL } from '../client/constants.js'
import { isTypeOf, noop, ueid } from '@plaited/utils'
import { BP_ADDRESS, BP_SOCKET } from '../shared/constants.js'

const subscribers = new Map<string, Trigger>()
let socket: WebSocket | undefined
const maxRetries = 3
let retryCount = 0

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

const isSocketMessage = (msg: unknown): msg is SocketMessage<string> => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    'address' in msg &&
    typeof msg.address === 'string' &&
    'event' in msg &&
    isTypeOf<{ [key: string]: unknown }>(msg.event, 'object') &&
    'type' in msg.event &&
    typeof msg.event?.type === 'string' &&
    typeof msg.event?.detail === 'string'
  )
}

const retry = () => {
  if (retryCount < maxRetries) {
    setTimeout(connect, Math.pow(2, retryCount) * 1000)
    retryCount++
  }
  socket = undefined
}

const callback = (evt: MessageEvent) => {
  if (evt.type === 'message') {
    try {
      // TODO we're going to switch to blob
      const message = JSON.parse(evt.data)
      if (isSocketMessage(message)) {
        const { address, event } = message
        if (subscribers.has(address)) {
          const tpl = document.createElement('template')
          // @ts-ignore: https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTMLUnsafe
          tpl.setHTMLUnsafe(event.detail)
          subscribers.get(address)?.({ type: event.type, detail: tpl.content })
        }
      }
    } catch (error) {
      console.error('Error parsing incoming message:', error)
    }
  }
  if (isCloseEvent(evt)) {
    // Abnormal Closure/Service Restart/Try Again Later
    if ([1006, 1012, 1013].indexOf(evt.code) >= 0) retry()
  }
  if (evt.type === 'open') {
    retryCount = 0
  }
  if (evt.type === 'error') {
    console.error('WebSocket error: ', evt)
  }
}

const connect = () => {
  const sock = new WebSocket(SOCKET_URL)
  retry()
  delegates.set(sock, new DelegatedListener(callback))
  // WebSocket connection opened
  sock.addEventListener('open', delegates.get(sock))
  // Handle incoming messages
  sock.addEventListener('message', delegates.get(sock))
  // Handle WebSocket errors
  sock.addEventListener('error', delegates.get(sock))
  // WebSocket connection closed
  sock.addEventListener('close', delegates.get(sock))
  return sock
}

export const useSocket = (host: PlaitedElement) => {
  const tag = host.tagName.toLowerCase()
  //TODO change this to something like DID
  const bpSocket = host.getAttribute(BP_SOCKET) ?? undefined
  if (!bpSocket) {
    console.error(`[${tag}] is not a Module`)
    return noop
  }
  const bpAddress = `${tag}--${ueid()}`
  if (!subscribers.has(bpAddress)) {
    console.error(`Socket already has subscriber with address: [${bpAddress}]`)
    return noop
  }
  host.setAttribute(BP_ADDRESS, bpAddress)
  subscribers.set(bpAddress, host.trigger)
  const disconnect = () => {
    subscribers.delete(bpAddress)
  }
  host.addDisconnectedCallback(disconnect)

  const send: Trigger = (event) => {
    const fallback = () => {
      send(event)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      const message = { address: bpSocket, event }
      return socket.send(JSON.stringify(message))
    }
    if (!socket) {
      socket = connect()
    }
    socket?.addEventListener('open', fallback)
  }
  return send
}
