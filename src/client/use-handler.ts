import type { BPEvent, Trigger } from '../behavioral.js'
import type { CustomElementTag } from '../jsx/jsx.types.js'
import type { InsertMessage, TriggerMessageDetail, TriggerMessage } from '../shared/shared.types.js'
import { DelegatedListener, delegates } from './delegated-listener.js'
import { isTypeOf } from '../utils/true-type-of.js'
import { ACTION_INSERT, INSERT_METHODS, ACTION_TRIGGER } from '../shared/constants.js'

type SubscriberElement = HTMLElement & { trigger: Trigger }

const subscribers = new Map<string, SubscriberElement>()
const retryStatusCodes = new Set([1006, 1012, 1013])
const maxRetries = 3
let socket: WebSocket | undefined
let retryCount = 0

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

const isInsertMessage = (msg: unknown): msg is InsertMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    msg?.action === ACTION_INSERT &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.html, 'string') &&
    isTypeOf<string>(msg?.method, 'string') &&
    msg?.method in INSERT_METHODS
  )
}

const isTriggerMessage = (msg: unknown): msg is TriggerMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    msg?.action === ACTION_TRIGGER &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.type, 'string')
  )
}

const createDocumentFragment = (html: string) => {
  const tpl = document.createElement('template')
  tpl.setHTMLUnsafe(html)
  return tpl.content
}

const updateElement = ({
  host,
  html,
  method,
}: {
  host: SubscriberElement
  html: string
  method: keyof typeof INSERT_METHODS
}) => {
  const methods = {
    append: () => host.append(createDocumentFragment(html)),
    prepend: () => host.prepend(createDocumentFragment(html)),
    replaceChildren: () => host.replaceChildren(createDocumentFragment(html)),
  }
  methods[method]()
}

const triggerElement = (evt: MessageEvent<string>) => {
  try {
    const message = JSON.parse(evt.data)
    if (isInsertMessage(message)) {
      const { address, method, html } = message
      const host = subscribers.get(address)
      host && updateElement({ host, html, method })
    }
    if (isTriggerMessage(message)) {
      const { address, type, detail } = message
      const host = subscribers.get(address)
      host?.trigger({ type, detail })
    }
  } catch (error) {
    console.error('Error parsing incoming message:', error)
  }
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
  socket = new WebSocket(self?.location?.origin.replace(/^http/, 'ws'))
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

const retry = () => {
  if (retryCount < maxRetries) {
    // To get max we use a cap: 9999ms base: 1000ms
    const max = Math.min(9999, 1000 * Math.pow(2, retryCount))
    // We then select a random value between 0 and max
    setTimeout(connect, Math.floor(Math.random() * max))
    retryCount++
  }
  socket = undefined
}

export const toAddress = (tag: CustomElementTag, id?: string): string => `${tag}${id ? `#${id}` : ''}`

export type SendToHandler = {
  <T extends TriggerMessageDetail>(event: BPEvent<T>): void | (<T = never>(..._: T[]) => void)
  disconnect: () => void
}

export const useSend = (address: string) => {
  const send = <T extends TriggerMessageDetail>(event: BPEvent<T>) => {
    const fallback = () => {
      send(event)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      const message = { address, event }
      return socket.send(JSON.stringify(message))
    }
    if (!socket) connect()
    socket?.addEventListener('open', fallback)
  }
  return send
} 

export const useHandler = (host: SubscriberElement, address: string): SendToHandler => {
  const id = toAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
  subscribers.set(id, host)
  const disconnect = () => {
    subscribers.delete(id)
  }
  const send = useSend(address) as SendToHandler
  send.disconnect = disconnect
  return send
}
