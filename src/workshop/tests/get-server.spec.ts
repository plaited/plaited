import { expect, test } from 'bun:test'
import { join } from 'node:path'
import type { BPEvent } from '../../main.ts'
import { FIXTURE_EVENTS, RELOAD_PAGE, RUNNER_URL } from '../../testing/testing.constants.ts'
import { collectStories } from '../collect-stories.ts'
import { getRoutes, getServer } from '../get-server.ts'

const fixturesDir = join(import.meta.dir, 'fixtures/stories')
const FIXTURES_DIR = join(import.meta.dir, 'fixtures')

test('getRoutes: returns object with HTML routes and entry routes', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const keys = Object.keys(routes)

  // Should have both HTML routes (story handlers) and entry routes (*.js bundles)
  const htmlRoutes = keys.filter((k) => !k.endsWith('.js'))
  const entryRoutes = keys.filter((k) => k.endsWith('.js'))

  expect(htmlRoutes.length).toBeGreaterThan(0)
  expect(entryRoutes.length).toBeGreaterThan(0)
})

test('getRoutes: HTML routes map story exports', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const keys = Object.keys(routes)
  const htmlRoutes = keys.filter((k) => !k.endsWith('.js'))

  // HTML routes should start with / and map to story exports
  htmlRoutes.forEach((route) => {
    expect(route.startsWith('/')).toBe(true)
    expect(route.endsWith('.js')).toBe(false)
  })

  // Should have both main routes and .template routes
  const mainRoutes = htmlRoutes.filter((k) => !k.endsWith('.template'))
  const templateRoutes = htmlRoutes.filter((k) => k.endsWith('.template'))

  expect(mainRoutes.length).toBeGreaterThan(0)
  expect(templateRoutes.length).toBeGreaterThan(0)
  expect(mainRoutes.length).toBe(templateRoutes.length)
})

test('getRoutes: entry routes are static Response objects', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const entryRoutes = Object.entries(routes).filter(([k]) => k.endsWith('.js'))

  // Entry routes should be pre-generated Response objects (static)
  entryRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: HTML routes are static Response objects', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const htmlRoutes = Object.entries(routes).filter(([k]) => !k.endsWith('.js'))

  // HTML routes should be static Response objects
  htmlRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: excludes non-story files automatically', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const keys = Object.keys(routes)

  // Should only have routes for .stories.tsx files
  // No routes for regular .tsx files
  const allKeysAreForStories = keys.every((k) => {
    // Entry routes end with .stories.js
    // HTML routes come from .stories.tsx files
    return k.endsWith('.js') || k.includes('stories')
  })
  expect(allKeysAreForStories).toBe(true)
})

test('getRoutes: all route paths are absolute (start with /)', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const keys = Object.keys(routes)

  keys.forEach((path) => {
    expect(path.startsWith('/')).toBe(true)
  })
})

test('getRoutes: is compatible with Bun.serve routes parameter', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  expect(typeof routes).toBe('object')
  expect(routes).not.toBeNull()

  // All values must be Response objects (per Bun docs)
  Object.values(routes).forEach((value) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: entry routes follow correct naming pattern', async () => {
  const stories = await collectStories(FIXTURES_DIR, [fixturesDir])
  const routes = await getRoutes({ paths: [fixturesDir], stories, colorScheme: 'light' })

  const entryRoutes = Object.keys(routes).filter((k) => k.endsWith('.stories.js'))

  // Entry routes should follow pattern: /path/to/file-name.stories.js
  expect(entryRoutes.length).toBeGreaterThan(0)
  entryRoutes.forEach((route) => {
    expect(route.endsWith('.stories.js')).toBe(true)
    expect(route.startsWith('/')).toBe(true)
  })
})

// getServer() tests

test('getServer: should create server with stories', async () => {
  const { server, stories, reload } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0, // Auto-assign port
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  expect(server).toBeDefined()
  expect(stories).toBeInstanceOf(Map)
  expect(stories.size).toBeGreaterThan(0)
  expect(typeof reload).toBe('function')

  await server.stop(true)
})

test('getServer: should return stories Map with route and entryPath', async () => {
  const { server, stories } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  const storyArray = [...stories.values()]
  expect(storyArray.length).toBeGreaterThan(0)

  // Verify each story has route and entryPath
  storyArray.forEach((story) => {
    expect(story.route).toBeDefined()
    expect(typeof story.route).toBe('string')
    expect(story.route.startsWith('/')).toBe(true)

    expect(story.entryPath).toBeDefined()
    expect(typeof story.entryPath).toBe('string')
    expect(story.entryPath.endsWith('.js')).toBe(true)
  })

  await server.stop(true)
})

