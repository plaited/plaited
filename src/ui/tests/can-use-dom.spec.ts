import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { canUseDOM } from '../can-use-dom.ts'

describe('canUseDOM', () => {
  test('returns false in a non-browser environment (no window)', () => {
    // bun:test runs without a DOM by default
    expect(canUseDOM()).toBe(false)
  })
})

describe('canUseDOM with happy-dom', () => {
  beforeAll(async () => {
    const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
    await GlobalRegistrator.register()
  })

  afterAll(async () => {
    const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
    await GlobalRegistrator.unregister()
  })

  test('returns true when DOM APIs are available', () => {
    expect(canUseDOM()).toBe(true)
  })

  test('detects window.document', () => {
    expect(typeof window).toBe('object')
    expect(window.document).toBeDefined()
  })

  test('detects document.createElement', () => {
    expect(typeof window.document.createElement).toBe('function')
  })
})
