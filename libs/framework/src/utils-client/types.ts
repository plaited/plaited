import type { BPEvent, Trigger } from '../behavioral/types.js'

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

export type UseSocket = {
  (
    url: string | URL,
    protocols?: string | string[],
  ): [
   (trigger: Trigger, address?: string) => Disconnect,
  (message: SocketMessage) => void
  ]
    
}

export type UsePostMessage = ({
  trigger,
  publicEvents,
  targetOrigin,
}: {
  trigger: Trigger
  publicEvents: string[]
  targetOrigin?: string
}) => {
  (data: BPEvent): void
  disconnect(): void
}

import type { Logger } from '../behavioral/types.js'

export type FetchHTMLOptions = RequestInit & { retry: number; retryDelay: number }

export type WireArgs = FetchHTMLOptions & { logger?: Logger, socket?: ReturnType<UseSocket> }
