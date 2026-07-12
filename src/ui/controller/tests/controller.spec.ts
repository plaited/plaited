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
  setTimeout(() => proc.kill(), 60_000)
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
  if (!match) return { ok: false as const, value: undefined }
  const raw = (match[1] ?? '').trim()
  if (raw === '') return { ok: true as const, value: undefined }
  // The CLI serializes the JS return value as JSON (e.g. `"active"`, `0`,
  // `false`). Parse it back so callers receive the real type.
  try {
    return { ok: true as const, value: JSON.parse(raw) }
  } catch {
    return { ok: true as const, value: raw }
  }
}

const evalJs = async (expr: string) => {
  // Retry transient CLI failures (no `### Result` block — daemon busy or
  // browser briefly unavailable). A real `undefined` return emits a
  // `### Result\nundefined` block and is NOT retried.
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = await cli('eval', expr)
    const result = parseResult(out)
    if (result.ok) return result.value
    await sleep(200)
  }
  throw new Error(`evalJs: CLI returned no result after 5 attempts: ${expr}`)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Poll a browser read until it returns a value (or throws on timeout). */
const waitFor = async <T>(read: () => Promise<T | undefined>, timeoutMs = 8000): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  let value = await read()
  while (value === undefined && Date.now() < deadline) {
    await sleep(50)
    value = await read()
  }
  if (value === undefined) throw new Error('Timed out waiting for browser state.')
  return value
}

const goto = async (path: string) => {
  if (!fixture) throw new Error('Fixture server not started.')
  await cli('goto', `http://localhost:${fixture.port}${path}`)
  // Wait for the controller connect script to appear in the DOM, confirming
  // the full page HTML has been parsed (body content + script tags).
  await waitFor(async () => {
    const has = await evalJs('() => !!document.querySelector("script[src*=\'.plaited/connect\']")')
    return has === true ? true : undefined
  }, 8_000)
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
  }, 20_000)

  test('does not inject an @view-transition fallback (stylesheet feature removed)', async () => {
    // control-island.html ships no @view-transition rule. The controller no
    // longer injects one (the stylesheet-adoption feature is removed), so no
    // stylesheet — static or adopted — should contain the rule after connect.
    await goto('/control-island.html')
    // Give any would-be injection time to run; the controller's connect path
    // is synchronous after the connect script loads.
    await sleep(500)
    const count = await evalJs(
      "() => Array.from(document.styleSheets).concat(document.adoptedStyleSheets).reduce((n, s) => { try { return n + Array.from(s.cssRules).filter(r => r.cssText.includes('@view-transition')).length } catch { return n } }, 0)",
    )
    expect(Number(count)).toBe(0)
  }, 20_000)
})

// ─── Render swap modes ──────────────────────────────────────────────────────

describe('controller: render swap modes', () => {
  test('all six swap modes produce the correct DOM structure', async () => {
    await goto('/test/swap-test')
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
    await goto('/test/action-test')
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
    await goto('/test/attrs-test')
    const sel = "() => document.querySelector('[p-target=main]')"
    await waitFor(async () => {
      const cls = await evalJs(`${sel}?.getAttribute('class')`)
      return cls?.includes('active') ? true : undefined
    }, 5000)
    expect(await evalJs(`${sel}?.getAttribute('class')`)).toContain('active')
    expect(await evalJs(`${sel}?.hasAttribute('data-removable')`)).toBe(false)
    expect(await evalJs(`${sel}?.hasAttribute('disabled')`)).toBe(true)
    expect(await evalJs(`${sel}?.getAttribute('data-count')`)).toBe('42')
  }, 15000)
})

// ─── All-matches targeting (querySelectorAll) ──────────────────────────────

