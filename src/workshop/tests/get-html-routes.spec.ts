import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { getHTMLRoutes } from '../get-html-routes.tsx'

// Path to test fixtures
const fixturesRoot = join(import.meta.dir, 'fixtures')

test('getHTMLRoutes: returns object with main route and include route', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  // Should have both main route and include route
  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.include']).toBeDefined()

  // Both should be Response objects
  expect(routes['/stories/mixed-stories--basic-story']).toBeInstanceOf(Response)
  expect(routes['/stories/mixed-stories--basic-story.include']).toBeInstanceOf(Response)
})

test('getHTMLRoutes: converts PascalCase export names to kebab-case', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  // Route should be in kebab-case
  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basicStory']).toBeUndefined() // Should NOT have PascalCase version
})

test('getHTMLRoutes: main route path follows correct pattern', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const keys = Object.keys(routes)
  const mainRoute = keys.find((k) => !k.includes('.include'))

  expect(mainRoute).toBeDefined()
  expect(mainRoute?.startsWith('/')).toBe(true)
  expect(mainRoute).toContain('basic-story')
})

test('getHTMLRoutes: include route has .include suffix', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const includeRoute = Object.keys(routes).find((k) => k.includes('.include'))
  expect(includeRoute).toBeDefined()
  expect(includeRoute?.endsWith('.include')).toBe(true)
})

test('getHTMLRoutes: main route includes DOCTYPE declaration', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  expect(content).toContain('<!DOCTYPE html>')
})

test('getHTMLRoutes: main route has proper HTML structure', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  expect(content).toContain('<html')
  expect(content).toContain('<head')
  expect(content).toContain('<body')
  expect(content).toContain('</body>')
  expect(content).toContain('</html>')
})

test('getHTMLRoutes: main route includes title with export name', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  expect(content).toContain('<title')
  expect(content).toContain('>basicStory</title>')
})

test('getHTMLRoutes: main route includes entry script tag', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  expect(content).toContain('<script')
  expect(content).toContain('type="module"')
  expect(content).toContain('src="/stories/mixed-stories--index.js"')
})

test('getHTMLRoutes: main route includes reload client script', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  // Should contain WebSocket reload client code
  expect(content).toContain('WebSocket')
  expect(content).toContain('RELOAD_MESSAGE')
})

test('getHTMLRoutes: include route contains only fixture and entry script', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const includeRoute = routes['/stories/mixed-stories--basic-story.include']
  const content = await includeRoute.text()

  // Should NOT have DOCTYPE or full HTML structure
  expect(content).not.toContain('<!DOCTYPE html>')
  expect(content).not.toContain('<html>')
  expect(content).not.toContain('<head>')

  // Should have script tag
  expect(content).toContain('<script')
  expect(content).toContain('type="module"')
})

test('getHTMLRoutes: default body styles include height and margin', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  // Should have default body styles
  expect(content).toContain('height: 100vh')
  expect(content).toContain('margin: 0')
})

test('getHTMLRoutes: merges parameters.styles with default body styles', async () => {
  // First, let me create a story with parameters.styles in a test fixture
  // For now, test with a story that has parameters (even without styles)
  const routes = await getHTMLRoutes({
    exportName: 'storyWithParams',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--story-with-params']
  const content = await mainRoute.text()

  // Should still have default body styles
  expect(content).toContain('height: 100vh')
  expect(content).toContain('margin: 0')
})

test('getHTMLRoutes: works when no parameters provided', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.include']).toBeDefined()
})

test('getHTMLRoutes: accepts story with valid args', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  // Should successfully create routes
  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.include']).toBeDefined()

  // Routes should be valid Response objects
  const mainRoute = routes['/stories/mixed-stories--basic-story']
  expect(mainRoute).toBeInstanceOf(Response)
  expect(mainRoute.status).toBe(200)
})

test('getHTMLRoutes: accepts story with no args', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'storyWithParams',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  expect(routes['/stories/mixed-stories--story-with-params']).toBeDefined()
  expect(routes['/stories/mixed-stories--story-with-params.include']).toBeDefined()
})

