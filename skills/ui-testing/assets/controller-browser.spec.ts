// @ts-nocheck — reference file, imports resolve when fixtures/ exists
/**
 * Real browser tests using @playwright/cli.
 * Tests DOM behaviors through actual Chromium with a real WebSocket fixture server.
 *
 * The fixture server (serve.ts) acts as the agent — it responds to root_connected
 * with scripted WebSocket conversations tailored to each test element tag.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type FixtureServer, startServer } from './fixtures/serve.ts'

let fixture: FixtureServer
const SESSION = 'ui-test'

const cli = async (...args: string[]) => {
  const proc = Bun.spawn(['bunx', '@playwright/cli', `-s=${SESSION}`, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const text = await new Response(proc.stdout).text()
  await proc.exited
  return text.trim()
}

const parseResult = (output: string) => {
  // playwright-cli eval outputs results after "### Result" header
  const match = output.match(/### Result\n([\s\S]*?)(?:\n### |$)/)
  return match?.[1]?.trim() ?? output.trim()
}

/** Navigate to a test page and wait for WebSocket render. */
const gotoTest = async (path: string, waitMs = 3000) => {
  await cli('goto', `http://localhost:${fixture.port}${path}`)
  await new Promise((r) => setTimeout(r, waitMs))
}

beforeAll(async () => {
  fixture = startServer(0)

  // Open browser session (no URL yet — navigate after open)
  await cli('open')
  // Navigate to the control island fixture
  await gotoTest('/control-island.html')
}, 30000)

afterAll(async () => {
  try {
    await cli('close')
  } catch {
    // ignore close errors
  }
  await fixture.stop()
}, 30000)

// ─── Control Island: real browser ─────────────────────────────────────────────

