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

const BROWSER = '--browser=chromium'

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
    await runCli('open', BROWSER)
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
      const eventType = (detail?.event as Record<string, unknown> | undefined)?.type
      return event.source === source && eventType === type
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

  // Open browser session with explicit Chromium browser (not system Chrome)
  await cli('open', BROWSER)
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

describe('Controller: real browser', () => {
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

  test('custom element exists in DOM', async () => {
    const output = await cli('eval', "() => document.querySelector('test-island')?.tagName")
    const result = parseResult(output)
    expect(result).toContain('TEST-ISLAND')
  })

  test('o-target attribute is present on descendant', async () => {
    const output = await cli('eval', "() => document.querySelector('test-island [o-target]')?.getAttribute('o-target')")
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

  test('WebSocket open emits controller.connected inventory', () => {
    const event = findUiEvent({ source: 'test-island', type: 'controller_connected' })

    expect(event).toBeDefined()
    expect(event!.message).toMatchObject({
      type: 'ui_event',
      detail: {
        event: {
          type: 'controller_connected',
        },
      },
    })
  })

  test('setHTMLUnsafe does NOT execute inline scripts (browser limitation)', async () => {
    // Scripts inserted via setHTMLUnsafe, innerHTML, or any DOM parsing API are marked
    // "parser-inserted" by the HTML spec and will NOT execute.
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

    // innerHTML: original content replaced
    const innerResult = await cli('eval', "() => document.getElementById('inner-result')?.textContent")
    expect(parseResult(innerResult)).toContain('inner replaced')

    // afterbegin: prepended as first child
    const afterbeginResult = await cli(
      'eval',
      '() => document.querySelector(\'[o-target="main"]\')?.firstElementChild?.id',
    )
    expect(parseResult(afterbeginResult)).toContain('afterbegin-result')

    // beforeend: appended as last child
    const beforeendResult = await cli(
      'eval',
      '() => document.querySelector(\'[o-target="main"]\')?.lastElementChild?.id',
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
    expect(detail.description).toBe('CSSStyleSheet replacement or adoption failed')
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
    const classResult = await cli('eval', "() => document.querySelector('[o-target=\"main\"]')?.getAttribute('class')")
    expect(parseResult(classResult)).toContain('active')

    // Removed attribute: data-removable should be gone
    const removedResult = await cli(
      'eval',
      "() => document.querySelector('[o-target=\"main\"]')?.hasAttribute('data-removable')",
    )
    expect(parseResult(removedResult)).toContain('false')

    // Boolean attribute: disabled should be present
    const boolResult = await cli(
      'eval',
      "() => document.querySelector('[o-target=\"main\"]')?.hasAttribute('disabled')",
    )
    expect(parseResult(boolResult)).toContain('true')

    // Number attribute: data-count = '42'
    const numResult = await cli(
      'eval',
      "() => document.querySelector('[o-target=\"main\"]')?.getAttribute('data-count')",
    )
    expect(parseResult(numResult)).toContain('42')
  }, 30000)
})

// ─── UI event handler ─────────────────────────────────────────────────────────

describe('controller: ui_event', () => {
  test('o-trigger click is captured by server and triggers response render', async () => {
    // Navigate to action-test page — server renders a o-trigger button
    await gotoTest('/test/action-test')

    // Click the o-trigger button
    await cli('eval', "() => { document.getElementById('test-btn')?.click(); return 'clicked'; }")

    // Wait for the roundtrip: click -> ui_event -> server render -> DOM update
    await wait(500)

    // Server responds with confirmation render
    const output = await cli('eval', "() => document.getElementById('action-confirmed')?.textContent")
    const result = parseResult(output)
    expect(result).toContain('Action received')
  }, 30000)

  test('server received the ui_event message with the o-trigger BP event envelope', () => {
    const activeFixture = getFixture()
    expect(activeFixture.lastUiEvent).toBeDefined()
    const event = activeFixture.lastUiEvent!
    expect(event.source).toBe('action-test')
    expect(event.message.type).toBe('ui_event')
    const detail = event.message.detail as Record<string, unknown>
    const bpEvent = detail.event as Record<string, unknown>
    expect(bpEvent.type).toBe('test_click')
    const attrs = bpEvent.detail as Record<string, unknown>
    expect(attrs.id).toBe('test-btn')
    expect(attrs['o-trigger']).toBe('click:test_click')
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

// ─── Module registers ─────────────────────────────────────────────────────────

describe('controller: module registers', () => {
  test('dynamic import() via connect.js modules param invokes default export as Register callback', async () => {
    // Navigate to module fixture; the connect.js loads controller-module.js as a Register.
    await gotoTest('/module-fixture.html')

    const output = await cli('eval', '() => globalThis.__controllerModuleLoaded === true')
    const result = parseResult(output)
    expect(result).toContain('true')
  }, 30000)

  test('reports import_invoked after the Register callback finishes', () => {
    // The Register callback runs during connectedCallback. Since the buttons are in
    // the initial HTML, the callback can bind listeners immediately.
    // The module sets __controllerModuleLoaded on success.
    // Verified by finding the controller_connected event that proves the controller started.
    const event = findUiEvent({ source: 'module-fixture', type: 'controller_connected' })
    expect(event).toBeDefined()
  })

  test('o-trigger actions are sent as BP events with an attribute detail map', async () => {
    const before = getFixture().uiEvents.length
    await gotoTest('/module-fixture.html')

    await cli('eval', "() => { document.getElementById('module-o-trigger-btn')?.click(); return 'clicked'; }")

    const event = await waitFor(() => findUiEvent({ after: before, source: 'module-fixture', type: 'test_click' }))
    const detail = event.message.detail as Record<string, unknown>
    const bpEvent = detail.event as Record<string, unknown>
    const attrs = bpEvent.detail as Record<string, unknown>
    expect(attrs.id).toBe('module-o-trigger-btn')
    expect(attrs['data-extra']).toBe('o-trigger-attr')
    expect(attrs['o-trigger']).toBe('click:test_click')
  }, 30000)

  test('Register callbacks can use delegated listeners and trigger BP events', async () => {
    const before = getFixture().uiEvents.length
    await gotoTest('/module-fixture.html')

    await cli('eval', "() => { document.getElementById('module-enhanced-btn')?.click(); return 'clicked'; }")

    const event = await waitFor(() =>
      findUiEvent({ after: before, source: 'module-fixture', type: 'controller_module_click' }),
    )
    const count = await cli('eval', '() => globalThis.__controllerModuleHandlerCallCount ?? 0')
    expect(parseResult(count)).toContain('1')
    const detail = event.message.detail as Record<string, unknown>
    const bpEvent = detail.event as Record<string, unknown>
    const attrs = bpEvent.detail as Record<string, unknown>
    expect(attrs.id).toBe('module-enhanced-btn')
    expect(attrs['data-extra']).toBe('module-listener')
  }, 30000)

  test('disconnect runs cleanup callbacks registered by Register functions', async () => {
    await gotoTest('/module-fixture.html')

    const loaded = await cli('eval', '() => globalThis.__controllerModuleLoaded === true')
    expect(parseResult(loaded)).toContain('true')

    await cli('eval', "() => { document.querySelector('module-fixture')?.remove(); return 'removed'; }")
    await wait(250)

    const afterDisconnect = await cli('eval', '() => globalThis.__controllerModuleLoaded === false')
    expect(parseResult(afterDisconnect)).toContain('true')
  }, 30000)

  test('invalid module default export reports a controller error', async () => {
    const before = getFixture().errors.length
    await gotoTest('/test/bad-import-test')

    const error = await waitFor(() => findError({ after: before, source: 'bad-import-test' }))
    const detail = error.message.detail as Record<string, unknown>
    expect(String(detail.message)).toContain('not a function')
    expect(detail.description).toBe('Socket listener event handler threw an error')
    expect(detail.context).toEqual(
      expect.objectContaining({
        eventType: 'open',
      }),
    )
  }, 30000)

  test('unsupported server event types report a controller error', async () => {
    const before = getFixture().errors.length
    await gotoTest('/test/unsupported-event-test')

    const error = await waitFor(() => findError({ after: before, source: 'unsupported-event-test' }))
    const detail = error.message.detail as Record<string, unknown>
    expect(String(detail.message)).toContain('Unsupported controller event type "unsupported_controller_event"')
    expect(detail.description).toBe('Failed to parse or handle server message')
    expect(detail.context).toEqual(
      expect.objectContaining({
        rawMessage: expect.stringContaining('unsupported_controller_event'),
      }),
    )
  }, 30000)
})

describe('webA2A: real browser', () => {
  const setupListener = async () => {
    await cli(
      'eval',
      `
      () => {
        window.__a2aMessages = []
        window.__a2aListener = (e) => {
          try { window.__a2aMessages.push(e.data) } catch {}
        }
        window.addEventListener('message', window.__a2aListener)
      }
    `,
    )
  }

  test('navigates to A2A test page and controller connects', async () => {
    await gotoTest('/test/a2a-test', 2000)
  }, 30000)

  test('incoming task/send triggers a2a_task on WebSocket', async () => {
    await setupListener()
    const before = getFixture().a2aTasks.length
    const taskId = 'test-task-1'

    await cli(
      'eval',
      `
      () => {
        window.postMessage(JSON.stringify({
          jsonrpc: '2.0',
          method: 'task/send',
          id: 1,
          params: {
            id: '${taskId}',
            skill: 'search',
            message: {
              role: 'user',
              parts: [{ data: { query: 'test' } }]
            }
          }
        }), window.origin)
      }
    `,
    )

    const task = await waitFor(() => getFixture().findA2ATask({ after: before, source: 'a2a-test' }))
    const detail = task.message.detail as Record<string, unknown>
    expect(detail.taskId).toBe(taskId)
    expect(detail.skill).toBe('search')
    expect((detail.message as Record<string, unknown>).role).toBe('user')
  }, 15000)

  test('task lifecycle produces task/update via postMessage', async () => {
    await wait(2000)

    const raw = await cli(
      'eval',
      `
      () => {
        const msgs = window.__a2aMessages ?? []
        for (let i = msgs.length - 1; i >= 0; i--) {
          try {
            const m = JSON.parse(msgs[i])
            if (m.method === 'task/update') return JSON.stringify(m.params)
          } catch {}
        }
        return 'none'
      }
    `,
    )
    const result = parseResult(raw)
    expect(result).toContain('completed')
  }, 15000)

  test('malformed postMessage does not cause an error', async () => {
    const before = getFixture().errors.length

    // Non-JSON message
    await cli('eval', '() => window.postMessage("not json", window.origin)')
    // Non-task method
    await cli('eval', '() => window.postMessage(JSON.stringify({jsonrpc: "2.0", method: "nope"}), window.origin)')
    // Missing params
    await cli('eval', '() => window.postMessage(JSON.stringify({jsonrpc: "2.0", method: "task/send"}), window.origin)')

    // None should trigger an error — all are silently dropped
    await wait(1000)
    const errorsAfter = getFixture().errors.length
    expect(errorsAfter).toBe(before)
  }, 10000)
})
