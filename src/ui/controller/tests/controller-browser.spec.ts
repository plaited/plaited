/**
 * Real browser tests using @playwright/cli.
 * Tests DOM behaviors through actual Chromium with a real WebSocket fixture server.
 *
 * The fixture server (serve.ts) acts as the agent. It responds to WebSocket opens
 * with scripted WebSocket conversations tailored to each test element tag.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type FixtureServer, startServer } from './fixtures/serve.ts'

let fixture: FixtureServer | undefined
const SESSION = 'ui-test'
const BROWSER_NOT_OPEN_MESSAGE = `The browser '${SESSION}' is not open`

const runCli = async (...args: string[]) => {
  const proc = Bun.spawn(['bunx', '@playwright/cli', `-s=${SESSION}`, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timeoutId = setTimeout(() => {
    proc.kill()
  }, 20_000)

  try {
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    await proc.exited
    return `${stdout}${stderr}`.trim()
  } finally {
    clearTimeout(timeoutId)
  }
}

const cli = async (...args: string[]) => {
  const first = await runCli(...args)
  if (first.includes(BROWSER_NOT_OPEN_MESSAGE) && args[0] !== 'open' && args[0] !== 'close') {
    await runCli('open')
    return runCli(...args)
  }
  return first
}

const parseResult = (output: string) => {
  // playwright-cli eval outputs results after "### Result" header
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
  if (value === undefined) {
    throw new Error('Timed out waiting for browser fixture state.')
  }
  return value
}

const getFixture = (): FixtureServer => {
  if (!fixture) {
    throw new Error('Fixture server is not initialized.')
  }
  return fixture
}

const findUiEvent = ({ after = 0, source, type }: { after?: number; source: string; type: string }) => {
  return getFixture()
    .uiEvents.slice(after)
    .find((event) => {
      const detail = event.message.detail as Record<string, unknown> | undefined
      return event.source === source && detail?.type === type
    })
}

const findError = ({ after = 0, source }: { after?: number; source: string }) => {
  return getFixture()
    .errors.slice(after)
    .find((error) => error.source === source)
}

const findFormSubmit = ({ after = 0, source }: { after?: number; source: string }) => {
  return getFixture()
    .formSubmissions.slice(after)
    .find((submission) => submission.source === source)
}

/** Navigate to a test page and wait for WebSocket render. */
const gotoTest = async (path: string, waitMs = 3000) => {
  const activeFixture = getFixture()
  await cli('goto', `http://localhost:${activeFixture.port}${path}`)
  await new Promise((r) => setTimeout(r, waitMs))
}

beforeAll(async () => {
  fixture = startServer(0)

  // Open browser session (no URL yet — navigate after open)
  await cli('open')
  // Navigate to the base controller island fixture.
  await gotoTest('/control-island.html')
}, 30000)

