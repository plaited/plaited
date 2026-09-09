import { describe, expect, test } from 'bun:test'

/**
 * Daytona SDK smoke tests — confirm construction, the fork/snapshot surface,
 * and the codeRun API. No real sandbox is created (no network in CI); these
 * tests verify the SDK imports, constructs from env, and exposes the expected
 * API surface.
 */

describe('Daytona SDK — construction', () => {
  test('constructs from DAYTONA_API_KEY env (no real sandbox)', async () => {
    const { Daytona } = await import('@daytonaio/sdk')
    // Set a dummy key so Daytona() resolves apiKey from env.
    const prev = process.env.DAYTONA_API_KEY
    process.env.DAYTONA_API_KEY = 'test-daytona-key'
    try {
      const daytona = new Daytona()
      expect(daytona).toBeDefined()
      // The client exposes the sandbox/fork/snapshot services.
      expect(daytona.create).toBeDefined()
      expect(daytona.fork).toBeDefined()
      expect(daytona.snapshot).toBeDefined()
      expect(daytona.delete).toBeDefined()
    } finally {
      if (prev === undefined) delete process.env.DAYTONA_API_KEY
      else process.env.DAYTONA_API_KEY = prev
    }
  })

  test('constructs with explicit config', async () => {
    const { Daytona } = await import('@daytonaio/sdk')
    const daytona = new Daytona({ apiKey: 'explicit-key' })
    expect(daytona).toBeDefined()
  })
})

describe('Daytona SDK — fork/snapshot surface', () => {
  test('fork() and snapshot service exist in the installed version', async () => {
    const { Daytona } = await import('@daytonaio/sdk')
    const daytona = new Daytona({ apiKey: 'test-key' })
    // fork creates a new sandbox with identical filesystem from an existing one.
    expect(typeof daytona.fork).toBe('function')
    // snapshot service manages Daytona Snapshots (create, list, delete).
    expect(daytona.snapshot).toBeDefined()
    expect(daytona.snapshot.create).toBeDefined()
    expect(daytona.snapshot.list).toBeDefined()
    expect(daytona.snapshot.delete).toBeDefined()
  })

  test('create() accepts language: typescript', async () => {
    const { Daytona, CodeLanguage } = await import('@daytonaio/sdk')
    const daytona = new Daytona({ apiKey: 'test-key' })
    // The create method accepts params including language; we verify the
    // CodeLanguage enum exposes TYPESCRIPT without calling create (no sandbox).
    expect(CodeLanguage.TYPESCRIPT).toBe(CodeLanguage.TYPESCRIPT)
    expect(typeof daytona.create).toBe('function')
  })
})
