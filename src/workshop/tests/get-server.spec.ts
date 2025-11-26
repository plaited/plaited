import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { getRoutes } from '../get-server.ts'

const fixturesDir = join(import.meta.dir, 'fixtures/stories')

test('getRoutes: returns object with HTML routes and entry routes', async () => {
  const routes = await getRoutes(fixturesDir)

  const keys = Object.keys(routes)

  // Should have both HTML routes (story handlers) and entry routes (*.js bundles)
  const htmlRoutes = keys.filter((k) => !k.endsWith('.js'))
  const entryRoutes = keys.filter((k) => k.endsWith('.js'))

  expect(htmlRoutes.length).toBeGreaterThan(0)
  expect(entryRoutes.length).toBeGreaterThan(0)
})

test('getRoutes: HTML routes map story exports', async () => {
  const routes = await getRoutes(fixturesDir)

  const keys = Object.keys(routes)
  const htmlRoutes = keys.filter((k) => !k.endsWith('.js'))

  // HTML routes should start with / and map to story exports
  htmlRoutes.forEach((route) => {
    expect(route.startsWith('/')).toBe(true)
    expect(route.endsWith('.js')).toBe(false)
  })

  // Should have both main routes and .include routes
  const mainRoutes = htmlRoutes.filter((k) => !k.endsWith('.include'))
  const includeRoutes = htmlRoutes.filter((k) => k.endsWith('.include'))

  expect(mainRoutes.length).toBeGreaterThan(0)
  expect(includeRoutes.length).toBeGreaterThan(0)
  expect(mainRoutes.length).toBe(includeRoutes.length)
})

test('getRoutes: entry routes are static Response objects', async () => {
  const routes = await getRoutes(fixturesDir)

  const entryRoutes = Object.entries(routes).filter(([k]) => k.endsWith('.js'))

  // Entry routes should be pre-generated Response objects (static)
  entryRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: HTML routes are static Response objects', async () => {
  const routes = await getRoutes(fixturesDir)

  const htmlRoutes = Object.entries(routes).filter(([k]) => !k.endsWith('.js'))

  // HTML routes should be static Response objects
  htmlRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: excludes non-story files automatically', async () => {
  const routes = await getRoutes(fixturesDir)

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
  const routes = await getRoutes(fixturesDir)

  const keys = Object.keys(routes)

  keys.forEach((path) => {
    expect(path.startsWith('/')).toBe(true)
  })
})

test('getRoutes: is compatible with Bun.serve routes parameter', async () => {
  const routes = await getRoutes(fixturesDir)

  expect(typeof routes).toBe('object')
  expect(routes).not.toBeNull()

  // All values must be Response objects (per Bun docs)
  Object.values(routes).forEach((value) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: entry routes follow correct naming pattern', async () => {
  const routes = await getRoutes(fixturesDir)

  const entryRoutes = Object.keys(routes).filter((k) => k.endsWith('.stories.js'))

  // Entry routes should follow pattern: /path/to/file-name.stories.js
  expect(entryRoutes.length).toBeGreaterThan(0)
  entryRoutes.forEach((route) => {
    expect(route.endsWith('.stories.js')).toBe(true)
    expect(route.startsWith('/')).toBe(true)
  })
})