afterAll(async () => {
  try {
    Bun.spawn(['bunx', '@playwright/cli', `-s=${SESSION}`, 'close'], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
  } catch {
    // ignore close errors
  }
  if (fixture) {
    await fixture.stop()
    fixture = undefined
  }
}, 30000)

// ─── Controller runtime: real browser ─────────────────────────────────────────

describe('useController: real browser', () => {
  test('display:contents computed style', async () => {
    const output = await cli(
      'eval',
      "() => { const el = document.querySelector('test-island'); return el ? getComputedStyle(el).display : 'not found'; }",
    )
    const result = parseResult(output)
    expect(result).toContain('contents')
  })

  test('registers the custom element', async () => {
    const output = await cli(
      'eval',
      "() => { const ctor = customElements.get('test-island'); const el = document.querySelector('test-island'); return !!ctor && el instanceof ctor; }",
    )
    const result = parseResult(output)
    expect(result).toContain('true')
  })

  test('registers custom elements from render registry', async () => {
    const output = await cli(
      'eval',
      "() => document.getElementById('registered-child')?.customElementRegistry === null",
    )
    const result = parseResult(output)
    expect(result).toContain('false')
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
    // The fixture server responds to the WebSocket open with a render message that omits
    // swap, so the controller's default innerHTML swap path is exercised here.
    const output = await cli('eval', "() => document.getElementById('ws-rendered')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Hello from WebSocket')
  })

  test('setHTMLUnsafe does NOT execute inline scripts (browser limitation)', async () => {
    // Scripts inserted via setHTMLUnsafe, innerHTML, or any DOM parsing API are marked
    // "parser-inserted" by the HTML spec and will NOT execute. Only scripts created via
    // document.createElement('script') execute on append.
    // This confirms that controller import messages are the code-loading path for dynamic
    // code loading — inline <script> tags in render messages are inert.
    const output = await cli(
      'eval',
      "() => { const t = document.createElement('template'); t.setHTMLUnsafe('<script>window.__inlineScriptRan = true</script>'); document.body.append(t.content); return window.__inlineScriptRan === true; }",
    )
    const result = parseResult(output)
    expect(result).toContain('false')
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
    // Navigate to the swap fixture page — server sends DSD_RENDER_MESSAGE on client_connected
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

// ─── Document stylesheets ────────────────────────────────────────────────────

describe('controller: document stylesheets', () => {
  test('adopts render stylesheets once per document', async () => {
    await gotoTest('/test/styles-test')

    const output = await cli(
      'eval',
      `() => {
        const target = document.getElementById('dynamic-style-target')
        const secondary = document.getElementById('dynamic-style-secondary')
        const rules = Array.from(document.adoptedStyleSheets)
          .map((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText).join(''))
          .join('|')
        return [
          document.adoptedStyleSheets.length,
          target ? getComputedStyle(target).color : 'missing',
          secondary ? getComputedStyle(secondary).backgroundColor : 'missing',
          rules,
        ].join('|')
      }`,
    )
    const result = parseResult(output)
    expect(result).toContain('2|rgb(1, 2, 3)|rgb(4, 5, 6)')
    expect(result).toContain('.dynamic-style-target')
    expect(result).toContain('.dynamic-style-secondary')
  }, 30000)

  test('reports stylesheet adoption errors and continues with valid stylesheets', async () => {
    const before = getFixture().errors.length
    await gotoTest('/test/style-error-test')

    const error = await waitFor(() => findError({ after: before, source: 'style-error-test' }))
    const detail = error.message.detail as Record<string, unknown>
    expect(String(detail.message)).toContain('fixture stylesheet rejection')
    expect(detail.kind).toBe('stylesheet_error')
    expect(detail.context).toEqual(
      expect.objectContaining({
        stylesheetLength: expect.any(Number),
      }),
    )

    const output = await cli(
      'eval',
      "() => { const target = document.getElementById('style-error-target'); return target ? getComputedStyle(target).color : 'missing'; }",
    )
    expect(parseResult(output)).toContain('rgb(7, 8, 9)')
  }, 30000)
})

// ─── Attrs handler ────────────────────────────────────────────────────────────

describe('controller: attrs handler', () => {
  test('sets string, removes null, and toggles boolean attributes', async () => {
    // Navigate to attrs-test page — server sends attrs messages after client_connected
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

// ─── UI event handler ─────────────────────────────────────────────────────────

describe('controller: ui_event', () => {
  test('p-trigger click is captured by server and triggers response render', async () => {
    // Navigate to action-test page — server renders a p-trigger button
    await gotoTest('/test/action-test')

    // Click the p-trigger button
    await cli('eval', "() => { document.getElementById('test-btn')?.click(); return 'clicked'; }")

    // Wait for the roundtrip: click -> ui_event -> server render -> DOM update
    await wait(500)

    // Server responds with confirmation render
    const output = await cli('eval', "() => document.getElementById('action-confirmed')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Action received')
  }, 30000)

  test('server received the ui_event message with the p-trigger BP event envelope', () => {
    const activeFixture = getFixture()
    expect(activeFixture.lastUiEvent).toBeDefined()
    const event = activeFixture.lastUiEvent!
    expect(event.source).toBe('action-test')
    expect(event.message.type).toBe('ui_event')
    const detail = event.message.detail as Record<string, unknown>
    expect(detail.type).toBe('test_click')
    const attrs = detail.detail as Record<string, unknown>
    expect(attrs.id).toBe('test-btn')
    expect(attrs['p-trigger']).toBe('click:test_click')
  })
})

// ─── Form submit handler ─────────────────────────────────────────────────────

describe('controller: form_submit', () => {
  test('submitting a form emits a top-level form_submit client message', async () => {
    const before = getFixture().formSubmissions.length
    await gotoTest('/test/form-submit-test')

    await cli(
      'eval',
      "() => { const form = document.getElementById('controller-form'); if (!(form instanceof HTMLFormElement)) return 'missing'; form.requestSubmit(); return 'submitted'; }",
    )

    const submission = await waitFor(() => findFormSubmit({ after: before, source: 'form-submit-test' }))
    expect(submission.message.type).toBe('form_submit')
    expect(submission.message.detail).toEqual({
      id: 'controller-form',
      action: `http://localhost:${getFixture().port}/submit-form`,
      method: 'post',
      data: {
        name: 'Ada',
        tags: ['ui', 'controller'],
      },
    })
  }, 30000)
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

// ─── Module imports ───────────────────────────────────────────────────────────

describe('controller: import', () => {
  test('dynamic import() invokes default controller module callbacks', async () => {
    // Navigate to module fixture; the server sends an import command after connection.
    await gotoTest('/module-fixture.html')

    // The module sets window.__controllerModuleLoaded = true in the default callback.
    const output = await cli('eval', '() => globalThis.__controllerModuleLoaded === true')
    const result = parseResult(output)
    expect(result).toContain('true')
  }, 30000)

  test('reports import_invoked after the module default callback finishes', async () => {
    const before = getFixture().uiEvents.length
    await gotoTest('/module-fixture.html')

    const event = await waitFor(() => findUiEvent({ after: before, source: 'module-fixture', type: 'import_invoked' }))
    const detail = event.message.detail as Record<string, unknown>
    expect(detail.detail).toEqual({ path: '/dist/modules/controller-module.js' })
  }, 30000)

  test('p-trigger actions are sent as BP events with an attribute detail map', async () => {
    const before = getFixture().uiEvents.length
    await gotoTest('/module-fixture.html')

    await cli('eval', "() => { document.getElementById('module-p-trigger-btn')?.click(); return 'clicked'; }")

    const event = await waitFor(() => findUiEvent({ after: before, source: 'module-fixture', type: 'test_click' }))
    const detail = event.message.detail as Record<string, unknown>
    const attrs = detail.detail as Record<string, unknown>
    expect(attrs.id).toBe('module-p-trigger-btn')
    expect(attrs['data-extra']).toBe('p-trigger-attr')
    expect(attrs['p-trigger']).toBe('click:test_click')
  }, 30000)

  test('imported modules can register delegated listeners and trigger BP events', async () => {
    const before = getFixture().uiEvents.length
    await gotoTest('/module-fixture.html')

    await cli('eval', "() => { document.getElementById('module-enhanced-btn')?.click(); return 'clicked'; }")

    const event = await waitFor(() =>
      findUiEvent({ after: before, source: 'module-fixture', type: 'controller_module_click' }),
    )
    const count = await cli('eval', '() => globalThis.__controllerModuleHandlerCallCount ?? 0')
    expect(parseResult(count)).toContain('1')
    const detail = event.message.detail as Record<string, unknown>
    expect(detail.detail).toEqual({ id: 'module-enhanced-btn', 'data-extra': 'module-listener' })
  }, 30000)

  test('disconnect runs cleanup callbacks registered by imported modules', async () => {
    await gotoTest('/module-fixture.html')

    const loaded = await cli('eval', '() => globalThis.__controllerModuleLoaded === true')
    expect(parseResult(loaded)).toContain('true')

    await cli('eval', "() => { document.querySelector('module-fixture')?.remove(); return 'removed'; }")
    await wait(250)

    const afterDisconnect = await cli('eval', '() => globalThis.__controllerModuleLoaded === false')
    expect(parseResult(afterDisconnect)).toContain('true')
  }, 30000)

  test('invalid imported module default export reports a controller error', async () => {
    const before = getFixture().errors.length
    await gotoTest('/test/bad-import-test')

    const error = await waitFor(() => findError({ after: before, source: 'bad-import-test' }))
    const detail = error.message.detail as Record<string, unknown>
    expect(String(detail.message)).toContain('Expected imported module default export to be a function')
    expect(detail.kind).toBe('module_import_error')
    expect(detail.context).toEqual(
      expect.objectContaining({
        path: '/dist/modules/invalid-controller-module.js',
      }),
    )
  }, 30000)

  test('unsupported server event types report a controller error', async () => {
    const before = getFixture().errors.length
    await gotoTest('/test/unsupported-event-test')

    const error = await waitFor(() => findError({ after: before, source: 'unsupported-event-test' }))
    const detail = error.message.detail as Record<string, unknown>
    expect(String(detail.message)).toContain('Unsupported controller event type "unsupported_controller_event"')
    expect(detail.kind).toBe('server_message_error')
    expect(detail.context).toEqual(
      expect.objectContaining({
        rawMessage: expect.stringContaining('unsupported_controller_event'),
      }),
    )
  }, 30000)
})