describe('controller: all-matches targeting', () => {
  test('attrs applies to every element with the matching p-target', async () => {
    // attrs-multi ships three [p-target="card"]; one attrs command must set the
    // class on all of them (querySelectorAll, not querySelector first-match).
    await goto('/test/attrs-multi')
    await waitFor(async () => {
      const n = await evalJs(
        "() => Array.from(document.querySelectorAll('[p-target=card]')).filter(el => el.classList.contains('active')).length",
      )
      return n === 3 ? n : undefined
    }, 10_000)
    const count = await evalJs(
      "() => Array.from(document.querySelectorAll('[p-target=card]')).filter(el => el.classList.contains('active')).length",
    )
    expect(count).toBe(3)
  }, 20_000)

  test('render (innerHTML) applies to every element with the matching p-target', async () => {
    // render-multi ships two [p-target="slot"]; an innerHTML render must
    // replace the inner content of both, not just the first.
    await goto('/test/render-multi')
    await waitFor(async () => {
      const n = await evalJs(
        "() => Array.from(document.querySelectorAll('[p-target=slot]')).filter(el => el.textContent?.includes('filled')).length",
      )
      return n === 2 ? n : undefined
    }, 10_000)
    const count = await evalJs(
      "() => Array.from(document.querySelectorAll('[p-target=slot]')).filter(el => el.textContent?.includes('filled')).length",
    )
    expect(count).toBe(2)
  }, 20_000)

  test('match param (^=) targets every element whose p-target starts with the prefix', async () => {
    // render-prefix ships [p-target="user-name"], [p-target="user-email"],
    // and [p-target="other"]. A render with match='^=' and target='user' must
    // fill the two user-* slots and leave 'other' untouched.
    await goto('/test/render-prefix')
    await waitFor(async () => {
      const n = await evalJs(
        "() => Array.from(document.querySelectorAll('[p-target^=user]')).filter(el => el.textContent?.includes('hi')).length",
      )
      return n === 2 ? n : undefined
    }, 10_000)
    const filled = await evalJs(
      "() => Array.from(document.querySelectorAll('[p-target^=user]')).filter(el => el.textContent?.includes('hi')).length",
    )
    expect(filled).toBe(2)
    const other = await evalJs("() => document.querySelector('[p-target=other]')?.textContent")
    expect(other).toContain('untouched')
  }, 20_000)
})

// ─── dispatch_custom_event handler ───────────────────────────────────────────

describe('controller: dispatch_custom_event handler', () => {
  test('dispatches a CustomEvent on the target with detail', async () => {
    await goto('/test/dispatch-test')
    const detail = await waitFor(async () => {
      const d = await evalJs('() => window.__pingDetail')
      return d && d !== 'null' && d !== 'undefined' ? d : undefined
    }, 5000)
    expect(detail).toContain('ok')
    expect(detail).toContain('true')
  }, 15000)
})

// ─── Navigate handler ────────────────────────────────────────────────────────

describe('controller: navigate handler', () => {
  test('navigates the browser to the given url via assign', async () => {
    await goto('/test/navigate-test')
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
    await goto('/test/action-test')
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
    await goto('/module-fixture.html')
    await waitFor(async () => {
      const has = await evalJs("() => !!document.getElementById('module-ext-btn')")
      return has ? true : undefined
    }, 5000)
    await evalJs("() => document.getElementById('module-ext-btn').click()")
    const ev = await waitFor(
      () => Promise.resolve(getFixture().uiEvents.find((e) => e.source === 'module-fixture')),
      5000,
    )
    // The extension received the DOM event (a click on module-ext-btn) and the
    // trigger fn — the full { event, trigger } extension contract — and used
    // them to emit a BP event carrying the element's id.
    const detail = ev.message.detail as { event?: { type?: string; detail?: Record<string, unknown> } }
    expect(detail.event?.type).toBe('extension_action')
    expect(detail.event?.detail?.id).toBe('module-ext-btn')
  }, 20000)

  test('standard p-trigger still emits a BP event alongside extensions', async () => {
    await goto('/module-fixture.html')
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
    await goto('/test/form-test')
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
    await goto('/test/retry-test')
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
    await goto('/test/attrs-test')
    await waitFor(() => Promise.resolve(getFixture().successes.find((s) => s.source === 'attrs-test')), 8000)
    const acks = getFixture().successes.filter((s) => s.source === 'attrs-test')
    expect(acks.length).toBeGreaterThanOrEqual(1)
  }, 15000)

  test('server receives a snapshot on pageshow', async () => {
    await goto('/test/lifecycle-test')
    const snap = await waitFor(
      () => Promise.resolve(getFixture().snapshots.find((s) => s.source === 'lifecycle-test')),
      5000,
    )
    expect((snap.message.detail as { type?: string }).type).toBe('pageshow')
    // The stylesheet-adoption feature is removed; snapshots no longer carry
    // adoptedStyleSheets (only serializedHTML). Guard the schema contract.
    expect((snap.message.detail as { adoptedStyleSheets?: unknown }).adoptedStyleSheets).toBeUndefined()
  }, 15000)
})
