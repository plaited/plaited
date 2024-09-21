import type { BPEvent } from '../behavioral/b-thread.js'
import type { Trigger } from '../behavioral/b-program.js'
import type { CustomElementTag } from '../jsx/jsx.types.js'
import type { ValueOf } from '../utils/value-of.type.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { ACTION_INSERT, ACTION_TRIGGER, INSERT_METHODS } from './client.constants.js'
import { DelegatedListener, delegates } from './delegated-listener.js'

export type InsertMessage = {
  address: string
  action: typeof ACTION_INSERT
  method: ValueOf<typeof INSERT_METHODS>
  html: string
}

export type JSONDetail = string | number | boolean | null | JsonObject | JsonArray

type JsonObject = {
  [key: string]: JSONDetail
}

type JsonArray = Array<JSONDetail>

export type TriggerMessage<T extends JSONDetail = JSONDetail> = {
  address: string
  action: typeof ACTION_TRIGGER
  type: string
  detail?: T
}

type SubscriberElement = HTMLElement & { trigger: Trigger }

export type SendServer = {
  <T extends JSONDetail>(event: BPEvent<T>): void
  disconnect: () => void
}

export type UseServer = (host: SubscriberElement) => SendServer

const subscribers = new Map<string, SubscriberElement>()

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

const elementTrigger = (data: string | Record<string, unknown>) => {
  try {
    const message = isTypeOf<string>(data, 'strng') ? JSON.parse(data) : data
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

const retryStatusCodes = new Set([1006, 1012, 1013])
const maxRetries = 3
let socket: WebSocket | undefined
let retryCount = 0

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

const callback = (evt: MessageEvent) => {
  if (evt.type === 'message') {
    try {
      elementTrigger(evt.data)
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

export const useServer: UseServer = (host) => {
  const id = toAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
  subscribers.set(id, host)
  const disconnect = () => {
    subscribers.delete(id)
  }
  const send = <T extends JSONDetail>(event: BPEvent<T>) => {
    const fallback = () => {
      send(event)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      return socket.send(JSON.stringify(event))
    }
    if (!socket) connect()
    socket?.addEventListener('open', fallback)
  }
  send.disconnect = disconnect
  return send
}
