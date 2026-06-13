// import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
// import { GlobalRegistrator } from '@happy-dom/global-registrator'
// import type { Trigger } from '../../behavioral.ts'
// import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../shared/shared.constants.ts'

// class FakeWebSocket {
//   static CONNECTING = 0
//   static OPEN = 1
//   static CLOSING = 2
//   static CLOSED = 3

//   static instances: FakeWebSocket[] = []

//   readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
//   readonly sent: string[] = []
//   readonly url: string
//   readonly protocol: string
//   readyState = FakeWebSocket.OPEN

//   constructor(url: string, protocol: string) {
//     this.url = url
//     this.protocol = protocol
//     FakeWebSocket.instances.push(this)
//   }

//   addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
//     const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
//     listeners.add(listener)
//     this.listeners.set(type, listeners)
//   }

//   removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
//     this.listeners.get(type)?.delete(listener)
//   }

//   send(message: string) {
//     this.sent.push(message)
//   }

//   close() {
//     this.readyState = FakeWebSocket.CLOSED
//   }

//   serverClose(code: number) {
//     this.readyState = FakeWebSocket.CLOSED
//     const event = new CloseEvent('close', { code })
//     Object.defineProperty(event, 'target', { value: this })
//     for (const listener of this.listeners.get('close') ?? []) {
//       if (typeof listener === 'function') {
//         listener(event)
//       } else {
//         listener.handleEvent(event)
//       }
//     }
//   }

//   serverOpen() {
//     const event = new Event('open')
//     Object.defineProperty(event, 'target', { value: this })
//     for (const listener of this.listeners.get('open') ?? []) {
//       if (typeof listener === 'function') {
//         listener(event)
//       } else {
//         listener.handleEvent(event)
//       }
//     }
//   }

//   serverSend(message: unknown) {
//     const event = new MessageEvent('message', { data: JSON.stringify(message) })
//     Object.defineProperty(event, 'target', { value: this })
//     for (const listener of this.listeners.get('message') ?? []) {
//       if (typeof listener === 'function') {
//         listener(event)
//       } else {
//         listener.handleEvent(event)
//       }
//     }
//   }
// }

// class FakeCustomElementRegistry {
//   #definitions = new Map<string, CustomElementConstructor>()

//   define(tag: string, elementConstructor: CustomElementConstructor) {
//     this.#definitions.set(tag, elementConstructor)
//   }

//   get(tag: string) {
//     return this.#definitions.get(tag)
//   }

//   initialize(_root: Node) {}
// }

// beforeAll(() => {
//   GlobalRegistrator.register()
//   Object.assign(HTMLTemplateElement.prototype, {
//     setHTMLUnsafe(this: HTMLTemplateElement, html: string) {
//       this.innerHTML = html
//     },
//   })
//   globalThis.CustomElementRegistry = FakeCustomElementRegistry as unknown as typeof CustomElementRegistry
//   globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
// })

// afterEach(() => {
//   document.body.replaceChildren()
//   FakeWebSocket.instances = []
// })

// describe('useController', () => {
//   const defineInjectedController = async (send: Trigger) => {
//     const { useController } = await import('../controller.ts')
//     const tag = `injected-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//     customElements.define(tag, useController({ address: 'ws://localhost/ws', send }))
//     return tag
//   }

//   const getLatestSocket = (): FakeWebSocket => {
//     const socket = FakeWebSocket.instances.at(-1)
//     if (!socket) {
//       throw new Error('Expected controller to create a WebSocket.')
//     }
//     return socket
//   }

//   test('sends controller_connected when the WebSocket opens', async () => {
//     const { useController } = await import('../controller.ts')
//     const tag = `versioned-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//     customElements.define(tag, useController({ address: 'ws://localhost/ws' }))

//     document.body.innerHTML = `<${tag} o-topic="coding.board" o-version="42">
//       <div o-target="main" o-version="42"><p>main content</p></div>
//       <section o-target="cards" o-version="41"><article>card content</article></section>
//     </${tag}>`
//     const socket = getLatestSocket()

//     socket.serverOpen()

//     expect(socket.sent).toEqual([
//       JSON.stringify({
//         type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
//         detail: {
//           topic: 'coding.board',
//           version: '42',
//           event: {
//             type: 'controller_connected',
//             detail: {
//               'p-topic': 'coding.board',
//               'p-version': '42',
//               tagName: tag,
//             },
//           },
//         },
//       }),
//     ])
//   })

