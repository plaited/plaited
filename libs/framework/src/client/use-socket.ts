import type { BPEvent, Trigger } from '../behavioral/types.js'
import type { SocketMessage, UseSocket} from './types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { SOCKET_URL } from './constants.js'
import { isTypeOf, noop, canUseDOM } from '@plaited/utils'

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

const subscribers = new Map<string, Trigger>()
let socket: WebSocket | undefined
let connect: () => WebSocket

if(canUseDOM()) {
  const connect = () => {
    const sock = new WebSocket(SOCKET_URL)
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
  socket = connect()

  const maxRetries = 3
  let retryCount = 0
  const retry = () => {
    if (retryCount < maxRetries) {
      setTimeout(connect, Math.pow(2, retryCount) * 1000)
    }
    socket = undefined
  }

  const callback = (evt: MessageEvent) => {
    if (evt.type === 'message') {
      try {
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
}

export const useSocket:UseSocket = (address: string) => {
  const subscribe = (bpAddress: string, trigger: Trigger) => {
    if (!subscribers.has(bpAddress)) {
      subscribers.set(bpAddress, trigger)
      return () => {
        subscribers.delete(bpAddress)
      }
    }
    console.error(`Socket already has subscriber with address: [${bpAddress}]`)
    return noop
  }
  const publish = <T>(event: BPEvent<T>) => {
  const cb = () => {
    publish(event)
    socket?.removeEventListener('open', cb)
  }
  if (socket?.readyState === WebSocket.OPEN) {
    const message = { address, event }
    return socket.send(JSON.stringify(message))
  }
  if (!socket) {
    socket = connect()
  }
  socket?.addEventListener('open', cb)
  }
  publish.subscribe = subscribe
  publish.type = 'socket' as const
  return publish
}