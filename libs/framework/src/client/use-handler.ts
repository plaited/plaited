import type { BPEvent } from '../behavioral/types.js'
import type { CustomElementTag } from '../jsx/types.js'
import type { PlaitedElement, SendSocketDetail } from './types.js'
import type { UpdateLightDomMessage } from './types.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { isTypeOf } from '@plaited/utils'
import { UPDATE_LIGHT_DOM, UPDATE_LIGHT_DOM_METHODS } from '../shared/constants.js'
const subscribers = new Map<string, PlaitedElement>()
const retryStatusCodes = new Set([1006, 1012, 1013])
const maxRetries = 3
let socket: WebSocket | undefined
let retryCount = 0

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

const isUpdateLightDomMessage = (msg: unknown): msg is UpdateLightDomMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    msg?.action === UPDATE_LIGHT_DOM &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.html, 'string') &&
    isTypeOf<string>(msg?.method, 'string') &&
    msg?.method in UPDATE_LIGHT_DOM_METHODS
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
  host: PlaitedElement
  html: string
  method: keyof typeof UPDATE_LIGHT_DOM_METHODS
}) => {
  const methods = {
    append: () => host.append(createDocumentFragment(html)),
    prepend: () => host.prepend(createDocumentFragment(html)),
    replaceChildren: () => host.replaceChildren(createDocumentFragment(html)),
  }
  methods[method]()
}

const triggerElement = (evt: MessageEvent<string>) => {
  const message = JSON.parse(evt.data)
  if (isUpdateLightDomMessage(message)) {
    const { address, method, html } = message
    const host = subscribers.get(address)
    if (host) {
      updateElement({ host, html, method })
    }
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
  <T extends SendSocketDetail>(event: BPEvent<T>): void | (<T = never>(..._: T[]) => void)
  disconnect: () => void
}

export const useHandler = (host: PlaitedElement, address: string): SendToHandler => {
  const id = toAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
  subscribers.set(id, host)
  const disconnect = () => {
    subscribers.delete(id)
  }
  const send = <T extends SendSocketDetail>(event: BPEvent<T>) => {
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
  send.disconnect = disconnect
  return send
}
