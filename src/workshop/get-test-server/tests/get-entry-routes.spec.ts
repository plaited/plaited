import { test, expect } from 'bun:test'
import { getEntryRoutes } from '../get-entry-routes.js'
import { TEST_RUNNER_ROUTE } from '../../workshop.constants.js'

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

test('getEntryRoutes: creates routes for story entrypoints', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  expect(routes).toBeDefined()
  expect(typeof routes).toBe('object')

  // Should include testing.js route (from plaited/testing entrypoint)
  const testingRoute = Object.keys(routes).find((key) => key.includes('testing.js'))
  expect(testingRoute).toBeDefined()
  expect(routes[testingRoute!]).toBeInstanceOf(Response)

  // Should include entry-point route for the story
  const storyRouteKeys = Object.keys(routes).filter((key) => key.includes('simple-story'))
  expect(storyRouteKeys.length).toBeGreaterThan(0)
})

test('getEntryRoutes: formats testing.js route correctly', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  const testingRoute = Object.keys(routes).find((key) => key.includes('testing.js'))
  expect(testingRoute).toBeDefined()

  const response = routes[testingRoute!]
  expect(response).toBeInstanceOf(Response)

  // Verify it's a JavaScript file
  const contentType = response.headers.get('content-type')
  expect(contentType).toContain('javascript')
})

test('getEntryRoutes: formats entry-point routes with kebab-case', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  const routeKeys = Object.keys(routes)

  // Entry routes should use kebab-case and end with --index.js
  const entryRoutes = routeKeys.filter((key) => key.endsWith('--index.js'))
  expect(entryRoutes.length).toBeGreaterThan(0)

  // Check that routes use kebab-case formatting
  const simpleStoryRoute = entryRoutes.find((route) => route.includes('simple-story'))
  expect(simpleStoryRoute).toBeDefined()
  expect(simpleStoryRoute).toContain('--index.js')
})

test('getEntryRoutes: handles multiple entrypoints', async () => {
  const cwd = import.meta.dir
  const entrypoints = [
    getFixturePath('simple-story.stories.tsx'),
    getFixturePath('interaction-story.stories.tsx'),
    getFixturePath('styled-story.stories.tsx'),
  ]

  const routes = await getEntryRoutes(cwd, entrypoints)

  // Should have TEST_RUNNER_ROUTE plus entries for each story
  expect(Object.keys(routes).length).toBeGreaterThan(3)

  // Verify each story has an entry route
  const routeKeys = Object.keys(routes)
  expect(routeKeys.some((key) => key.includes('simple-story'))).toBe(true)
  expect(routeKeys.some((key) => key.includes('interaction-story'))).toBe(true)
  expect(routeKeys.some((key) => key.includes('styled-story'))).toBe(true)
})

test('getEntryRoutes: creates valid Response objects with gzip compression', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  for (const [path, response] of Object.entries(routes)) {
    expect(response).toBeInstanceOf(Response)

    // Check headers
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('content-type')).toContain('javascript')

    // Verify content can be decompressed
    const buffer = await response.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)

    const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
    const content = new TextDecoder().decode(decompressed)
    expect(content.length).toBeGreaterThan(0)
  }
})

test('getEntryRoutes: normalizes chunk paths correctly', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  const routeKeys = Object.keys(routes)

  // Chunks should have paths that don't start with '.'
  const chunkRoutes = routeKeys.filter((key) => !key.endsWith('--index.js') && key !== TEST_RUNNER_ROUTE)

  for (const route of chunkRoutes) {
    // Normalized paths should start with '/' not './
    expect(route.startsWith('./')).toBe(false)
    expect(route.startsWith('/')).toBe(true)
  }
})

test('getEntryRoutes: includes plaited/testing entrypoint', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  // plaited/testing entrypoint becomes testing.js route
  const testingRoute = Object.keys(routes).find((key) => key.includes('testing.js'))
  expect(testingRoute).toBeDefined()

  const response = routes[testingRoute!]
  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const content = new TextDecoder().decode(decompressed)

  // Content should be valid JavaScript
  expect(content.length).toBeGreaterThan(0)
})

test('getEntryRoutes: handles stories in nested directories', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  const routeKeys = Object.keys(routes)

  // Entry routes should preserve directory structure
  const entryRoutes = routeKeys.filter((key) => key.endsWith('--index.js'))

  for (const route of entryRoutes) {
    // Should contain the directory path
    expect(route).toContain('/')
  }
})

test('getEntryRoutes: sets correct content-type for JavaScript', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('simple-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  for (const [path, response] of Object.entries(routes)) {
    const contentType = response.headers.get('content-type')

    // All routes should be JavaScript
    expect(contentType).toMatch(/javascript|ecmascript/)
  }
})

test('getEntryRoutes: handles multi-story file', async () => {
  const cwd = import.meta.dir
  const entrypoints = [getFixturePath('multi-story.stories.tsx')]

  const routes = await getEntryRoutes(cwd, entrypoints)

  expect(routes).toBeDefined()

  // Should include TEST_RUNNER_ROUTE and entry for multi-story
  const routeKeys = Object.keys(routes)
  expect(routeKeys.some((key) => key.includes('multi-story'))).toBe(true)
})
