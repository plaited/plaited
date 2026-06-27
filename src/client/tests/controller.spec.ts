/**
 * Controller tests.
 *
 * Single observable interface: the {@link Controller} running on a real web page.
 *
 * A Bun HTTP + WebSocket fixture server (./fixtures/serve.ts) serves SSR'd pages
 * that load the bundled controller and drives them with scripted server messages
 * over a real WebSocket. A real browser (playwright-cli / Chromium) loads the
 * page; assertions read the DOM and the server-captured client messages
 * (ui_event, error, success, snapshot, form posts).
 *
 * No happy-dom, no FakeWebSocket. The controller is tested in the environment
 * it ships in.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type FixtureServer, startServer } from './fixtures/serve.ts'

let fixture: FixtureServer | undefined
const SESSION = 'controller-test'
const BROWSER_NOT_OPEN = `The browser '${SESSION}' is not open`
const BROWSER = '--browser=chromium'

const runCli = async (...args: string[]) => {
  const proc = Bun.spawn(['bunx', '@playwright/cli', `-s=${SESSION}`, ...args], { stdout: 'pipe', stderr: 'pipe' })
  setTimeout(() => proc.kill(), 30_000)
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  await proc.exited
  return `${stdout}${stderr}`.trim()
}

const cli = async (...args: string[]) => {
  const first = await runCli(...args)
  if (first.includes(BROWSER_NOT_OPEN) && args[0] !== 'open' && args[0] !== 'close') {
    await runCli('open', BROWSER)
    return runCli(...args)
  }
  return first
}

const parseResult = (output: string) => {
  const match = output.match(/### Result\n([\s\S]*?)(?:\n### |$)/)
  return match?.[1]?.trim() ?? output.trim()
}

const evalJs = async (expr: string) => parseResult(await cli('eval', expr))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Poll a browser read until it returns a value (or throws on timeout). */
const waitFor = async <T>(read: () => Promise<T | undefined>, timeoutMs = 8000): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  let value = await read()
  while (value === undefined && Date.now() < deadline) {
    await wait(50)
    value = await read()
  }
  if (value === undefined) throw new Error('Timed out waiting for browser state.')
  return value
}

const goto = async (path: string, waitMs = 500) => {
  if (!fixture) throw new Error('Fixture server not started.')
  await cli('goto', `http://localhost:${fixture.port}${path}`)
  await wait(waitMs)
}

const getFixture = (): FixtureServer => {
  if (!fixture) throw new Error('Fixture server is not initialized.')
  return fixture
}

beforeAll(async () => {
  fixture = startServer(0)
  await cli('open', BROWSER)
}, 30000)

afterAll(async () => {
  try {
    await runCli('close')
  } catch {
    // ignore
  }
  if (fixture) {
    await fixture.stop()
    fixture = undefined
  }
}, 15000)

// ─── Connect & render ────────────────────────────────────────────────────────

describe('controller: connect & render', () => {
  test('page loads the bundled controller, connects, and renders a server message', async () => {
    await goto('/control-island.html')
    // The server sends a render on open; the DOM must reflect it.
    const text = await waitFor(async () => {
      const t = await evalJs("() => document.getElementById('ws-rendered')?.textContent")
      return t && t !== 'undefined' ? t : undefined
    })
    expect(text).toContain('Hello from WebSocket')
  })

  test('injects the @view-transition fallback when the page ships no such rule', async () => {
    // control-island.html has no @view-transition style; the controller must add it
    // (to adoptedStyleSheets, since #updateDocumentStyles uses adopted sheets).
    await goto('/control-island.html')
    const hasRule = await waitFor(async () => {
      const r = await evalJs(
        "() => String(Array.from(document.styleSheets).concat(document.adoptedStyleSheets).some(s => { try { return Array.from(s.cssRules).some(r => r.cssText.includes('@view-transition')) } catch { return false } }))",
      )
      return r?.includes('true') ? true : undefined
    })
    expect(hasRule).toBe(true)
  })

  test('does not duplicate the @view-transition rule when the page already ships one', async () => {
    // view-transition-fixture.html includes the rule in a <style>; the controller
    // must detect it and skip re-injecting.
    await goto('/view-transition-fixture.html')
    await wait(1000)
    const count = await evalJs(
      "() => Array.from(document.styleSheets).concat(document.adoptedStyleSheets).reduce((n, s) => { try { return n + Array.from(s.cssRules).filter(r => r.cssText.includes('@view-transition')).length } catch { return n } }, 0)",
    )
    expect(Number(count)).toBe(1)
  })
})

