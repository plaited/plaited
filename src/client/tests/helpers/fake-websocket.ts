/**
 * In-test WebSocket stand-in for the controller unit suite.
 *
 * @remarks
 * Happy-dom does not recognise native `Event` instances passed to
 * `EventTarget.dispatchEvent`, so this fake manages listeners manually and
 * stamps `event.target` itself — which is exactly what the controller's
 * `#socketListener` inspects (`event.target instanceof WebSocket`).
 *
 * Sockets are created in `CONNECTING` (matching the real platform) so tests
 * can exercise the controller's `#messageQueue` drain path by calling
 * {@link FakeWebSocket.serverOpen} explicitly.
 */
type Listener = EventListenerOrEventListenerObject

export class FakeWebSocket {
  static CONNECTING = 0 as const
  static OPEN = 1 as const
  static CLOSING = 2 as const
  static CLOSED = 3 as const

  /** Every socket the controller has created, in creation order. */
  static instances: FakeWebSocket[] = []

  static reset() {
    FakeWebSocket.instances = []
  }

  /** Most recently created socket (the controller's current `#socket`). */
  static get last(): FakeWebSocket {
    const ws = FakeWebSocket.instances.at(-1)
    if (!ws) throw new Error('No FakeWebSocket has been created yet.')
    return ws
  }

  readonly listeners = new Map<string, Set<Listener>>()
  readonly url: string
  readonly sent: string[] = []
  readyState: number = FakeWebSocket.CONNECTING

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: Listener) {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set<Listener>()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  send(message: string) {
    this.sent.push(message)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  // ─── Server-side simulation helpers ──────────────────────────────────────

  private emit(type: string, event: Event) {
    Object.defineProperty(event, 'target', { value: this })
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }

  /** Transition to OPEN and deliver the `open` event (drains the queue). */
  serverOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', new Event('open'))
  }

  /** Deliver a `message` event. `data` is JSON-stringified if not already a string. */
  serverMessage(data: unknown) {
    this.emit('message', new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) }))
  }

  /** Deliver a `close` event with the given code and transition to CLOSED. */
  serverClose(code: number, reason = '') {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', new CloseEvent('close', { code, reason }))
  }

  /** Deliver an `error` event. */
  serverError() {
    this.emit('error', new Event('error'))
  }
}
