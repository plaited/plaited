import type { BPEvent } from '../behavioral/b-thread.js'
import type { CustomElementTag } from '../jsx/jsx.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { INSERT_METHODS } from './client.constants.js'
import type { InsertMessage, TriggerMessage, JSONDetail, PlaitedMessage } from './client.types.js'
import { DelegatedListener, delegates } from './delegated-listener.js'
import type { PlaitedElement } from './define-element.js'
import { isInsertMessage, isPlaitedMessage, isTriggerMessage } from './client.guards.js'

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
  method: keyof typeof INSERT_METHODS
}) => {
  const methods = {
    append: () => host.append(createDocumentFragment(html)),
    prepend: () => host.prepend(createDocumentFragment(html)),
    replaceChildren: () => host.replaceChildren(createDocumentFragment(html)),
  }
  methods[method]()
}

const handleMessage =
  (host: PlaitedElement) =>
  ({ data }: { data: TriggerMessage | InsertMessage }) => {
    if (isInsertMessage(data)) {
      const { method, html } = data
      updateElement({ host, html, method })
    }
    if (isTriggerMessage(data)) {
      const { type, detail } = data
      host.trigger({ type, detail })
    }
  }

const isCloseEvent = (event: CloseEvent | MessageEvent): event is CloseEvent => event.type === 'close'

const PLAITED_CHANNEL = 'PLAITED_CHANNEL'

export const toAddress = (tag: CustomElementTag, id?: string): string => `${tag}${id ? `#${id}` : ''}`

export const useServer = ({ url, protocols }: { url: string | `/${string}` | URL; protocols?: string | string[] }) => {
  const subscribers = new Map<string, ReturnType<typeof handleMessage>>()
  const retryStatusCodes = new Set([1006, 1012, 1013])
  const maxRetries = 3
  let socket: WebSocket | undefined
  let retryCount = 0
  let documentIsHidden = document.hidden

  const ws = {
    async callback(evt: MessageEvent) {
      if (evt.type === 'message') {
        try {
          const { data } = evt
          const message = isTypeOf<string>(data, 'string') ? JSON.parse(data) : data
          if (isPlaitedMessage(message)) {
            const { address } = message
            const handler = subscribers.get(address)
            handler && handler({ data: message })
            const channel = new BroadcastChannel(`${PLAITED_CHANNEL}_${address}`)
            channel.postMessage(message)
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
      if (!documentIsHidden) {
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
      }
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
  const send = <T extends JSONDetail>(event: BPEvent<T>) => {
    const fallback = () => {
      send(event)
      socket?.removeEventListener('open', fallback)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event))
      if (documentIsHidden) {
        socket?.close()
        socket = undefined
      }
      return
    }
    if (!socket) ws.connect()
    socket?.addEventListener('open', fallback)
  }
  const documentVisibilityCallback = () => {
    documentIsHidden = document.hidden
    if (documentIsHidden) {
      socket?.close()
      socket = undefined
    } else {
      ws.connect()
    }
  }
  delegates.set(document, new DelegatedListener(documentVisibilityCallback))
  document.addEventListener('visibilitychange', delegates.get(document))
  const connect = (host: PlaitedElement) => {
    if (!socket) ws.connect()
    const address = toAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
    const channel = new BroadcastChannel(`${PLAITED_CHANNEL}_${address}`)
    const handler = handleMessage(host)
    const channelCallback = (evt: { data: PlaitedMessage }) => {
      if (documentIsHidden) {
        handler(evt)
      }
    }
    channel.addEventListener('message', channelCallback)
    subscribers.set(address, handler)
    const disconnect = () => {
      subscribers.delete(address)
      channel.removeEventListener('message', channelCallback)
      channel.close()
    }
    host.trigger.addDisconnectCallback?.(disconnect)
    return disconnect
  }
  send.connect = connect
  return send
}