// ─── Render swap modes ──────────────────────────────────────────────────────

describe('controller: render swap modes', () => {
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
  }, 15000)

  test('binds triggers on swapped-in fragments', async () => {
    // The action-test fixture renders a button with a p-trigger; clicking it
    // must emit a ui_event the server receives and acknowledge with a render.
    await goto('/test/action-test', 1500)
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('test-btn')")
      return has ? true : undefined
    }, 5000)
    await evalJs("() => document.getElementById('test-btn').click()")
    await waitFor(async () => getFixture().uiEvents.find((e) => e.source === 'action-test'), 5000)
    const ev = getFixture().uiEvents.find((e) => e.source === 'action-test')
    expect((ev?.message as { detail?: { event?: { type?: string } } })?.detail?.event?.type).toBe('test_click')
  }, 20000)
})

// ─── Attrs handler ───────────────────────────────────────────────────────────

describe('controller: attrs handler', () => {
  test('sets string, removes null, toggles boolean, coerces number', async () => {
    await goto('/test/attrs-test', 500)
    const sel = "() => document.querySelector('[p-target=main]')"
    await waitFor(async () => {
      const cls = await evalJs(`${sel}?.getAttribute('class')`)
      return cls?.includes('active') ? true : undefined
    }, 5000)
    expect(await evalJs(`${sel}?.getAttribute('class')`)).toContain('active')
    expect(await evalJs(`${sel}?.hasAttribute('data-removable')`)).toContain('false')
    expect(await evalJs(`${sel}?.hasAttribute('disabled')`)).toContain('true')
    expect(await evalJs(`${sel}?.getAttribute('data-count')`)).toContain('42')
  }, 15000)
})

// ─── dispatch_custom_event handler ───────────────────────────────────────────

describe('controller: dispatch_custom_event handler', () => {
  test('dispatches a CustomEvent on the target with detail', async () => {
    await goto('/test/dispatch-test', 500)
    const detail = await waitFor(async () => {
      const d = await evalJs('() => window.__pingDetail')
      return d && d !== 'null' && d !== 'undefined' ? d : undefined
    }, 5000)
    expect(detail).toContain('ok')
    expect(detail).toContain('true')
  }, 15000)
})

// ─── Document stylesheets ────────────────────────────────────────────────────

describe('controller: document stylesheets', () => {
  test('adopts render stylesheets and applies computed styles', async () => {
    await goto('/test/styles-test', 1500)
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('dynamic-style-target')")
      return has ? true : undefined
    }, 5000)
    const color = await evalJs("() => getComputedStyle(document.getElementById('dynamic-style-target')).color")
    expect(color).toContain('rgb(1, 2, 3)')
  }, 15000)
})

// ─── Navigate handler ────────────────────────────────────────────────────────

describe('controller: navigate handler', () => {
  test('navigates the browser to the given url via assign', async () => {
    await goto('/test/navigate-test', 500)
    // The server sends a navigate to /test/swap-test; the browser must follow it.
    const url = await waitFor(async () => {
      const u = await evalJs('() => window.location.pathname')
      return u?.includes('swap-test') ? u : undefined
    }, 5000)
    expect(url).toContain('/test/swap-test')
  }, 15000)
})

// ─── p-trigger routing ──────────────────────────────────────────────────────

