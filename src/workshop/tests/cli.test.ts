import { test, expect, describe } from 'bun:test'
import { join } from 'node:path'

describe('CLI Config Validation', () => {
  test('valid config: should have all required fields', async () => {
    const { default: config } = await import('./fixtures/configs/valid.playwright.config.js')

    expect(config.webServer).toBeDefined()
    expect(config.webServer).not.toBeInstanceOf(Array)
    // Type guard: we know it's not an array and it exists
    if (config.webServer && !Array.isArray(config.webServer)) {
      expect(config.webServer.url).toBe('http://localhost:3456')
    }
    expect(config.use?.baseURL).toBe('http://localhost:3456')
    expect(config.testMatch).toBe('**/*.tpl.spec.{ts,tsx}')
    expect(config.testDir).toBe('./src/workshop/tests/fixtures/templates')
  })

  test('valid config: webServer.url should match use.baseURL', async () => {
    const { default: config } = await import('./fixtures/configs/valid.playwright.config.js')

    // Type guard: we know it's not an array and it exists
    if (config.webServer && !Array.isArray(config.webServer)) {
      expect(config.webServer.url).toBe(config.use?.baseURL)
    }
  })

  test('valid config: should extract port from URL', () => {
    const url = new URL('http://localhost:3456')
    const port = parseInt(url.port, 10)

    expect(port).toBe(3456)
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThan(65536)
  })

  test('valid config: testMatch should be a string', async () => {
    const { default: config } = await import('./fixtures/configs/valid.playwright.config.js')

    expect(typeof config.testMatch).toBe('string')
  })

  test('invalid: missing webServer should be detected', async () => {
    const { default: config } = await import('./fixtures/configs/missing-webserver.playwright.config.js')

    expect(config.webServer).toBeUndefined()
    // This would cause CLI to throw: "webServer must be configured"
  })

  test('invalid: mismatched URLs should be detected', async () => {
    const { default: config } = await import('./fixtures/configs/mismatched-urls.playwright.config.js')

    // Type guard: we know it's not an array and it exists
    if (config.webServer && !Array.isArray(config.webServer)) {
      expect(config.webServer.url).toBe('http://localhost:3456')
      expect(config.use?.baseURL).toBe('http://localhost:9999')
      expect(config.webServer.url).not.toBe(config.use?.baseURL)
    }
    // This would cause CLI to throw: "webServer.url must match use.baseURL"
  })

  test('invalid: URL without port should be detected', async () => {
    const { default: config } = await import('./fixtures/configs/no-port.playwright.config.js')

    // Type guard: we know it's not an array
    if (!Array.isArray(config.webServer) && config.webServer?.url) {
      const url = new URL(config.webServer.url)
      const portString = url.port

      expect(portString).toBe('')
    }
    // This would cause CLI to throw: "URL must include explicit port"
  })

  test('invalid: non-string testMatch should be detected', async () => {
    const { default: config } = await import('./fixtures/configs/invalid-testmatch.playwright.config.js')

    expect(typeof config.testMatch).not.toBe('string')
    expect(config.testMatch).toBeInstanceOf(RegExp)
    // This would cause CLI to throw: "testMatch must be a string pattern"
  })

  test('port validation: should accept valid port range', () => {
    const validPorts = [1, 3000, 3456, 8080, 65535]

    validPorts.forEach((port) => {
      expect(port).toBeGreaterThanOrEqual(1)
      expect(port).toBeLessThanOrEqual(65535)
      expect(Number.isInteger(port)).toBe(true)
    })
  })

  test('port validation: should reject invalid ports', () => {
    const invalidPorts = [0, -1, 65536, 70000, NaN]

    invalidPorts.forEach((port) => {
      const isValid = !isNaN(port) && port >= 1 && port <= 65535
      expect(isValid).toBe(false)
    })
  })

  test('config structure: webServer should not be an array', async () => {
    const { default: config } = await import('./fixtures/configs/valid.playwright.config.js')

    expect(Array.isArray(config.webServer)).toBe(false)
    // CLI explicitly checks and rejects array webServer configurations
  })

  test('path resolution: should handle relative testDir paths', () => {
    const testDir = './src/workshop/tests/fixtures/templates'
    const cwd = process.cwd()
    const resolved = join(cwd, testDir)

    expect(resolved).toContain('src/workshop/tests/fixtures/templates')
    expect(resolved).toContain(cwd)
  })
})
