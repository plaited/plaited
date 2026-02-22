import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

// Mock controller to prevent the useSnapshot → send → connect recursion.
// controlDocument creates its own behavioral() engine and calls controller() internally.
mock.module('../controller.ts', () => ({
  controller: () => {},
}))

// Dynamic import AFTER the mock is installed
const { controlDocument, DOCUMENT_EVENTS } = await import('../control-document.ts')

// ─── View Transition Event Mocks ──────────────────────────────────────────────

class MockViewTransition {
  finished = Promise.resolve()
  ready = Promise.resolve()
  updateCallbackDone = Promise.resolve()
  skipTransition() {}
}

class MockPageRevealEvent extends Event {
  viewTransition: MockViewTransition
  constructor() {
    super('pagereveal')
    this.viewTransition = new MockViewTransition()
  }
}

class MockPageSwapEvent extends Event {
  viewTransition: MockViewTransition
  constructor() {
    super('pageswap')
    this.viewTransition = new MockViewTransition()
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.register()
})

afterAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.unregister()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('controlDocument: initialization guard', () => {
  test('calling controlDocument does not throw', () => {
    expect(() => controlDocument()).not.toThrow()
  })

  test('calling controlDocument with onPageReveal does not throw', () => {
    const factory = (_trigger: unknown) => (_detail: unknown) => {}
    expect(() =>
      controlDocument({ onPageReveal: factory as Parameters<typeof controlDocument>[0]['onPageReveal'] }),
    ).not.toThrow()
  })
})

describe('controlDocument: pageswap event', () => {
  test('pageswap dispatched on window does not throw', async () => {
    controlDocument()
    await new Promise((r) => setTimeout(r, 50))

    // Dispatch a pageswap event
    expect(() => window.dispatchEvent(new MockPageSwapEvent())).not.toThrow()
  })
})

describe('controlDocument: pagereveal event', () => {
  test('pagereveal with onPageReveal factory calls handler', async () => {
    let called = false
    const factory = (_trigger: unknown) => (_detail: unknown) => {
      called = true
    }

    controlDocument({ onPageReveal: factory as Parameters<typeof controlDocument>[0]['onPageReveal'] })
    await new Promise((r) => setTimeout(r, 50))

    window.dispatchEvent(new MockPageRevealEvent())
    await new Promise((r) => setTimeout(r, 50))

    expect(called).toBe(true)
  })

  test('pagereveal without onPageReveal does not throw', async () => {
    controlDocument()
    await new Promise((r) => setTimeout(r, 50))

    expect(() => window.dispatchEvent(new MockPageRevealEvent())).not.toThrow()
  })
})

describe('controlDocument: DOCUMENT_EVENTS', () => {
  test('exports expected event keys', () => {
    expect(DOCUMENT_EVENTS.on_pagereveal).toBe('on_pagereveal')
    expect(DOCUMENT_EVENTS.on_pageswap).toBe('on_pageswap')
  })
})