describe('controller: p-trigger routing', () => {
  test('click emits a ui_event with the action type and element attributes', async () => {
    await goto('/test/action-test', 500)
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('test-btn')")
      return has ? true : undefined
    }, 5000)
    const before = getFixture().uiEvents.filter((e) => e.source === 'action-test').length
    await evalJs("() => document.getElementById('test-btn').click()")
    const ev = await waitFor(
      () =>
        Promise.resolve(
          getFixture()
            .uiEvents.filter((e) => e.source === 'action-test')
            .slice(before)
            .find((e) => (e.message.detail as { event?: { type?: string } }).event?.type === 'test_click'),
        ),
      5000,
    )
    const detail = ev.message.detail as { event?: { type?: string; detail?: Record<string, unknown> } }
    expect(detail.event?.type).toBe('test_click')
    // The trigger detail carries the element's attributes.
    expect(detail.event?.detail?.['p-trigger']).toBe('click:test_click')
    expect(detail.event?.detail?.id).toBe('test-btn')
  }, 20000)
})

// ─── Extensions ─────────────────────────────────────────────────────────────

describe('controller: extensions', () => {
  test('extension module is invoked for its matching p-trigger and triggers a BP event', async () => {
    await goto('/module-fixture.html', 1500)
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('module-ext-btn')")
      return has ? true : undefined
    }, 5000)
    await evalJs("() => document.getElementById('module-ext-btn').click()")
    const ev = await waitFor(
      () => Promise.resolve(getFixture().uiEvents.find((e) => e.source === 'module-fixture')),
      5000,
    )
    expect((ev.message.detail as { event?: { type?: string } }).event?.type).toBe('extension_action')
  }, 20000)

  test('standard p-trigger still emits a BP event alongside extensions', async () => {
    await goto('/module-fixture.html', 1500)
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('module-p-trigger-btn')")
      return has ? true : undefined
    }, 5000)
    await evalJs("() => document.getElementById('module-p-trigger-btn').click()")
    const ev = await waitFor(
      () =>
        Promise.resolve(
          getFixture().uiEvents.find(
            (e) =>
              e.source === 'module-fixture' &&
              (e.message.detail as { event?: { type?: string } }).event?.type === 'test_click',
          ),
        ),
      5000,
    )
    expect(ev).toBeDefined()
  }, 20000)
})

// ─── Form submit ────────────────────────────────────────────────────────────

describe('controller: form submit', () => {
  test('POSTs the form data to the server with the p-form-trigger header', async () => {
    await goto('/test/form-test', 500)
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('controller-form')")
      return has ? true : undefined
    }, 5000)
    await evalJs("() => document.querySelector('#controller-form button[type=submit]').click()")
    const post = await waitFor(() => Promise.resolve(getFixture().formPosts.at(-1)), 5000)
    expect(post.trigger).toBe('register')
    expect(post.body.name).toBe('Ada')
    expect(post.body.tags).toEqual(['ui', 'controller'])
  }, 20000)
})

// ─── WebSocket retry ────────────────────────────────────────────────────────

describe('controller: WebSocket retry', () => {
  test('reconnects after a retryable close code and renders on the retried connection', async () => {
    await goto('/test/retry-test', 500)
    const text = await waitFor(async () => {
      const t = await evalJs("() => document.getElementById('retry-success')?.textContent")
      return t && t !== 'undefined' ? t : undefined
    }, 10000)
    expect(text).toContain('Reconnected')
  }, 20000)
})

// ─── Error reporting & success acks ─────────────────────────────────────────

describe('controller: error reporting & success acks', () => {
  test('acks a successful server message with a success envelope', async () => {
    // attrs-test sends 4 attrs messages, each acked.
    await goto('/test/attrs-test', 500)
    await waitFor(() => Promise.resolve(getFixture().successes.find((s) => s.source === 'attrs-test')), 8000)
    const acks = getFixture().successes.filter((s) => s.source === 'attrs-test')
    expect(acks.length).toBeGreaterThanOrEqual(1)
  }, 15000)

  test('server receives a snapshot on pageshow', async () => {
    await goto('/test/lifecycle-test', 500)
    const snap = await waitFor(
      () => Promise.resolve(getFixture().snapshots.find((s) => s.source === 'lifecycle-test')),
      5000,
    )
    expect((snap.message.detail as { type?: string }).type).toBe('pageshow')
  }, 15000)
})
