import { test, expect } from 'bun:test'
import { getHTMLRoutes } from '../get-html-routes.js'
import { join } from 'node:path'

// Helper to create mock Request objects
const createMockRequest = (attrs?: Record<string, unknown>) => {
  if (!attrs) {
    return new Request('http://localhost:3456/test', { method: 'GET' })
  }
  return new Request('http://localhost:3456/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attrs),
  })
}

// Helper to decompress gzipped response
const decompressResponse = async (response: Response): Promise<string> => {
  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  return new TextDecoder().decode(decompressed)
}

// Create test fixtures directory for actual template files
const fixturesDir = join(import.meta.dir, 'fixtures')

test('getHTMLRoutes: returns route object with page and include handlers', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const keys = Object.keys(routes)
  expect(keys).toHaveLength(2)
  expect(keys.some((k) => !k.endsWith('.include'))).toBe(true)
  expect(keys.some((k) => k.endsWith('.include'))).toBe(true)
})

test('getHTMLRoutes: page route has correct format', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))
  expect(pageRoute).toBe('/templates/function-templates--simple-template')
})

test('getHTMLRoutes: include route has correct format', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))
  expect(includeRoute).toBe('/templates/function-templates--simple-template.include')
})

test('getHTMLRoutes: nested path creates correct route', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'entry-routes/nested/component/NestedTemplate.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'NestedTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))
  expect(pageRoute).toBe('/entry-routes/nested/component/nested-template--nested-template')
})

test('getHTMLRoutes: page handler generates correct import path', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('src="/templates/function-templates--index.js"')
})

test('getHTMLRoutes: nested path generates correct import path', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'entry-routes/deep/ui/forms/DeepTemplate.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'DeepTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('src="/entry-routes/deep/ui/forms/deep-template--index.js"')
})

test('getHTMLRoutes: page response has DOCTYPE and full HTML structure', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('<!DOCTYPE html>')
  expect(html).toContain('<html')
  expect(html).toContain('<head')
  expect(html).toContain('<body')
  expect(html).toContain('</html>')
})

test('getHTMLRoutes: page includes title with export name', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toMatch(/<title\s*>SimpleTemplate<\/title>/)
})

test('getHTMLRoutes: page includes favicon link', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('<link rel="shortcut icon" href="#"')
})

test('getHTMLRoutes: page includes WebSocket reload client', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('WebSocket hot reload client')
  expect(html).toContain('new WebSocket')
})

test('getHTMLRoutes: include response has only partial HTML', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest()
  const response = await includeHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).not.toContain('<!DOCTYPE html>')
  expect(html).not.toContain('<html')
  expect(html).not.toContain('<head')
  expect(html).not.toContain('</html>')
})

test('getHTMLRoutes: include response has module script', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest()
  const response = await includeHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('type="module"')
  expect(html).toContain('src="/templates/function-templates--index.js"')
})

test('getHTMLRoutes: include response does NOT have reload client', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest()
  const response = await includeHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).not.toContain('WebSocket hot reload client')
  expect(html).not.toContain('new WebSocket')
})

test('getHTMLRoutes: page response is gzipped', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)

  expect(response.headers.get('content-encoding')).toBe('gzip')
})

test('getHTMLRoutes: include response is gzipped', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest()
  const response = await includeHandler.POST(req)

  expect(response.headers.get('content-encoding')).toBe('gzip')
})

test('getHTMLRoutes: page response has correct Content-Type', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)

  expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
})

test('getHTMLRoutes: include response has correct Content-Type', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest()
  const response = await includeHandler.POST(req)

  expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
})

test('getHTMLRoutes: body has height styles applied', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest()
  const response = await pageHandler.POST(req)
  const html = await decompressResponse(response)

  expect(html).toContain('body { height: 100vh; height: 100dvh; margin: 0; }')
})

test('getHTMLRoutes: custom headers are merged from Request', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]

  const req = new Request('http://localhost:3456/test', {
    method: 'GET',
    headers: {
      'Accept-Encoding': 'gzip, deflate',
    },
  })

  const response = await pageHandler.POST(req)

  // Standard headers should be present
  expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
  expect(response.headers.get('content-encoding')).toBe('gzip')
})

// Validation tests
test('getHTMLRoutes: page handler accepts empty request body (no attrs)', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest() // No attrs
  const response = await pageHandler.POST(req)

  expect(response.status).toBe(200)
  const html = await decompressResponse(response)
  expect(html).toContain('<!DOCTYPE html>')
})

test('getHTMLRoutes: include handler accepts empty request body (no attrs)', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest() // No attrs
  const response = await includeHandler.POST(req)

  expect(response.status).toBe(200)
  const html = await decompressResponse(response)
  expect(html).toContain('<script')
})

test('getHTMLRoutes: page handler accepts valid PlaitedAttributes', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]
  const req = createMockRequest({
    class: 'test-class',
    children: 'test content',
  })
  const response = await pageHandler.POST(req)

  expect(response.status).toBe(200)
})

test('getHTMLRoutes: include handler accepts valid PlaitedAttributes', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]
  const req = createMockRequest({
    class: 'test-class',
    stylesheets: ['body { color: red; }'],
  })
  const response = await includeHandler.POST(req)

  expect(response.status).toBe(200)
})

test('getHTMLRoutes: page handler returns 400 for invalid attrs structure', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]

  // Invalid: class should be string, not number
  const req = createMockRequest({
    class: 12345,
  })
  const response = await pageHandler.POST(req)

  expect(response.status).toBe(400)
  expect(response.headers.get('content-type')).toBe('application/json')

  const errorData = await response.json()
  expect(errorData).toHaveProperty('error')
  expect(errorData).toHaveProperty('details')
})

test('getHTMLRoutes: include handler returns 400 for invalid attrs structure', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]

  // Invalid: stylesheets should be array of strings, not array of numbers
  const req = createMockRequest({
    stylesheets: [123, 456],
  })
  const response = await includeHandler.POST(req)

  expect(response.status).toBe(400)
  expect(response.headers.get('content-type')).toBe('application/json')

  const errorData = await response.json()
  expect(errorData).toHaveProperty('error')
  expect(errorData.error).toBe('Invalid request body')
})

test('getHTMLRoutes: page handler accepts additional HTML attributes via passthrough', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const pageRoute = Object.keys(routes).find((k) => !k.endsWith('.include'))!
  const pageHandler = routes[pageRoute]

  // Additional HTML attrs should pass through validation
  const req = createMockRequest({
    id: 'custom-id',
    'data-testid': 'test',
    'aria-label': 'Test Label',
  })
  const response = await pageHandler.POST(req)

  expect(response.status).toBe(200)
})

test('getHTMLRoutes: include handler accepts additional HTML attributes via passthrough', async () => {
  const cwd = fixturesDir
  const filePath = join(fixturesDir, 'templates/function-templates.tsx')

  const routes = await getHTMLRoutes({
    exportName: 'SimpleTemplate',
    filePath,
    cwd,
  })

  const includeRoute = Object.keys(routes).find((k) => k.endsWith('.include'))!
  const includeHandler = routes[includeRoute]

  // Additional HTML attrs should pass through validation
  const req = createMockRequest({
    role: 'button',
    'aria-pressed': 'true',
  })
  const response = await includeHandler.POST(req)

  expect(response.status).toBe(200)
})
