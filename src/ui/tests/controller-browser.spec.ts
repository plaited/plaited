/**
 * Layer 2: Real browser tests using @playwright/cli.
 * Tests DOM behaviors that happy-dom cannot simulate:
 * - display:contents computed style
 * - customElements.get() registration
 * - WebSocket roundtrip (server → render → DOM)
 * - setHTMLUnsafe with declarative shadow DOM
 * - update_behavioral dynamic import() roundtrip
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

beforeAll(async () => {
  fixture = startServer(0)

  // Open browser session (no URL yet — navigate after open)
  await cli('open')
  // Navigate to the control island fixture
  await cli('goto', `http://localhost:${fixture.port}/control-island.html`)
  // Wait for page load, custom element registration, WebSocket connect,
  // and server render response (root_connected → RENDER_MESSAGE).
  await new Promise((r) => setTimeout(r, 3000))
}, 30000)

afterAll(async () => {
  try {
    await cli('close')
  } catch {
    // ignore close errors
  }
  await fixture.stop()
})

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
})

describe('controller: declarative shadow DOM', () => {
  test('setHTMLUnsafe parses <template shadowrootmode> into shadowRoot', async () => {
    // Navigate to the swap fixture page — server sends DSD_RENDER_MESSAGE on root_connected
    await cli('goto', `http://localhost:${fixture.port}/swap-fixture.html`)
    await new Promise((r) => setTimeout(r, 3000))

    const output = await cli('eval', "() => !!document.getElementById('dsd-host')?.shadowRoot")
    const result = parseResult(output)
    expect(result).toContain('true')
  })

  test('shadow DOM contains rendered content', async () => {
    const output = await cli(
      'eval',
      "() => document.getElementById('dsd-host')?.shadowRoot?.querySelector('p')?.textContent",
    )
    const result = parseResult(output)
    expect(result).toContain('shadow content')
  })
})

describe('controller: update_behavioral', () => {
  test('dynamic import() loads module and factory runs', async () => {
    // Navigate to behavioral fixture — server sends update_behavioral after root_connected
    await cli('goto', `http://localhost:${fixture.port}/behavioral-fixture.html`)
    await new Promise((r) => setTimeout(r, 3000))

    // The module sets window.__behavioralModuleLoaded = true in the factory
    const output = await cli('eval', '() => globalThis.__behavioralModuleLoaded === true')
    const result = parseResult(output)
    expect(result).toContain('true')
  })

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
