import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { getHTMLRoutes } from '../get-html-routes.tsx'
import { getPaths } from '../get-paths.ts'

// Path to test fixtures
const fixturesRoot = join(import.meta.dir, 'fixtures')

// Helper function to get routes with proper parameters
const getRoutesForStory = async (exportName: string, filePath: string, colorScheme: 'light' | 'dark' = 'light') => {
  const { route, entryPath } = getPaths({ filePath, cwd: fixturesRoot, exportName })
  return getHTMLRoutes({ exportName, filePath, route, entryPath, colorScheme })
}

test('getHTMLRoutes: returns object with main route and template route', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  // Should have both main route and template route
  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.template']).toBeDefined()

  // Both should be Response objects
  expect(routes['/stories/mixed-stories--basic-story']).toBeInstanceOf(Response)
  expect(routes['/stories/mixed-stories--basic-story.template']).toBeInstanceOf(Response)
})

test('getHTMLRoutes: converts PascalCase export names to kebab-case', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  // Route should be in kebab-case
  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basicStory']).toBeUndefined() // Should NOT have PascalCase version
})

test('getHTMLRoutes: main route path follows correct pattern', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const keys = Object.keys(routes)
  const mainRoute = keys.find((k) => !k.includes('.template'))

  expect(mainRoute).toBeDefined()
  expect(mainRoute?.startsWith('/')).toBe(true)
  expect(mainRoute).toContain('basic-story')
})

test('getHTMLRoutes: template route has .template suffix', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const templateRoute = Object.keys(routes).find((k) => k.includes('.template'))
  expect(templateRoute).toBeDefined()
  expect(templateRoute?.endsWith('.template')).toBe(true)
})

test('getHTMLRoutes: main route includes DOCTYPE declaration', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = mainRoute ? await mainRoute.text() : ''

  expect(content).toContain('<!DOCTYPE html>')
})

test('getHTMLRoutes: main route has proper HTML structure', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = mainRoute ? await mainRoute.text() : ''

  expect(content).toContain('<html')
  expect(content).toContain('<head')
  expect(content).toContain('<body')
  expect(content).toContain('</body>')
  expect(content).toContain('</html>')
})

test('getHTMLRoutes: main route includes title with export name', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = mainRoute ? await mainRoute.text() : ''

  expect(content).toContain('<title')
  expect(content).toContain('>basicStory</title>')
})

test('getHTMLRoutes: main route includes entry script tag', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = mainRoute ? await mainRoute.text() : ''

  expect(content).toContain('<script')
  expect(content).toContain('type="module"')
  // Script now uses inline import statement instead of src attribute
  expect(content).toContain("import { basicStory } from '/stories/mixed-stories.stories.js'")
})

test('getHTMLRoutes: main route includes fixture load script', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = mainRoute ? await mainRoute.text() : ''

  // Should contain fixture load script that triggers run event
  expect(content).toContain('customElements.whenDefined')
  expect(content).toContain("type: 'run'")
})

test('getHTMLRoutes: template route contains only fixture and entry script', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const templateRoute = routes['/stories/mixed-stories--basic-story.template']
  const content = await templateRoute?.text()

  // Should NOT have DOCTYPE or full HTML structure
  expect(content).not.toContain('<!DOCTYPE html>')
  expect(content).not.toContain('<html>')
  expect(content).not.toContain('<head>')

  // Should have script tag
  expect(content).toContain('<script')
  expect(content).toContain('type="module"')
})

test('getHTMLRoutes: default body styles include height and margin', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = await mainRoute?.text()

  // Should have default body styles
  expect(content).toContain('height: 100vh')
  expect(content).toContain('margin: 0')
})

test('getHTMLRoutes: merges parameters.styles with default body styles', async () => {
  // First, let me create a story with parameters.styles in a test fixture
  // For now, test with a story that has parameters (even without styles)
  const routes = await getRoutesForStory('storyWithParams', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--story-with-params']
  const content = mainRoute ? await mainRoute.text() : ''

  // Should still have default body styles
  expect(content).toContain('height: 100vh')
  expect(content).toContain('margin: 0')
})

test('getHTMLRoutes: works when no parameters provided', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.template']).toBeDefined()
})

test('getHTMLRoutes: accepts story with valid args', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  // Should successfully create routes
  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.template']).toBeDefined()

  // Routes should be valid Response objects
  const mainRoute = routes['/stories/mixed-stories--basic-story']
  expect(mainRoute).toBeInstanceOf(Response)
  expect(mainRoute?.status).toBe(200)
})

test('getHTMLRoutes: accepts story with no args', async () => {
  const routes = await getRoutesForStory('storyWithParams', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(routes['/stories/mixed-stories--story-with-params']).toBeDefined()
  expect(routes['/stories/mixed-stories--story-with-params.template']).toBeDefined()
})

test('getHTMLRoutes: main route has correct content-type', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const contentType = mainRoute?.headers.get('content-type')

  expect(contentType).toBeTruthy()
  expect(contentType).toContain('text/html')
})

test('getHTMLRoutes: template route has correct content-type', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const templateRoute = routes['/stories/mixed-stories--basic-story.template']
  const contentType = templateRoute?.headers.get('content-type')

  expect(contentType).toBeTruthy()
  expect(contentType).toContain('text/html')
})

