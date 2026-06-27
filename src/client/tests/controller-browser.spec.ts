/**
 * Real-browser integration tests for the Controller.
 *
 * Uses @playwright/cli (Chromium) against the fixture server in ./fixtures/serve.ts.
 * Covers behaviors that need a real browser: live WebSocket, setHTMLUnsafe (incl.
 * declarative shadow DOM), computed styles, fetch-based form POST, page lifecycle,
 * and retry. Internal logic is covered by controller.spec.ts (happy-dom).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type FixtureServer, startServer } from './fixtures/serve.ts'

let fixture: FixtureServer | undefined
const SESSION = 'ui-test'
const BROWSER_NOT_OPEN_MESSAGE = `The browser '${SESSION}' is not open`
const BROWSER = '--browser=chromium'

const runCli = async (...args: string[]) => {
  const proc = Bun.spawn(['bunx', '@playwright/cli', `-s=${SESSION}`, ...args], { stdout: 'pipe', stderr: 'pipe' })
  setTimeout(() => proc.kill(), 20_000)
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  await proc.exited
  return `${stdout}${stderr}`.trim()
}

const cli = async (...args: string[]) => {
  const first = await runCli(...args)
  if (first.includes(BROWSER_NOT_OPEN_MESSAGE) && args[0] !== 'open' && args[0] !== 'close') {
    await runCli('open', BROWSER)
    return runCli(...args)
  }
  return first
}

const parseResult = (output: string) => {
  const match = output.match(/### Result\n([\s\S]*?)(?:\n### |$)/)
  return match?.[1]?.trim() ?? output.trim()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async <T>(read: () => T | undefined, timeoutMs = 5000): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  let value = read()
  while (value === undefined && Date.now() < deadline) {
    await wait(50)
    value = read()
  }
  if (value === undefined) throw new Error('Timed out waiting for browser fixture state.')
  return value
}

const getFixture = (): FixtureServer => {
  if (!fixture) throw new Error('Fixture server is not initialized.')
  return fixture
}

const goto = async (path: string, waitMs = 1000) => {
  await cli('goto', `http://localhost:${getFixture().port}${path}`)
  await wait(waitMs)
}

const evalJs = async (expr: string) => parseResult(await cli('eval', expr))

const findUiEvent = (type: string, source: string, after = 0) =>
  getFixture()
    .uiEvents.slice(after)
    .find((e) => e.source === source && (e.message.detail as { event?: { type?: string } })?.event?.type === type)

beforeAll(async () => {
  fixture = startServer(0)
  await cli('open', BROWSER)
  await goto('/control-island.html')
}, 30000)

afterAll(async () => {
  try {
    Bun.spawn(['bunx', '@playwright/cli', `-s=${SESSION}`, 'close'], { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    // ignore
  }
  if (fixture) {
    await fixture.stop()
    fixture = undefined
  }
}, 30000)

// ─── Basic roundtrip ─────────────────────────────────────────────────────────

describe('controller: real browser', () => {
  test('WebSocket render updates the DOM', async () => {
    await goto('/control-island.html')
    expect(await evalJs("() => document.getElementById('ws-rendered')?.textContent")).toContain('Hello from WebSocket')
  })

  test('server receives a snapshot on pageshow', async () => {
    await goto('/control-island.html')
    await waitFor(() => getFixture().snapshots.find((s) => s.source === 'test-island'))
    const snap = getFixture().snapshots.find((s) => s.source === 'test-island')!
    // The snapshot is captured at pageshow time, before the WebSocket render
    // arrives, so it reflects the initial DOM.
    expect((snap.message.detail as { serializedHTML: string }).serializedHTML).toContain('initial content')
    expect((snap.message.detail as { type: string }).type).toBe('pageshow')
  })
})

// ─── Swap modes ──────────────────────────────────────────────────────────────

describe('controller: swap modes', () => {
  test('all six swap modes produce the correct DOM structure', async () => {
    await goto('/test/swap-test', 1500)
    expect(await evalJs("() => document.getElementById('inner-result')?.textContent")).toContain('inner replaced')
    expect(await evalJs('() => document.querySelector(\'[p-target="main"]\')?.firstElementChild?.id')).toContain(
      'afterbegin-result',
    )
    expect(await evalJs('() => document.querySelector(\'[p-target="main"]\')?.lastElementChild?.id')).toContain(
      'beforeend-result',
    )
    expect(await evalJs("() => document.getElementById('afterend-result')?.textContent")).toContain('after main')
    expect(await evalJs("() => document.getElementById('beforebegin-result')?.textContent")).toContain('before main')
    expect(await evalJs("() => document.getElementById('outer-result')?.textContent")).toContain('outer replaced')
  }, 30000)
})

// ─── Declarative shadow DOM ──────────────────────────────────────────────────

describe('controller: declarative shadow DOM', () => {
  test('setHTMLUnsafe parses <template shadowrootmode> into a shadowRoot', async () => {
    await goto('/swap-fixture.html', 1500)
    expect(await evalJs("() => !!document.getElementById('dsd-host')?.shadowRoot")).toContain('true')
    expect(
      await evalJs("() => document.getElementById('dsd-host')?.shadowRoot?.querySelector('p')?.textContent"),
    ).toContain('shadow content')
  }, 30000)
})

// ─── Attrs ───────────────────────────────────────────────────────────────────

describe('controller: attrs', () => {
  test('sets string, removes null, toggles boolean, coerces number', async () => {
    await goto('/test/attrs-test', 1500)
    expect(await evalJs("() => document.querySelector('[p-target=\"main\"]')?.getAttribute('class')")).toContain(
      'active',
    )
    expect(
      await evalJs("() => document.querySelector('[p-target=\"main\"]')?.hasAttribute('data-removable')"),
    ).toContain('false')
    expect(await evalJs("() => document.querySelector('[p-target=\"main\"]')?.hasAttribute('disabled')")).toContain(
      'true',
    )
    expect(await evalJs("() => document.querySelector('[p-target=\"main\"]')?.getAttribute('data-count')")).toContain(
      '42',
    )
  }, 30000)
})

// ─── dispatch_custom_event ───────────────────────────────────────────────────

describe('controller: dispatch_custom_event', () => {
  test('dispatches a CustomEvent on the target with detail', async () => {
    await goto('/test/dispatch-test', 1500)
    // The page installs an app:ping listener before connect; the server
    // dispatches the event on open, captured into window.__pingDetail.
    expect(await evalJs('() => window.__pingDetail')).toContain('ok')
  }, 30000)
})

// ─── Stylesheets ─────────────────────────────────────────────────────────────

describe('controller: stylesheets', () => {
  test('adopts render stylesheets and applies computed styles', async () => {
    await goto('/test/styles-test', 1500)
    expect(await evalJs("() => getComputedStyle(document.getElementById('dynamic-style-target')).color")).toContain(
      'rgb(1, 2, 3)',
    )
    expect(
      await evalJs("() => getComputedStyle(document.getElementById('dynamic-style-secondary')).backgroundColor"),
    ).toContain('rgb(4, 5, 6)')
  }, 30000)
})

// ─── p-trigger roundtrip ─────────────────────────────────────────────────────

describe('controller: p-trigger', () => {
  test('click emits a ui_event and the server response renders', async () => {
    const before = getFixture().uiEvents.length
    await goto('/test/action-test', 1500)
    await cli('eval', "() => { document.getElementById('test-btn')?.click(); return 'clicked' }")
    await wait(500)
    expect(await evalJs("() => document.getElementById('action-confirmed')?.textContent")).toContain('Action received')
    const event = await waitFor(() => findUiEvent('test_click', 'action-test', before))
    const bpEvent = (event.message.detail as { event: { detail: Record<string, string> } }).event
    expect(bpEvent.detail.id).toBe('test-btn')
    expect(bpEvent.detail['p-trigger']).toBe('click:test_click')
  }, 30000)
})

// ─── Extensions ──────────────────────────────────────────────────────────────

describe('controller: extensions', () => {
  test('extension module is invoked for its matching p-trigger', async () => {
    await goto('/module-fixture.html', 1500)
    await cli('eval', "() => { document.getElementById('module-ext-btn')?.click(); return 'clicked' }")
    await wait(250)
    expect(await evalJs('() => globalThis.__extensionInvoked === true')).toContain('true')
  }, 30000)

  test('extension triggers a BP event received by the server', async () => {
    const before = getFixture().uiEvents.length
    await goto('/module-fixture.html', 1500)
    await cli('eval', "() => { document.getElementById('module-ext-btn')?.click(); return 'clicked' }")
    const event = await waitFor(() => findUiEvent('extension_action', 'module-fixture', before))
    const bpEvent = (event.message.detail as { event: { detail: Record<string, string> } }).event
    expect(bpEvent.detail.id).toBe('module-ext-btn')
    expect(bpEvent.detail['data-extra']).toBe('extension-listener')
  }, 30000)

  test('standard p-trigger still emits a BP event alongside extensions', async () => {
    const before = getFixture().uiEvents.length
    await goto('/module-fixture.html', 1500)
    await cli('eval', "() => { document.getElementById('module-p-trigger-btn')?.click(); return 'clicked' }")
    const event = await waitFor(() => findUiEvent('test_click', 'module-fixture', before))
    const bpEvent = (event.message.detail as { event: { detail: Record<string, string> } }).event
    expect(bpEvent.detail.id).toBe('module-p-trigger-btn')
    expect(bpEvent.detail['p-trigger']).toBe('click:test_click')
  }, 30000)
})

// ─── Form POST ───────────────────────────────────────────────────────────────

describe('controller: form submit', () => {
  test('submitting a form POSTs the field data to the form action endpoint', async () => {
    const before = getFixture().formPosts.length
    await goto('/test/form-test', 1500)
    await cli(
      'eval',
      "() => { const f = document.getElementById('controller-form'); if (f instanceof HTMLFormElement) f.requestSubmit(); return 'submitted' }",
    )
    const post = await waitFor(() => getFixture().formPosts.slice(before).at(-1))
    expect(post.trigger).toBe('register')
    expect(post.body.name).toBe('Ada')
    expect(post.body.tags).toEqual(['ui', 'controller'])
  }, 30000)
})

// ─── Retry ───────────────────────────────────────────────────────────────────

describe('controller: retry', () => {
  test('reconnects after a 1012 close and renders on the retried connection', async () => {
    await goto('/test/retry-test', 5000)
    expect(await evalJs("() => document.getElementById('retry-success')?.textContent")).toContain('Reconnected!')
  }, 30000)
})
