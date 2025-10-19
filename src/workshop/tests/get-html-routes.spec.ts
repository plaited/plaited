import { test, expect } from 'bun:test'
import { resolve } from 'node:path'
import { getHtmlRoutes } from '../get-html-routes.js'
import { getStorySetMetadata } from '../get-story-set-metadata.js'

const getFixturePath = (filename: string) => Bun.resolveSync(`./fixtures/${filename}`, import.meta.dir)

// Use the actual cwd (project root in this case)
const cwd = resolve(import.meta.dir, '../../../..') // Project root

test('getHtmlRoutes: creates HTML routes for stories', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  expect(routes).toBeDefined()
  expect(typeof routes).toBe('object')

  const routeKeys = Object.keys(routes)
  expect(routeKeys.length).toBeGreaterThan(0)

  // Should have routes for the story
  expect(routeKeys.some((key) => key.includes('basic-story'))).toBe(true)
})

test('getHtmlRoutes: creates both page and template routes', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const routeKeys = Object.keys(routes)

  // Should have full page route
  const pageRoute = routeKeys.find((key) => key.includes('basic-story') && !key.endsWith('.template'))
  expect(pageRoute).toBeDefined()

  // Should have template-only route (ends with .template)
  const templateRoute = routeKeys.find((key) => key.includes('basic-story') && key.endsWith('.template'))
  expect(templateRoute).toBeDefined()
})

test('getHtmlRoutes: page routes contain valid HTML', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const pageRoute = Object.keys(routes).find((key) => key.includes('basic-story') && !key.endsWith('.template'))
  expect(pageRoute).toBeDefined()

  const response = routes[pageRoute!]
  expect(response).toBeInstanceOf(Response)

  // Check headers
  expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
  expect(response.headers.get('content-encoding')).toBe('gzip')

  // Decompress and verify HTML structure
  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  expect(html).toContain('<!DOCTYPE html>')
  expect(html).toContain('<html')
  expect(html).toContain('<head')
  expect(html).toContain('<body')
  expect(html).toContain('plaited-story-fixture')
})

test('getHtmlRoutes: page includes story title', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const pageRoute = Object.keys(routes).find((key) => key.includes('basic-story') && !key.endsWith('.template'))
  const response = routes[pageRoute!]

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  expect(html).toContain('<title')
  expect(html).toContain('Story:')
})

test('getHtmlRoutes: page includes module script with correct import', async () => {
  const filePath = getFixturePath('interaction-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const pageRoute = Object.keys(routes).find((key) => key.includes('click-test') && !key.endsWith('.template'))
  const response = routes[pageRoute!]

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  // Should include script with type="module"
  expect(html).toContain('type="module"')

  // Should import from the story file
  expect(html).toContain('clickTest')

  // Should include TEST_RUNNER_ROUTE import
  expect(html).toContain('/testing.js')
})

test('getHtmlRoutes: template routes contain only component markup', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const templateRoute = Object.keys(routes).find((key) => key.includes('basic-story') && key.endsWith('.template'))
  expect(templateRoute).toBeDefined()

  const response = routes[templateRoute!]
  expect(response).toBeInstanceOf(Response)

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  // Template should NOT have DOCTYPE or full HTML structure
  expect(html).not.toContain('<!DOCTYPE html>')

  // Should include script tag
  expect(html).toContain('<script')
})

test('getHtmlRoutes: handles stories with parameters', async () => {
  const filePath = getFixturePath('styled-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const pageRoute = Object.keys(routes).find((key) => key.includes('styled-story') && !key.endsWith('.template'))
  const response = routes[pageRoute!]

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  // HTML should be valid
  expect(html).toContain('<html')

  // Should have plaited-story custom element
  expect(html).toContain('plaited-story')
})

test('getHtmlRoutes: handles multiple stories in one file', async () => {
  const filePath = getFixturePath('multi-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const routeKeys = Object.keys(routes)

  // Should have routes for all three stories
  expect(routeKeys.some((key) => key.includes('first-story'))).toBe(true)
  expect(routeKeys.some((key) => key.includes('second-story'))).toBe(true)
  expect(routeKeys.some((key) => key.includes('third-story'))).toBe(true)

  // Each story should have both page and template routes
  const firstStoryRoutes = routeKeys.filter((key) => key.includes('first-story'))
  expect(firstStoryRoutes.length).toBe(2) // page + template

  const secondStoryRoutes = routeKeys.filter((key) => key.includes('second-story'))
  expect(secondStoryRoutes.length).toBe(2) // page + template

  const thirdStoryRoutes = routeKeys.filter((key) => key.includes('third-story'))
  expect(thirdStoryRoutes.length).toBe(2) // page + template
})

test('getHtmlRoutes: handles interaction stories with play function', async () => {
  const filePath = getFixturePath('interaction-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const pageRoute = Object.keys(routes).find((key) => key.includes('click-test') && !key.endsWith('.template'))
  const response = routes[pageRoute!]

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  // Should include fixture trigger for play function
  expect(html).toContain('clickTest')
  expect(html).toContain('play')
})

test('getHtmlRoutes: creates responses with correct content-type', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  for (const [_, response] of Object.entries(routes)) {
    expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
  }
})

test('getHtmlRoutes: handles multiple files', async () => {
  const filePath1 = getFixturePath('simple-story.stories.tsx')
  const filePath2 = getFixturePath('interaction-story.stories.tsx')

  const metadata1 = getStorySetMetadata(filePath1)
  const metadata2 = getStorySetMetadata(filePath2)

  const entries: [string, typeof metadata1][] = [
    [filePath1, metadata1],
    [filePath2, metadata2],
  ]

  const routes = await getHtmlRoutes(cwd, entries)

  const routeKeys = Object.keys(routes)

  // Should have routes for both files
  expect(routeKeys.some((key) => key.includes('basic-story'))).toBe(true)
  expect(routeKeys.some((key) => key.includes('click-test'))).toBe(true)
})

test('getHtmlRoutes: all responses are gzip compressed', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  for (const [_, response] of Object.entries(routes)) {
    expect(response.headers.get('content-encoding')).toBe('gzip')

    // Verify content can be decompressed
    const buffer = await response.arrayBuffer()
    expect(() => Bun.gunzipSync(new Uint8Array(buffer))).not.toThrow()
  }
})

test('getHtmlRoutes: page includes StoryFixture component', async () => {
  const filePath = getFixturePath('simple-story.stories.tsx')
  const metadata = getStorySetMetadata(filePath)
  const entries: [string, typeof metadata][] = [[filePath, metadata]]

  const routes = await getHtmlRoutes(cwd, entries)

  const pageRoute = Object.keys(routes).find((key) => key.includes('basic-story') && !key.endsWith('.template'))
  const response = routes[pageRoute!]

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const html = new TextDecoder().decode(decompressed)

  expect(html).toContain('plaited-story-fixture')
})
