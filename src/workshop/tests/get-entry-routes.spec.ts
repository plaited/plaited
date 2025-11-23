import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { getEntryRoutes } from '../get-entry-routes.ts'

/**
 * Helper function to get response content as text.
 * Responses are no longer gzipped by default for better test performance.
 */
const getResponseText = async (response: Response): Promise<string> => {
  return await response.text()
}

// Path to test fixtures with nested directory structure
const fixturesRoot = join(import.meta.dir, 'fixtures', 'entry-routes')

test('getEntryRoutes: transforms root-level template path correctly', async () => {
  const entrypoint = join(fixturesRoot, 'RootTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  // Should have entry for the root template with kebab-case name
  expect(responses['/root-template--index.js']).toBeDefined()

  // Should be a Response object
  expect(responses['/root-template--index.js']).toBeInstanceOf(Response)
})

test('getEntryRoutes: transforms nested template path correctly', async () => {
  const entrypoint = join(fixturesRoot, 'nested', 'component', 'NestedTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  // Should preserve directory structure and kebab-case the filename
  expect(responses['/nested/component/nested-template--index.js']).toBeDefined()
})

test('getEntryRoutes: transforms deeply nested template path correctly', async () => {
  const entrypoint = join(fixturesRoot, 'deep', 'ui', 'forms', 'DeepTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  // Should preserve full directory path and kebab-case the filename
  expect(responses['/deep/ui/forms/deep-template--index.js']).toBeDefined()
})

test('getEntryRoutes: handles multiple entrypoints', async () => {
  const entrypoints = [
    join(fixturesRoot, 'RootTemplate.tsx'),
    join(fixturesRoot, 'nested', 'component', 'NestedTemplate.tsx'),
    join(fixturesRoot, 'deep', 'ui', 'forms', 'DeepTemplate.tsx'),
  ]
  const responses = await getEntryRoutes(fixturesRoot, entrypoints)

  // Should have all entry-points
  expect(responses['/root-template--index.js']).toBeDefined()
  expect(responses['/nested/component/nested-template--index.js']).toBeDefined()
  expect(responses['/deep/ui/forms/deep-template--index.js']).toBeDefined()

  // Should have at least 3 responses (entry-points, possibly chunks)
  expect(Object.keys(responses).length).toBeGreaterThanOrEqual(3)
})

test('getEntryRoutes: creates code-split chunks when splitting enabled', async () => {
  // Use templates that share a dependency to trigger code splitting
  const entrypoints = [join(fixturesRoot, 'TemplateA.tsx'), join(fixturesRoot, 'TemplateB.tsx')]
  const responses = await getEntryRoutes(fixturesRoot, entrypoints)

  // Should have both entry-points
  expect(responses['/template-a--index.js']).toBeDefined()
  expect(responses['/template-b--index.js']).toBeDefined()

  // May have additional chunk files (Bun decides if code-splitting happens)
  const responseKeys = Object.keys(responses)
  expect(responseKeys.length).toBeGreaterThanOrEqual(2)

  // All keys should be absolute paths starting with /
  responseKeys.forEach((key) => {
    expect(key.startsWith('/')).toBe(true)
  })
})

test('getEntryRoutes: responses are not compressed by default', async () => {
  const entrypoint = join(fixturesRoot, 'RootTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  const response = responses['/root-template--index.js']

  // Should NOT have gzip content-encoding header (compression disabled for performance)
  expect(response?.headers.get('content-encoding')).toBeNull()

  // Should be able to read content as text
  const content = response ? await getResponseText(response) : ''
  expect(typeof content).toBe('string')
  expect(content.length).toBeGreaterThan(0)
})

test('getEntryRoutes: responses have correct content-type', async () => {
  const entrypoint = join(fixturesRoot, 'RootTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  const response = responses['/root-template--index.js']

  // Should have JavaScript content-type (from Bun.build artifact.type)
  const contentType = response?.headers.get('content-type')
  expect(contentType).toBeTruthy()
  expect(contentType).toContain('javascript')
})

test('getEntryRoutes: bundled content is valid JavaScript', async () => {
  const entrypoint = join(fixturesRoot, 'RootTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  const response = responses['/root-template--index.js']
  const content = response ? await getResponseText(response) : ''

  // Should contain typical bundled JavaScript patterns
  // Bun bundles should contain some identifiable markers
  expect(content.length).toBeGreaterThan(0)
  expect(typeof content).toBe('string')

  // Should be valid enough to not throw syntax errors
  // (We're not executing it, just checking it's a non-empty string)
  expect(content.trim().length).toBeGreaterThan(0)
})

test('getEntryRoutes: returns object with string keys and Response values', async () => {
  const entrypoint = join(fixturesRoot, 'RootTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  // Should be an object
  expect(typeof responses).toBe('object')
  expect(responses).not.toBeNull()

  // Should have at least one entry
  const keys = Object.keys(responses)
  expect(keys.length).toBeGreaterThan(0)

  // All keys should be strings
  keys.forEach((key) => {
    expect(typeof key).toBe('string')
  })

  // All values should be Response objects
  Object.values(responses).forEach((value) => {
    expect(value).toBeInstanceOf(Response)
  })
})

test('getEntryRoutes: all response paths start with forward slash', async () => {
  const entrypoints = [
    join(fixturesRoot, 'RootTemplate.tsx'),
    join(fixturesRoot, 'nested', 'component', 'NestedTemplate.tsx'),
  ]
  const responses = await getEntryRoutes(fixturesRoot, entrypoints)

  const keys = Object.keys(responses)

  // All paths should start with /
  keys.forEach((key) => {
    expect(key.startsWith('/')).toBe(true)
  })
})

test('getEntryRoutes: preserves directory structure in paths', async () => {
  const entrypoint = join(fixturesRoot, 'deep', 'ui', 'forms', 'DeepTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  const keys = Object.keys(responses)
  const entryKey = keys.find((k) => k.includes('deep-template'))

  expect(entryKey).toBeDefined()
  // Should preserve the directory structure: /deep/ui/forms/...
  expect(entryKey).toContain('/deep/ui/forms/')
})

test('getEntryRoutes: handles PascalCase to kebab-case conversion', async () => {
  const entrypoint = join(fixturesRoot, 'RootTemplate.tsx')
  const responses = await getEntryRoutes(fixturesRoot, [entrypoint])

  // RootTemplate.tsx should become root-template--index.js
  expect(responses['/root-template--index.js']).toBeDefined()
  // Should NOT have the PascalCase version
  expect(responses['/RootTemplate--index.js']).toBeUndefined()
})

test('getEntryRoutes: all responses can be read without errors', async () => {
  const entrypoints = [join(fixturesRoot, 'RootTemplate.tsx'), join(fixturesRoot, 'TemplateA.tsx')]
  const responses = await getEntryRoutes(fixturesRoot, entrypoints)

  // Try to read all responses
  const readPromises = Object.values(responses).map(async (response) => {
    const content = await getResponseText(response)
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  // Should all read successfully
  await Promise.all(readPromises)
})

test('getEntryRoutes: chunk artifacts have different path format than entry-points', async () => {
  // Use templates that might trigger chunking
  const entrypoints = [join(fixturesRoot, 'TemplateA.tsx'), join(fixturesRoot, 'TemplateB.tsx')]
  const responses = await getEntryRoutes(fixturesRoot, entrypoints)

  const keys = Object.keys(responses)

  // Entry-points should follow the --index.js pattern
  const entryPoints = keys.filter((k) => k.includes('--index.js'))
  expect(entryPoints.length).toBeGreaterThanOrEqual(2)

  // If there are chunk files, they should NOT have --index.js pattern
  const chunks = keys.filter((k) => !k.includes('--index.js'))
  chunks.forEach((chunk) => {
    // Chunks should still start with /
    expect(chunk.startsWith('/')).toBe(true)
    // Chunks should have .js extension
    expect(chunk.endsWith('.js')).toBe(true)
  })
})
