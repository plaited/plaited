/**
 * Layer 2: Real browser tests using @playwright/cli.
 * Tests DOM behaviors that happy-dom cannot simulate:
 * - display:contents computed style
 * - customElements.get() registration
 *
 * WebSocket roundtrip and declarative shadow DOM tests are not yet implemented.
 * The useSnapshot → send → connect recursion bug has been fixed (snapshot callback
 * now bypasses send() and writes directly when socket is open), so these can be
 * added when needed.
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
  // Wait for the page to load and the custom element to register.
  // The script will throw a stack overflow in connectedCallback (known bug),
  // but element registration and CSS still work.
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

  test('p-target attribute is present on element', async () => {
    const output = await cli('eval', "() => document.querySelector('test-island')?.getAttribute('p-target')")
    const result = parseResult(output)
    expect(result).toContain('main')
  })
})

// TODO: Add WebSocket roundtrip and declarative shadow DOM browser tests.
// The useSnapshot recursion bug is fixed — these can now be implemented.
