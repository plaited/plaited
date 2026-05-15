import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Trigger } from '../../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../shared/shared.constants.ts'

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: FakeWebSocket[] = []

  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  readonly sent: string[] = []
  readonly url: string
  readonly protocol: string
  readyState = FakeWebSocket.OPEN

  constructor(url: string, protocol: string) {
    this.url = url
    this.protocol = protocol
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener)
  }

  send(message: string) {
    this.sent.push(message)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  serverSend(message: unknown) {
    const event = new MessageEvent('message', { data: JSON.stringify(message) })
    Object.defineProperty(event, 'target', { value: this })
    for (const listener of this.listeners.get('message') ?? []) {
      if (typeof listener === 'function') {
        listener(event)
      } else {
        listener.handleEvent(event)
      }
    }
  }
}

class FakeCustomElementRegistry {
  #definitions = new Map<string, CustomElementConstructor>()

  define(tag: string, elementConstructor: CustomElementConstructor) {
    this.#definitions.set(tag, elementConstructor)
  }

  get(tag: string) {
    return this.#definitions.get(tag)
  }

  initialize(_root: Node) {}
}

beforeAll(() => {
  GlobalRegistrator.register()
  Object.assign(HTMLTemplateElement.prototype, {
    setHTMLUnsafe(this: HTMLTemplateElement, html: string) {
      this.innerHTML = html
    },
  })
  globalThis.CustomElementRegistry = FakeCustomElementRegistry as unknown as typeof CustomElementRegistry
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
})

afterEach(() => {
  document.body.replaceChildren()
  FakeWebSocket.instances = []
})

describe('useController', () => {
  const defineInjectedController = async (send: Trigger) => {
    const { useController } = await import('../controller.ts')
    const tag = `injected-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
    customElements.define(tag, useController(send))
    return tag
  }

  const getLatestSocket = (): FakeWebSocket => {
    const socket = FakeWebSocket.instances.at(-1)
    if (!socket) {
      throw new Error('Expected controller to create a WebSocket.')
    }
    return socket
  }

  test('routes rendered trigger events through injected send instead of WebSocket send', async () => {
    const outbound: unknown[] = []
    const tag = await defineInjectedController((message) => {
      outbound.push(message)
    })

    document.body.innerHTML = `<${tag} p-topic="topic"><div p-target="main"></div></${tag}>`
    const socket = getLatestSocket()

    socket.serverSend({
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<button id="save" p-trigger="click:save">Save</button>',
        stylesheets: [],
        registry: [],
      },
    })

    document.getElementById('save')?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))

    expect(outbound).toEqual([
      {
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        detail: {
          type: 'save',
          detail: {
            id: 'save',
            'p-trigger': 'click:save',
            topic: 'topic',
          },
        },
      },
    ])
    expect(socket.sent).toEqual([])
  })

  test('routes form submissions through injected send', async () => {
    const outbound: unknown[] = []
    const tag = await defineInjectedController((message) => {
      outbound.push(message)
    })

    document.body.innerHTML = `<${tag}>
      <form id="profile" action="/profile" method="post">
        <input name="displayName" value="Ada">
      </form>
    </${tag}>`
    document.getElementById('profile')?.dispatchEvent(new Event('submit', { bubbles: true, composed: true }))

    expect(outbound).toEqual([
      {
        type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
        detail: {
          id: 'profile',
          action: null,
          method: 'post',
          data: {
            displayName: 'Ada',
          },
        },
      },
    ])
  })

  test('routes controller runtime errors through injected send', async () => {
    const outbound: unknown[] = []
    const tag = await defineInjectedController((message) => {
      outbound.push(message)
    })

    document.body.innerHTML = `<${tag} p-topic="topic"><div p-target="main"></div></${tag}>`
    const socket = getLatestSocket()

    socket.serverSend({
      type: 'unknown_server_event',
      detail: {},
    })

    expect(outbound).toEqual([
      {
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail: expect.objectContaining({
          kind: 'server_message_error',
        }),
      },
    ])
  })
})
