import { test, expect } from 'bun:test'
import { getRoutes } from '../get-server.js'
import { join } from 'node:path'

const fixturesDir = join(import.meta.dir, 'fixtures/templates')

test('getRoutes: returns object with HTML and entry routes', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const keys = Object.keys(routes)

  // Should have both HTML routes and JS entry routes
  const htmlRoutes = keys.filter((k) => !k.endsWith('.js'))
  const entryRoutes = keys.filter((k) => k.endsWith('.js'))

  expect(htmlRoutes.length).toBeGreaterThan(0)
  expect(entryRoutes.length).toBeGreaterThan(0)
})

test('getRoutes: HTML routes include both page and include variants', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const keys = Object.keys(routes)
  const pageRoutes = keys.filter((k) => !k.endsWith('.include') && !k.endsWith('.js'))
  const includeRoutes = keys.filter((k) => k.endsWith('.include'))

  expect(includeRoutes.length).toBeGreaterThan(0)
  expect(pageRoutes.length).toBeGreaterThan(0)
})

test('getRoutes: entry routes are static Response objects', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const entryRoutes = Object.entries(routes).filter(([k]) => k.endsWith('.js'))

  // Entry routes should be pre-generated Response objects (static)
  entryRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: HTML routes are async handler functions', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const htmlRoutes = Object.entries(routes).filter(([k]) => !k.endsWith('.js'))

  // HTML routes should be handler functions (dynamic)
  htmlRoutes.forEach(([_path, value]) => {
    expect(typeof value).toBe('function')
  })
})

test('getRoutes: HTML handlers return Response when called', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const firstHtmlRoute = Object.entries(routes).find(([k]) => !k.endsWith('.js') && !k.endsWith('.include'))

  if (firstHtmlRoute) {
    const [_path, handler] = firstHtmlRoute
    const mockRequest = new Request('http://localhost:3456/test')
    const response = await (handler as (req: Request) => Promise<Response>)(mockRequest)

    expect(response).toBeInstanceOf(Response)
  }
})

test('getRoutes: excludes files matching exclude pattern', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const keys = Object.keys(routes)

  // Should not include routes for excluded test files
  const hasExcludedFiles = keys.some((k) => k.includes('tpl.spec'))
  expect(hasExcludedFiles).toBe(false)
})

test('getRoutes: all route paths are absolute (start with /)', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const keys = Object.keys(routes)

  keys.forEach((path) => {
    expect(path.startsWith('/')).toBe(true)
  })
})

test('getRoutes: is compatible with Bun.serve routes parameter', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  expect(typeof routes).toBe('object')
  expect(routes).not.toBeNull()

  // All values must be Response or Function (per Bun docs)
  Object.values(routes).forEach((value) => {
    const isValid = value instanceof Response || typeof value === 'function'
    expect(isValid).toBe(true)
  })
})

test('getRoutes: routes count matches discovered templates', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const htmlRoutes = Object.keys(routes).filter((k) => !k.endsWith('.js'))
  const pageRoutes = htmlRoutes.filter((k) => !k.endsWith('.include'))
  const includeRoutes = htmlRoutes.filter((k) => k.endsWith('.include'))

  // Each template should have exactly 2 HTML routes (page + include)
  expect(pageRoutes.length).toBe(includeRoutes.length)
})
