import type { BPEvent } from '../behavioral/types.js'
import type { CustomElementTag } from '../jsx/types.js'
import type { PlaitedElement, SendSocketDetail, PlaitedActionParam } from './types.js'
import type { SendClientMessage } from './types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { SOCKET_URL } from './constants.js'
import { isTypeOf } from '@plaited/utils'

const subscribers = new Map<string, PlaitedElement>()
const retryStatusCodes = new Set([1006, 1012, 1013])
const maxRetries = 3
let socket: WebSocket | undefined
let retryCount = 0

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

const isClientMessage = (msg: unknown): msg is SendClientMessage=> {
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

const createDocumentFragment = (html: string) => {
  const tpl = document.createElement('template')
  tpl.setHTMLUnsafe(html)
  return tpl.content
}

const triggerElement = (evt: MessageEvent) => {
  const message = JSON.parse(evt.data)
  if (isClientMessage(message)) {
    const { address, event } = message
    const host = subscribers.get(address)
    if (host && event?.detail) {
      const { type, detail } = event
      subscribers.get(address)?.trigger<PlaitedActionParam>({ type, detail: {
        append: () => host.append(createDocumentFragment(detail)),
        prepend: () => host.prepend(createDocumentFragment(detail)),
        render: () => host.replaceChildren(createDocumentFragment(detail)),
      }})
    }
  }
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
      triggerElement(evt)
    } catch (error) {
      console.error('Error parsing incoming message:', error)
    }
  }
  if (isCloseEvent(evt) && retryStatusCodes.has(evt.code)) retry()
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

export const toAddress = (tag: CustomElementTag, id?:string): string => `${tag}${id ? `#${id}` : ''}`

export const usePlaited = (host: PlaitedElement) => {
  const id = toAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
  subscribers.set(id, host)
  const disconnect = () => {
    subscribers.delete(id)
  }
  host.addDisconnectedCallback(disconnect)
  const send = <T extends SendSocketDetail>(address: string, event: BPEvent<T>) => {
    const fallback = () => {
      send(address, event)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      const message = { address, event }
      return socket.send(JSON.stringify(message))
    }
    if (!socket) {
      socket = connect()
    }
    socket?.addEventListener('open', fallback)
  }
  return send
}