//   test('sends controller_connected again after reconnect', async () => {
//     const originalRandom = Math.random
//     Math.random = () => 0
//     try {
//       const { useController } = await import('../controller.ts')
//       const tag = `reconnect-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//       customElements.define(tag, useController({ address: 'ws://localhost/ws' }))

//       document.body.innerHTML = `<${tag} o-topic="coding.board" o-version="42">
//         <div o-target="main" o-version="42"></div>
//       </${tag}>`
//       const firstSocket = getLatestSocket()
//       firstSocket.serverOpen()
//       firstSocket.serverClose(1006)
//       await new Promise((resolve) => setTimeout(resolve, 0))
//       const secondSocket = getLatestSocket()

//       secondSocket.serverOpen()

//       const expected = JSON.stringify({
//         type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
//         detail: {
//           topic: 'coding.board',
//           version: '42',
//           event: {
//             type: 'controller_connected',
//             detail: {
//               'p-topic': 'coding.board',
//               'p-version': '42',
//               tagName: tag,
//             },
//           },
//         },
//       })
//       expect(firstSocket.sent).toEqual([expected])
//       expect(secondSocket.sent).toEqual([expected])
//     } finally {
//       Math.random = originalRandom
//     }
//   })

//   test('ignores server messages with mismatched topic', async () => {
//     const { useController } = await import('../controller.ts')
//     const tag = `mismatch-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//     customElements.define(tag, useController({ address: 'ws://localhost/ws' }))

//     document.body.innerHTML = `<${tag} o-topic="topic-a">
//       <div o-target="main" o-version="1"></div>
//     </${tag}>`
//     const socket = getLatestSocket()

//     socket.serverSend({
//       type: AGENT_TO_CONTROLLER_EVENTS.attrs,
//       detail: {
//         topic: 'topic-b',
//         version: '2',
//         target: 'main',
//         attr: { 'p-version': '2' },
//       },
//     })

//     expect(document.querySelector('[o-target="main"]')?.getAttribute('p-version')).toBe('1')
//     expect(socket.sent).toEqual([])
//   })

//   test('does not send trigger events after topic attribute is removed', async () => {
//     const errors: unknown[] = []
//     const originalError = console.error
//     console.error = (...args: unknown[]) => errors.push(args)
//     try {
//       const outbound: unknown[] = []
//       const { useController } = await import('../controller.ts')
//       const tag = `topic-removed-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//       customElements.define(tag, useController({ address: 'ws://localhost/ws', send: (m) => outbound.push(m) }))

//       document.body.innerHTML = `<${tag} o-topic="topic">
//         <form id="profile">
//           <input name="displayName" value="Ada">
//         </form>
//       </${tag}>`

//       document.body.firstElementChild?.removeAttribute('p-topic')
//       document.getElementById('profile')?.dispatchEvent(new Event('submit', { bubbles: true, composed: true }))

//       expect(outbound).toEqual([])
//       expect(errors.length).toBeGreaterThan(0)
//       //@ts-expect-error: expected error for test
//       expect(errors[0]?.[0]).toContain('topic')
//     } finally {
//       console.error = originalError
//     }
//   })

//   test('reports nested controller connections independently', async () => {
//     const { useController } = await import('../controller.ts')
//     const outerTag = `outer-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//     const innerTag = `inner-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//     customElements.define(outerTag, useController({ address: 'ws://localhost/ws' }))
//     customElements.define(innerTag, useController({ address: 'ws://localhost/ws' }))

//     document.body.innerHTML = `<${outerTag} o-topic="outer.topic" o-version="10">
//       <div o-target="outer-main" o-version="10"></div>
//       <${innerTag} o-topic="inner.topic" o-version="7">
//         <div o-target="inner-main" o-version="7"></div>
//       </${innerTag}>
//     </${outerTag}>`
//     const outerSocket = [...FakeWebSocket.instances].reverse().find((socket) => socket.protocol === 'outer.topic')
//     const innerSocket = [...FakeWebSocket.instances].reverse().find((socket) => socket.protocol === 'inner.topic')

//     expect(outerSocket).toBeDefined()
//     expect(innerSocket).toBeDefined()
//     outerSocket!.serverOpen()
//     innerSocket!.serverOpen()

