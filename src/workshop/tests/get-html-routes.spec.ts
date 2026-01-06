import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { getHTMLRoute } from '../get-html-routes.tsx'
import { getPaths } from '../get-paths.ts'

// Path to test fixtures
const fixturesRoot = join(import.meta.dir, 'fixtures')

// Helper function to get route with proper parameters
const getRouteForStory = async (exportName: string, filePath: string, colorScheme: 'light' | 'dark' = 'light') => {
  const { route, entryPath } = getPaths({ filePath, cwd: fixturesRoot, exportName })
  const response = await getHTMLRoute({ exportName, filePath, entryPath, colorScheme })
  return { route, response }
}

test('getHTMLRoute: returns a Response object', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: includes DOCTYPE declaration', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  expect(content).toContain('<!DOCTYPE html>')
})

test('getHTMLRoute: has proper HTML structure', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  expect(content).toContain('<html')
  expect(content).toContain('<head')
  expect(content).toContain('<body')
  expect(content).toContain('</body>')
  expect(content).toContain('</html>')
})

test('getHTMLRoute: includes title with export name', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  expect(content).toContain('<title')
  expect(content).toContain('>basicStory</title>')
})

test('getHTMLRoute: includes entry script tag', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  expect(content).toContain('<script')
  expect(content).toContain('type="module"')
  // Script now uses inline import statement instead of src attribute
  expect(content).toContain("import { basicStory } from '/stories/mixed-stories.stories.js'")
})

test('getHTMLRoute: includes fixture load script', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  // Should contain fixture load script that triggers run event
  expect(content).toContain('customElements.whenDefined')
  expect(content).toContain("type: 'run'")
})

test('getHTMLRoute: default body styles include height and margin', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  // Should have default body styles
  expect(content).toContain('height: 100vh')
  expect(content).toContain('margin: 0')
})

test('getHTMLRoute: merges parameters.styles with default body styles', async () => {
  const { response } = await getRouteForStory(
    'storyWithParams',
    join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
  )
  const content = await response.text()

  // Should still have default body styles
  expect(content).toContain('height: 100vh')
  expect(content).toContain('margin: 0')
})

test('getHTMLRoute: works when no parameters provided', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(response).toBeDefined()
  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: accepts story with valid args', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(response).toBeInstanceOf(Response)
  expect(response.status).toBe(200)
})

test('getHTMLRoute: accepts story with no args', async () => {
  const { response } = await getRouteForStory(
    'storyWithParams',
    join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
  )

  expect(response).toBeDefined()
  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: has correct content-type', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const contentType = response.headers.get('content-type')

  expect(contentType).toBeTruthy()
  expect(contentType).toContain('text/html')
})

test('getHTMLRoute: response is not compressed by default', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  // Should NOT have gzip content-encoding header
  expect(response.headers.get('content-encoding')).toBeNull()
})

test('getHTMLRoute: response can be read as text', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  expect(typeof content).toBe('string')
  expect(content.length).toBeGreaterThan(0)
})

test('getHTMLRoute: handles nested directory story files', async () => {
  const { response } = await getRouteForStory('nestedSnapshot', join(fixturesRoot, 'nested/nested-story.stories.tsx'))

  expect(response).toBeDefined()
  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: handles deeply nested story files', async () => {
  const { response } = await getRouteForStory(
    'deeplyNestedStory',
    join(fixturesRoot, 'nested/deep/deeply-nested.stories.tsx'),
  )

  expect(response).toBeDefined()
  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: works with interaction story type', async () => {
  const { response } = await getRouteForStory(
    'interactionStory',
    join(fixturesRoot, 'stories/mixed-stories.stories.tsx'),
  )

  expect(response).toBeDefined()
  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: works with snapshot story type', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))

  expect(response).toBeDefined()
  expect(response).toBeInstanceOf(Response)
})

test('getHTMLRoute: caches imported modules', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')

  // Import the same file multiple times with different exports
  const { response: response1 } = await getRouteForStory('basicStory', filePath)
  const { response: response2 } = await getRouteForStory('interactionStory', filePath)

  // Both should succeed
  expect(response1).toBeInstanceOf(Response)
  expect(response2).toBeInstanceOf(Response)
})

test('getHTMLRoute: entry script path is correct', async () => {
  const { response } = await getRouteForStory('basicStory', join(fixturesRoot, 'stories/mixed-stories.stories.tsx'))
  const content = await response.text()

  // Entry path should replace .stories.tsx with .stories.js in inline import
  expect(content).toContain("import { basicStory } from '/stories/mixed-stories.stories.js'")
})

test('getHTMLRoute: applies light colorScheme to html tag', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')
  const exportName = 'basicStory'
  const { entryPath } = getPaths({ filePath, cwd: fixturesRoot, exportName })

  const response = await getHTMLRoute({
    exportName,
    filePath,
    entryPath,
    colorScheme: 'light',
  })
  const content = await response.text()

  // Check for color-scheme: light in html tag style attribute
  expect(content).toMatch(/<html[^>]*style="[^"]*color-scheme:\s*light[^"]*"/)
})

test('getHTMLRoute: applies dark colorScheme to html tag', async () => {
  const filePath = join(fixturesRoot, 'stories/mixed-stories.stories.tsx')
  const exportName = 'basicStory'
  const { entryPath } = getPaths({ filePath, cwd: fixturesRoot, exportName })

  const response = await getHTMLRoute({
    exportName,
    filePath,
    entryPath,
    colorScheme: 'dark',
  })
  const content = await response.text()

  // Check for color-scheme: dark in html tag style attribute
  expect(content).toMatch(/<html[^>]*style="[^"]*color-scheme:\s*dark[^"]*"/)
})
