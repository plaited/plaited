import { test, expect } from 'bun:test'
import { getRoutes } from '../get-server.js'
import { join } from 'node:path'

const fixturesDir = join(import.meta.dir, 'fixtures/templates')

test('getRoutes: returns object with tag routes and entry routes', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const keys = Object.keys(routes)

  // Should have both tag routes (/{custom-element-tag}) and entry routes (/{path}--index.js)
  const tagRoutes = keys.filter((k) => !k.endsWith('.js'))
  const entryRoutes = keys.filter((k) => k.endsWith('.js'))

  expect(tagRoutes.length).toBeGreaterThan(0)
  expect(entryRoutes.length).toBeGreaterThan(0)
})

test('getRoutes: tag routes map custom element tags', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const keys = Object.keys(routes)
  const tagRoutes = keys.filter((k) => !k.endsWith('.js'))

  // Tag routes should start with / and be custom element tag names
  tagRoutes.forEach((route) => {
    expect(route.startsWith('/')).toBe(true)
    expect(route.endsWith('.js')).toBe(false)
    // Custom element tags contain hyphens
    expect(route.includes('-')).toBe(true)
  })
})

test('getRoutes: entry routes are static Response objects', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const entryRoutes = Object.entries(routes).filter(([k]) => k.endsWith('.js'))

  // Entry routes should be pre-generated Response objects (static)
  entryRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: tag routes are static Response objects', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const tagRoutes = Object.entries(routes).filter(([k]) => !k.endsWith('.js'))

  // Tag routes should be static Response objects mapped to bundles
  tagRoutes.forEach(([_path, value]) => {
    expect(value).toBeInstanceOf(Response)
  })
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

  // All values must be Response objects (per Bun docs)
  Object.values(routes).forEach((value) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getRoutes: entry-point routes follow correct naming pattern', async () => {
  const routes = await getRoutes(fixturesDir, '**/*.tpl.spec.{ts,tsx}')

  const entryPointRoutes = Object.keys(routes).filter((k) => k.endsWith('--index.js'))

  // Entry-point routes should follow pattern: /path/to/kebab-case--index.js
  expect(entryPointRoutes.length).toBeGreaterThan(0)
  entryPointRoutes.forEach((route) => {
    expect(route.endsWith('--index.js')).toBe(true)
  })
})