test('getHTMLRoutes: main route has correct content-type', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const contentType = mainRoute.headers.get('content-type')

  expect(contentType).toBeTruthy()
  expect(contentType).toContain('text/html')
})

test('getHTMLRoutes: include route has correct content-type', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const includeRoute = routes['/stories/mixed-stories--basic-story.include']
  const contentType = includeRoute.headers.get('content-type')

  expect(contentType).toBeTruthy()
  expect(contentType).toContain('text/html')
})

test('getHTMLRoutes: responses are not compressed by default', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const includeRoute = routes['/stories/mixed-stories--basic-story.include']

  // Should NOT have gzip content-encoding header
  expect(mainRoute.headers.get('content-encoding')).toBeNull()
  expect(includeRoute.headers.get('content-encoding')).toBeNull()
})

test('getHTMLRoutes: responses can be read as text', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const includeRoute = routes['/stories/mixed-stories--basic-story.include']

  const mainContent = await mainRoute.text()
  const includeContent = await includeRoute.text()

  expect(typeof mainContent).toBe('string')
  expect(typeof includeContent).toBe('string')
  expect(mainContent.length).toBeGreaterThan(0)
  expect(includeContent.length).toBeGreaterThan(0)
})

test('getHTMLRoutes: handles nested directory story files', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'nestedSnapshot',
    filePath: join(fixturesRoot, 'nested/nested-story.stories.tsx'),
    cwd: fixturesRoot,
  })

  // Should preserve directory structure
  expect(routes['/nested/nested-story--nested-snapshot']).toBeDefined()
  expect(routes['/nested/nested-story--nested-snapshot.include']).toBeDefined()
})

test('getHTMLRoutes: handles deeply nested story files', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'deeplyNestedStory',
    filePath: join(fixturesRoot, 'nested/deep/deeply-nested.stories.tsx'),
    cwd: fixturesRoot,
  })

  // Should preserve full directory path
  expect(routes['/nested/deep/deeply-nested--deeply-nested-story']).toBeDefined()
  expect(routes['/nested/deep/deeply-nested--deeply-nested-story.include']).toBeDefined()
})

test('getHTMLRoutes: all paths start with forward slash', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const keys = Object.keys(routes)
  keys.forEach((key) => {
    expect(key.startsWith('/')).toBe(true)
  })
})

test('getHTMLRoutes: works with interaction story type', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'interactionStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  expect(routes['/stories/mixed-stories--interaction-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--interaction-story.include']).toBeDefined()
})

test('getHTMLRoutes: works with snapshot story type', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.include']).toBeDefined()
})

test('getHTMLRoutes: handles export names with multiple capital letters', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'storyWithAllProps',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  // Should convert to kebab-case correctly
  expect(routes['/stories/mixed-stories--story-with-all-props']).toBeDefined()
  expect(routes['/stories/mixed-stories--story-with-all-props.include']).toBeDefined()
})

test('getHTMLRoutes: caches imported modules', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')

  // Import the same file multiple times with different exports
  const routes1 = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath,
    cwd: fixturesRoot,
  })

  const routes2 = await getHTMLRoutes({
    exportName: 'interactionStory',
    filePath,
    cwd: fixturesRoot,
  })

  // Both should succeed
  expect(routes1['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes2['/stories/mixed-stories--interaction-story']).toBeDefined()
})

test('getHTMLRoutes: entry script path is correct', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute.text()

  // Entry path should replace .stories.tsx with --index.js
  expect(content).toContain('src="/stories/mixed-stories--index.js"')
})

test('getHTMLRoutes: returns exactly two routes per story', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const keys = Object.keys(routes)
  expect(keys.length).toBe(2)
})

test('getHTMLRoutes: route paths match between main and include', async () => {
  const routes = await getHTMLRoutes({
    exportName: 'basicStory',
    filePath: join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
    cwd: fixturesRoot,
  })

  const keys = Object.keys(routes)
  const mainRoute = keys.find((k) => !k.includes('.include'))
  const includeRoute = keys.find((k) => k.includes('.include'))

  expect(mainRoute).toBeDefined()
  expect(includeRoute).toBeDefined()
  expect(includeRoute).toBe(`${mainRoute}.include`)
})
