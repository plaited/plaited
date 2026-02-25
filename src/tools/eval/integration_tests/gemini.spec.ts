/**
 * Integration tests for Gemini CLI headless adapter.
 *
 * @remarks
 * Tests verify the headless session manager works correctly with Gemini CLI
 * using the schema-driven headless adapter approach.
 *
 * Run locally with API key:
 * ```bash
 * GEMINI_API_KEY=... bun test ./src/integration_tests/gemini.spec.ts
 * ```
 *
 * Prerequisites:
 * 1. Gemini CLI installed (`npm install -g @google/gemini-cli`)
 * 2. API key: `GEMINI_API_KEY` environment variable
 *
 * These tests make real API calls and consume credits.
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { parseHeadlessConfig } from '../headless/headless.schemas.ts'
import { createSessionManager } from '../headless/headless-session-manager.ts'

// Long timeout for real agent interactions (2 minutes)
setDefaultTimeout(120000)

// Use project root as cwd - agents discover MCP servers from config files
const PROJECT_ROOT = process.cwd()

// Schema path for Gemini headless adapter
const SCHEMA_PATH = join(PROJECT_ROOT, 'src/headless/tests/fixtures/gemini-headless.json')

// Get API key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''

// Skip all tests if no API key is available
const describeWithApiKey = GEMINI_API_KEY ? describe : describe.skip

describeWithApiKey('Gemini CLI Integration', () => {
  let sessionManager: ReturnType<typeof createSessionManager>
  let schemaConfig: ReturnType<typeof parseHeadlessConfig>

  beforeAll(async () => {
    // Load JSON from file, then parse with Zod schema
    const schemaJson = await Bun.file(SCHEMA_PATH).json()
    schemaConfig = parseHeadlessConfig(schemaJson)

    // Create session manager with the schema
    sessionManager = createSessionManager({
      schema: schemaConfig,
      timeout: 120000,
      debug: false,
    })
  })

  afterAll(async () => {
    // Cleanup handled automatically by session manager
  })

  test('creates session successfully', async () => {
    const session = await sessionManager.create(PROJECT_ROOT)

    expect(session).toBeDefined()
    expect(session.id).toBeDefined()
    expect(typeof session.id).toBe('string')
    expect(session.active).toBe(true)
    expect(session.cwd).toBe(PROJECT_ROOT)
  })

  test('sends prompt and receives response', async () => {
    const session = await sessionManager.create(PROJECT_ROOT)

    // Simple prompt that doesn't require tools
    const result = await sessionManager.prompt(session.id, 'What is 2 + 2? Reply with just the number.')

    expect(result).toBeDefined()
    expect(result.output).toBeDefined()
    expect(result.output.length).toBeGreaterThan(0)
    expect(result.updates).toBeInstanceOf(Array)

    // Should contain "4" somewhere in the response
    expect(result.output).toMatch(/4/)
  })

  test('collects trajectory updates during execution', async () => {
    const session = await sessionManager.create(PROJECT_ROOT)
    const collectedUpdates: unknown[] = []

    const result = await sessionManager.prompt(session.id, 'Say "hello" and nothing else.', (update) => {
      collectedUpdates.push(update)
    })

    expect(result.updates.length).toBeGreaterThan(0)

    // Should have at least one message update
    const messageUpdates = result.updates.filter((u) => u.type === 'message')
    expect(messageUpdates.length).toBeGreaterThan(0)
  })

  test('multi-turn conversation maintains context (iterative mode)', async () => {
    // Multi-turn via headless adapter in iterative mode (history accumulation)
    const session = await sessionManager.create(PROJECT_ROOT)

    // Turn 1: Establish context
    const turn1Result = await sessionManager.prompt(session.id, 'Remember this number: 42. Just confirm you have it.')
    expect(turn1Result.output).toMatch(/42|forty.?two|remember/i)

    // Turn 2: Reference previous context
    const turn2Result = await sessionManager.prompt(
      session.id,
      'What number did I ask you to remember? Reply with just the number.',
    )
    expect(turn2Result.output).toMatch(/42/)
  })

  test('handles simple math question correctly', async () => {
    const session = await sessionManager.create(PROJECT_ROOT)

    const result = await sessionManager.prompt(session.id, 'Calculate 15 * 7. Reply with just the number.')

    // Gemini CLI may include formatting variations (newlines, spaces)
    // Strip whitespace to verify the correct answer is present
    expect(result.output.replace(/\s/g, '')).toContain('105')
  })

  test('processes longer response without timeout', async () => {
    const session = await sessionManager.create(PROJECT_ROOT)

    const result = await sessionManager.prompt(
      session.id,
      'List 5 programming languages and one key feature of each. Be brief.',
    )

    expect(result.output.length).toBeGreaterThan(50)
    // Should mention at least some programming languages
    expect(result.output.toLowerCase()).toMatch(/python|javascript|java|rust|go|typescript|c\+\+|ruby/)
  })
})