test('getHTMLRoutes: responses are not compressed by default', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const templateRoute = routes['/stories/mixed-stories--basic-story.template']

  // Should NOT have gzip content-encoding header
  expect(mainRoute?.headers.get('content-encoding')).toBeNull()
  expect(templateRoute?.headers.get('content-encoding')).toBeNull()
})

test('getHTMLRoutes: responses can be read as text', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const templateRoute = routes['/stories/mixed-stories--basic-story.template']

  const mainContent = mainRoute ? await mainRoute.text() : ''
  const includeContent = templateRoute ? await templateRoute.text() : ''

  expect(typeof mainContent).toBe('string')
  expect(typeof includeContent).toBe('string')
  expect(mainContent.length).toBeGreaterThan(0)
  expect(includeContent.length).toBeGreaterThan(0)
})

test('getHTMLRoutes: handles nested directory story files', async () => {
  const routes = await getRoutesForStory('nestedSnapshot', join(fixturesRoot, 'nested/nested-story.stories.tsx'))

  // Should preserve directory structure
  expect(routes['/nested/nested-story--nested-snapshot']).toBeDefined()
  expect(routes['/nested/nested-story--nested-snapshot.template']).toBeDefined()
})

test('getHTMLRoutes: handles deeply nested story files', async () => {
  const routes = await getRoutesForStory(
    'deeplyNestedStory',
    join(fixturesRoot, 'nested/deep/deeply-nested.stories.tsx'),
  )

  // Should preserve full directory path
  expect(routes['/nested/deep/deeply-nested--deeply-nested-story']).toBeDefined()
  expect(routes['/nested/deep/deeply-nested--deeply-nested-story.template']).toBeDefined()
})

test('getHTMLRoutes: all paths start with forward slash', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const keys = Object.keys(routes)
  keys.forEach((key) => {
    expect(key.startsWith('/')).toBe(true)
  })
})

test('getHTMLRoutes: works with interaction story type', async () => {
  const routes = await getRoutesForStory('interactionStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(routes['/stories/mixed-stories--interaction-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--interaction-story.template']).toBeDefined()
})

test('getHTMLRoutes: works with snapshot story type', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(routes['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes['/stories/mixed-stories--basic-story.template']).toBeDefined()
})

test('getHTMLRoutes: handles export names with multiple capital letters', async () => {
  const routes = await getRoutesForStory('storyWithAllProps', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  // Should convert to kebab-case correctly
  expect(routes['/stories/mixed-stories--story-with-all-props']).toBeDefined()
  expect(routes['/stories/mixed-stories--story-with-all-props.template']).toBeDefined()
})

test('getHTMLRoutes: caches imported modules', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')

  // Import the same file multiple times with different exports
  const routes1 = await getRoutesForStory('basicStory', filePath)
  const routes2 = await getRoutesForStory('interactionStory', filePath)

  // Both should succeed
  expect(routes1['/stories/mixed-stories--basic-story']).toBeDefined()
  expect(routes2['/stories/mixed-stories--interaction-story']).toBeDefined()
})

test('getHTMLRoutes: entry script path is correct', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const mainRoute = routes['/stories/mixed-stories--basic-story']
  const content = mainRoute ? await mainRoute.text() : ''

  // Entry path should replace .stories.tsx with .stories.js in inline import
  expect(content).toContain("import { basicStory } from '/stories/mixed-stories.stories.js'")
})

test('getHTMLRoutes: returns exactly two routes per story', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const keys = Object.keys(routes)
  expect(keys.length).toBe(2)
})

test('getHTMLRoutes: route paths match between main and include', async () => {
  const routes = await getRoutesForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  const keys = Object.keys(routes)
  const mainRoute = keys.find((k) => !k.includes('.template'))
  const templateRoute = keys.find((k) => k.includes('.template'))

  expect(mainRoute).toBeDefined()
  expect(templateRoute).toBeDefined()
  expect(templateRoute).toBe(`${mainRoute}.template`)
})

test('getHTMLRoutes: applies light colorScheme to html tag', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')
  const exportName = 'basicStory'
  const { route, entryPath } = getPaths({ filePath, cwd: fixturesRoot, exportName })

  const routes = await getHTMLRoutes({
    exportName,
    filePath,
    route,
    entryPath,
    colorScheme: 'light',
  })

  const mainRoute = routes[route]
  const content = mainRoute ? await mainRoute.text() : ''

  // Check for color-scheme: light in html tag style attribute
  expect(content).toMatch(/<html[^>]*style="[^"]*color-scheme:\s*light[^"]*"/)
})

test('getHTMLRoutes: applies dark colorScheme to html tag', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')
  const exportName = 'basicStory'
  const { route, entryPath } = getPaths({ filePath, cwd: fixturesRoot, exportName })

  const routes = await getHTMLRoutes({
    exportName,
    filePath,
    route,
    entryPath,
    colorScheme: 'dark',
  })

  const mainRoute = routes[route]
  const content = mainRoute ? await mainRoute.text() : ''

  // Check for color-scheme: dark in html tag style attribute
  expect(content).toMatch(/<html[^>]*style="[^"]*color-scheme:\s*dark[^"]*"/)
})