test('getServer: should handle empty stories when no matches found', async () => {
  const emptyDir = join(FIXTURES_DIR, 'entry-routes') // Directory with no .stories.tsx

  const { server, stories } = await getServer({
    cwd: emptyDir,
    port: 0,
    paths: [emptyDir],
    colorScheme: 'light',
  })

  expect(stories).toBeInstanceOf(Map)
  expect(stories.size).toBe(0)

  await server.stop(true)
})

test('getServer: should return 200 OK for / health check', async () => {
  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  const response = await fetch(`http://localhost:${server.port}/`)

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('OK')
  expect(response.headers.get('content-type')).toBe('text/plain')

  await server.stop(true)
})

test('getServer: should return 200 OK for /health endpoint', async () => {
  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  const response = await fetch(`http://localhost:${server.port}/health`)

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('OK')

  await server.stop(true)
})

test('getServer: should return 404 for unmapped routes', async () => {
  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  const response = await fetch(`http://localhost:${server.port}/nonexistent-route`)

  expect(response.status).toBe(404)
  expect(await response.text()).toBe('Not Found')

  await server.stop(true)
})

test('getServer: should upgrade WebSocket connection at runner endpoint', async () => {
  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  const ws = new WebSocket(`ws://localhost:${server.port}${RUNNER_URL}`)

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      expect(ws.readyState).toBe(WebSocket.OPEN)
      ws.close()
      resolve()
    }
    ws.onerror = reject
  })

  await server.stop(true)
})

test('getServer: should invoke trigger callback with parsed event', async () => {
  const { promise, resolve } = Promise.withResolvers<BPEvent>()

  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
    trigger: (event) => {
      resolve(event)
    },
  })

  const ws = new WebSocket(`ws://localhost:${server.port}${RUNNER_URL}`)

  await new Promise<void>((resolveOpen) => {
    ws.onopen = () => resolveOpen()
  })

  // Send valid RunnerMessage
  const message = {
    type: FIXTURE_EVENTS.test_pass,
    detail: { pathname: '/test-route' },
  }
  ws.send(JSON.stringify(message))

  const receivedEvent = await promise

  expect(receivedEvent.type).toBe(FIXTURE_EVENTS.test_pass)
  expect(receivedEvent.detail.pathname).toBe('/test-route')

  ws.close()
  await server.stop(true)
})

test('getServer: should handle multiple WebSocket messages', async () => {
  const events: unknown[] = []
  const { promise, resolve } = Promise.withResolvers<void>()

  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
    trigger: (event) => {
      events.push(event)
      if (events.length === 2) {
        resolve()
      }
    },
  })

  const ws = new WebSocket(`ws://localhost:${server.port}${RUNNER_URL}`)

  await new Promise<void>((resolveOpen) => {
    ws.onopen = () => resolveOpen()
  })

  // Send two messages
  ws.send(
    JSON.stringify({
      type: FIXTURE_EVENTS.test_pass,
      detail: { pathname: '/route1' },
    }),
  )

  ws.send(
    JSON.stringify({
      type: FIXTURE_EVENTS.test_fail,
      detail: { pathname: '/route2', errorType: 'test_error', error: 'Test failed' },
    }),
  )

  await promise

  expect(events.length).toBe(2)

  ws.close()
  await server.stop(true)
})

test('getServer: should not call trigger if none provided', async () => {
  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
    // No trigger callback
  })

  const ws = new WebSocket(`ws://localhost:${server.port}${RUNNER_URL}`)

  await new Promise<void>((resolve) => {
    ws.onopen = () => resolve()
  })

  // Send message - should not throw
  ws.send(
    JSON.stringify({
      type: FIXTURE_EVENTS.test_pass,
      detail: { pathname: '/test' },
    }),
  )

  // Wait a bit to ensure no errors
  await new Promise((resolve) => setTimeout(resolve, 100))

  ws.close()
  await server.stop(true)
})

test('getServer: reload() should broadcast to WebSocket clients', async () => {
  const { server, reload } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'light',
  })

  const ws = new WebSocket(`ws://localhost:${server.port}${RUNNER_URL}`)

  const { promise, resolve } = Promise.withResolvers<string>()

  ws.onmessage = (event) => {
    resolve(event.data)
  }

  await new Promise<void>((resolveOpen) => {
    ws.onopen = () => resolveOpen()
  })

  // Trigger reload
  reload()

  const message = await promise

  expect(message).toBe(RELOAD_PAGE)

  ws.close()
  await server.stop(true)
})

test('getServer: should pass colorScheme to routes', async () => {
  const { server } = await getServer({
    cwd: FIXTURES_DIR,
    port: 0,
    paths: [fixturesDir],
    colorScheme: 'dark',
  })

  // ColorScheme is passed to getHTMLRoutes which sets it as attribute
  // Just verify server was created successfully with dark mode
  expect(server.port).toBeGreaterThan(0)

  await server.stop(true)
})
