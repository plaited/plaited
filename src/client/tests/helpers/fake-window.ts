/**
 * Fake `Window`-like message endpoint that faithfully simulates the
 * cross-origin `window.postMessage` boundary:
 * - delivers messages to the entangled peer's `message` listeners
 * - populates `event.origin` from the sender
 * - transfers `MessagePort`s in `event.ports`
 * - enforces `targetOrigin` (mismatched messages are dropped)
 *
 * happy-dom does not implement `MessagePort` transfer through
 * `window.postMessage` (its source is tagged `// TODO: Implement transfer`),
 * so this fake is required to exercise the web-a2a handshake/migration flow.
 * The `MessagePort`s themselves are real (entanglement is exercised); only the
 * window-boundary delivery of the transferred port is faked.
 *
 * @internal
 */
export interface FakeWindow {
  readonly origin: string
  postMessage(message: unknown, targetOrigin: string, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void
}

export const createFakeWindowPair = ({
  consumerOrigin,
  providerOrigin,
}: {
  consumerOrigin: string
  providerOrigin: string
}): { consumer: FakeWindow; provider: FakeWindow } => {
  let consumerRef: FakeWindow | undefined
  let providerRef: FakeWindow | undefined
  const consumer = createFakeWindow(consumerOrigin, () => providerRef!)
  const provider = createFakeWindow(providerOrigin, () => consumerRef!)
  consumerRef = consumer
  providerRef = provider
  return { consumer, provider }
}

const isPortLike = (t: unknown): boolean =>
  typeof t === 'object' && t !== null && (t as { constructor?: { name?: string } }).constructor?.name === 'MessagePort'

const createFakeWindow = (origin: string, getPeer: () => FakeWindow): FakeWindow => {
  const listeners = new Set<(ev: MessageEvent) => void>()
  const deliver = (fromOrigin: string, message: unknown, ports: MessagePort[]) => {
    const event = { type: 'message', data: message, origin: fromOrigin, ports } as unknown as MessageEvent
    for (const listener of listeners) listener(event)
  }
  return {
    origin,
    postMessage(message, targetOrigin, transfer = []) {
      const peer = getPeer()
      if (targetOrigin !== '*' && targetOrigin !== peer.origin) return // dropped
      const ports = transfer.filter((t): t is MessagePort => t instanceof MessagePort || isPortLike(t))
      // schedule delivery asynchronously like a real browser
      queueMicrotask(() =>
        (peer as FakeWindow & { __deliver(from: string, m: unknown, p: MessagePort[]): void }).__deliver(
          origin,
          message,
          ports,
        ),
      )
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    __deliver: deliver,
  } as FakeWindow
}
