import type { BPEvent, Trigger, Devtool } from '../behavioral/types.js'

export type Disconnect = () => void

export type UsePublisher = {
  (): {
    <T = unknown>(value?: T): void
    sub: (type: string, trigger: Trigger) => () => void
    type: 'publisher'
  }
}

export type UseWorker = {
  (
    scriptURL: string | URL,
    options?: WorkerOptions,
  ): {
    (args: BPEvent): void
    connect(trigger: Trigger): Disconnect
    type: 'worker'
  }
}

export type SocketMessage<T = unknown> = {
  address: string
  event: BPEvent<T>
}

export type PublishToSocket = (message: SocketMessage) => void
export type SubscribeToSocket = (address: string, trigger: Trigger) => Disconnect

export type UseSocket = {
  (url?: string | URL, protocols?: string | string[]): [PublishToSocket, SubscribeToSocket]
}

export type FetchHTMLOptions = RequestInit & { retry?: number; retryDelay?: number }

export type CaptureHook = (shadowRoot: ShadowRoot) => Disconnect

export type UseAjax = (args: RequestInit & { retry?: number; retryDelay?: number }) => CaptureHook

export type ExtendHooks = {
  devtool?: Devtool
  socket?: ReturnType<UseSocket>
  ajax?: ReturnType<UseAjax>
}