describe('controlIsland: real browser', () => {
  test('display:contents computed style', async () => {
    const output = await cli(
      'eval',
      "() => { const el = document.querySelector('test-island'); return el ? getComputedStyle(el).display : 'not found'; }",
    )
    const result = parseResult(output)
    expect(result).toContain('contents')
  })

  test('customElements.get() confirms registration', async () => {
    const output = await cli('eval', "() => !!customElements.get('test-island')")
    const result = parseResult(output)
    expect(result).toContain('true')
  })

  test('custom element exists in DOM', async () => {
    const output = await cli('eval', "() => document.querySelector('test-island')?.tagName")
    const result = parseResult(output)
    expect(result).toContain('TEST-ISLAND')
  })

  test('p-target attribute is present on descendant', async () => {
    const output = await cli('eval', "() => document.querySelector('test-island [p-target]')?.getAttribute('p-target')")
    const result = parseResult(output)
    expect(result).toContain('main')
  })

  test('WebSocket roundtrip renders server content into DOM', async () => {
    // The fixture server responds to root_connected with RENDER_MESSAGE:
    // { type: 'render', detail: { target: 'main', html: '<div id="ws-rendered">Hello from WebSocket</div>' } }
    const output = await cli('eval', "() => document.getElementById('ws-rendered')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Hello from WebSocket')
  })

  test('setHTMLUnsafe does NOT execute inline scripts (browser limitation)', async () => {
    // Scripts inserted via setHTMLUnsafe, innerHTML, or any DOM parsing API are marked
    // "parser-inserted" by the HTML spec and will NOT execute. Only scripts created via
    // document.createElement('script') execute on append.
    // This confirms that update_behavioral + import(url) is the only path for dynamic
    // code loading — inline <script> tags in render messages are inert.
    const output = await cli(
      'eval',
      "() => { const t = document.createElement('template'); t.setHTMLUnsafe('<script>window.__inlineScriptRan = true</script>'); document.body.append(t.content); return window.__inlineScriptRan === true; }",
    )
    const result = parseResult(output)
    expect(result).toContain('false')
  })

  // ─── Property accessors (from control-island lifecycle) ──────────────────

  test('property setter reflects as attribute', async () => {
    // test-island has observedAttributes: ['value', 'label']
    // connectedCallback defines property accessors for these
    const output = await cli(
      'eval',
      "() => { const el = document.querySelector('test-island'); el.value = 'test123'; return el.getAttribute('value'); }",
    )
    const result = parseResult(output)
    expect(result).toContain('test123')
  })

  test('property getter reads from attribute', async () => {
    const output = await cli(
      'eval',
      "() => { const el = document.querySelector('test-island'); el.setAttribute('label', 'from-attr'); return el.label; }",
    )
    const result = parseResult(output)
    expect(result).toContain('from-attr')
  })
})

// ─── Swap modes ───────────────────────────────────────────────────────────────

describe('controller: swap modes', () => {
  test('all six swap modes produce correct DOM structure', async () => {
    // Navigate to swap-test page — server sends all 6 swap modes in sequence
    await gotoTest('/test/swap-test')

    // Expected DOM after all messages:
    // <swap-test>
    //   <span id="beforebegin-result">before main</span>
    //   <div p-target="main">
    //     <span id="afterbegin-result">first</span>
    //     <p id="inner-result">inner replaced</p>
    //     <span id="beforeend-result">last</span>
    //   </div>
    //   <span id="afterend-result">after main</span>
    //   <div id="outer-result" p-target="outer-target">outer replaced</div>
    // </swap-test>

    // innerHTML: original content replaced
    const innerResult = await cli('eval', "() => document.getElementById('inner-result')?.textContent")
    expect(parseResult(innerResult)).toContain('inner replaced')

    // afterbegin: prepended as first child
    const afterbeginResult = await cli(
      'eval',
      '() => document.querySelector(\'[p-target="main"]\')?.firstElementChild?.id',
    )
    expect(parseResult(afterbeginResult)).toContain('afterbegin-result')

    // beforeend: appended as last child
    const beforeendResult = await cli(
      'eval',
      '() => document.querySelector(\'[p-target="main"]\')?.lastElementChild?.id',
    )
    expect(parseResult(beforeendResult)).toContain('beforeend-result')

    // afterend: sibling after main
    const afterendResult = await cli('eval', "() => document.getElementById('afterend-result')?.textContent")
    expect(parseResult(afterendResult)).toContain('after main')

    // beforebegin: sibling before main
    const beforebeginResult = await cli('eval', "() => document.getElementById('beforebegin-result')?.textContent")
    expect(parseResult(beforebeginResult)).toContain('before main')

    // outerHTML: element replaced
    const outerResult = await cli('eval', "() => document.getElementById('outer-result')?.textContent")
    expect(parseResult(outerResult)).toContain('outer replaced')
  }, 30000)
})

// ─── Declarative Shadow DOM ───────────────────────────────────────────────────

describe('controller: declarative shadow DOM', () => {
  test('setHTMLUnsafe parses <template shadowrootmode> into shadowRoot', async () => {
    // Navigate to the swap fixture page — server sends DSD_RENDER_MESSAGE on root_connected
    await gotoTest('/swap-fixture.html')

    const output = await cli('eval', "() => !!document.getElementById('dsd-host')?.shadowRoot")
    const result = parseResult(output)
    expect(result).toContain('true')
  }, 30000)

  test('shadow DOM contains rendered content', async () => {
    const output = await cli(
      'eval',
      "() => document.getElementById('dsd-host')?.shadowRoot?.querySelector('p')?.textContent",
    )
    const result = parseResult(output)
    expect(result).toContain('shadow content')
  })
})

// ─── Attrs handler ────────────────────────────────────────────────────────────

describe('controller: attrs handler', () => {
  test('sets string, removes null, and toggles boolean attributes', async () => {
    // Navigate to attrs-test page — server sends attrs messages after root_connected
    await gotoTest('/test/attrs-test')

    // String attribute: class = 'active'
    const classResult = await cli('eval', "() => document.querySelector('[p-target=\"main\"]')?.getAttribute('class')")
    expect(parseResult(classResult)).toContain('active')

    // Removed attribute: data-removable should be gone
    const removedResult = await cli(
      'eval',
      "() => document.querySelector('[p-target=\"main\"]')?.hasAttribute('data-removable')",
    )
    expect(parseResult(removedResult)).toContain('false')

    // Boolean attribute: disabled should be present
    const boolResult = await cli(
      'eval',
      "() => document.querySelector('[p-target=\"main\"]')?.hasAttribute('disabled')",
    )
    expect(parseResult(boolResult)).toContain('true')

    // Number attribute: data-count = '42'
    const numResult = await cli(
      'eval',
      "() => document.querySelector('[p-target=\"main\"]')?.getAttribute('data-count')",
    )
    expect(parseResult(numResult)).toContain('42')
  }, 30000)
})

// ─── User action handler ──────────────────────────────────────────────────────

describe('controller: user_action', () => {
  test('p-trigger click is captured by server and triggers response render', async () => {
    // Navigate to action-test page — server renders a p-trigger button
    await gotoTest('/test/action-test')

    // Click the p-trigger button
    await cli('eval', "() => { document.getElementById('test-btn')?.click(); return 'clicked'; }")

    // Wait for the roundtrip: click → user_action → server render → DOM update
    await new Promise((r) => setTimeout(r, 2000))

    // Server responds with confirmation render
    const output = await cli('eval', "() => document.getElementById('action-confirmed')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Action received')
  }, 30000)

  test('server received the user_action message', () => {
    expect(fixture.lastUserAction).toBeDefined()
    expect((fixture.lastUserAction as Record<string, unknown>).detail).toBe('test_click')
  })
})

// ─── Retry behavior ───────────────────────────────────────────────────────────

describe('controller: WebSocket retry', () => {
  test('reconnects after server closes with 1012 (Service Restart)', async () => {
    // Navigate to retry-test page — server closes first connection with code 1012,
    // the controller retries with exponential backoff, second connection renders success
    await gotoTest('/test/retry-test', 5000)

    const output = await cli('eval', "() => document.getElementById('retry-success')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Reconnected!')
  }, 30000)
})

// ─── Update behavioral ───────────────────────────────────────────────────────

describe('controller: update_behavioral', () => {
  test('dynamic import() loads module and factory runs', async () => {
    // Navigate to behavioral fixture — server sends update_behavioral after root_connected
    await gotoTest('/behavioral-fixture.html')

    // The module sets window.__behavioralModuleLoaded = true in the factory
    const output = await cli('eval', '() => globalThis.__behavioralModuleLoaded === true')
    const result = parseResult(output)
    expect(result).toContain('true')
  }, 30000)

  test('behavioral_updated roundtrip: server receives confirmation and renders', async () => {
    // After the module loads, the controller sends behavioral_updated to the server.
    // The server responds with BEHAVIORAL_CONFIRMED_MESSAGE (render with id="behavioral-confirmed").
    const output = await cli('eval', "() => document.getElementById('behavioral-confirmed')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Module loaded successfully')
  })

  test('server received behavioral_updated with thread and handler names', () => {
    // Verify the server-side state captured the behavioral_updated message
    expect(fixture.lastBehavioralUpdated).toBeDefined()
    const detail = (fixture.lastBehavioralUpdated as Record<string, unknown>).detail as Record<string, unknown>
    expect(detail.threads).toContain('test_thread')
    expect(detail.handlers).toContain('test_handler')
  })
})