//     expect(outerSocket!.sent).toEqual([
//       JSON.stringify({
//         type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
//         detail: {
//           topic: 'outer.topic',
//           version: '10',
//           event: {
//             type: 'controller_connected',
//             detail: {
//               'p-topic': 'outer.topic',
//               'p-version': '10',
//               tagName: outerTag,
//             },
//           },
//         },
//       }),
//     ])
//     expect(innerSocket!.sent).toEqual([
//       JSON.stringify({
//         type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
//         detail: {
//           topic: 'inner.topic',
//           version: '7',
//           event: {
//             type: 'controller_connected',
//             detail: {
//               'p-topic': 'inner.topic',
//               'p-version': '7',
//               tagName: innerTag,
//             },
//           },
//         },
//       }),
//     ])
//   })

//   test('applies p-version attrs updates to controller targets', async () => {
//     const { useController } = await import('../controller.ts')
//     const tag = `attrs-version-controller-${Date.now()}-${Math.random().toString(16).slice(2)}`
//     customElements.define(tag, useController({ address: 'ws://localhost/ws' }))

//     document.body.innerHTML = `<${tag} o-topic="topic">
//       <div o-target="main" o-version="1"></div>
//     </${tag}>`
//     const socket = getLatestSocket()

//     socket.serverSend({
//       type: AGENT_TO_CONTROLLER_EVENTS.attrs,
//       detail: {
//         topic: 'topic',
//         version: '2',
//         target: 'main',
//         attr: { 'p-version': '2' },
//       },
//     })

//     expect(document.querySelector('[o-target="main"]')?.getAttribute('p-version')).toBe('2')
//   })

//   test('routes rendered trigger events through injected send instead of WebSocket send', async () => {
//     const outbound: unknown[] = []
//     const tag = await defineInjectedController((message) => {
//       outbound.push(message)
//     })

//     document.body.innerHTML = `<${tag} o-topic="topic"><div o-target="main"></div></${tag}>`
//     const socket = getLatestSocket()

//     socket.serverSend({
//       type: AGENT_TO_CONTROLLER_EVENTS.render,
//       detail: {
//         topic: 'topic',
//         version: '1',
//         target: 'main',
//         html: '<button id="save" o-trigger="click:save">Save</button>',
//         stylesheets: [],
//         registry: [],
//         swap: 'innerHTML',
//       },
//     })

//     document.getElementById('save')?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))

//     expect(outbound).toEqual([
//       {
//         type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
//         detail: {
//           topic: 'topic',
//           version: '1',
//           event: {
//             type: 'save',
//             detail: {
//               id: 'save',
//               'o-trigger': 'click:save',
//             },
//           },
//         },
//       },
//     ])
//     expect(socket.sent).toEqual([])
//   })

//   test('routes form submissions through injected send', async () => {
//     const outbound: unknown[] = []
//     const tag = await defineInjectedController((message) => {
//       outbound.push(message)
//     })

//     document.body.innerHTML = `<${tag} o-topic="form-topic">
//       <form id="profile" action="/profile" method="post">
//         <input name="displayName" value="Ada">
//       </form>
//     </${tag}>`
//     document.getElementById('profile')?.dispatchEvent(new Event('submit', { bubbles: true, composed: true }))

//     expect(outbound).toEqual([
//       {
//         type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
//         detail: {
//           topic: 'form-topic',
//           version: null,
//           id: 'profile',
//           action: null,
//           method: 'post',
//           data: {
//             displayName: 'Ada',
//           },
//         },
//       },
//     ])
//   })

//   test('routes controller runtime errors through injected send', async () => {
//     const outbound: unknown[] = []
//     const tag = await defineInjectedController((message) => {
//       outbound.push(message)
//     })

//     document.body.innerHTML = `<${tag} o-topic="topic"><div o-target="main"></div></${tag}>`
//     const socket = getLatestSocket()

//     socket.serverSend({
//       type: 'unknown_server_event',
//       detail: { version: '1' },
//     })

//     expect(outbound).toEqual([
//       {
//         type: CONTROLLER_TO_AGENT_EVENTS.error,
//         detail: expect.objectContaining({
//           topic: 'topic',
//           version: null,
//           description: 'Failed to parse or handle server message',
//         }),
//       },
//     ])
//   })
// })
