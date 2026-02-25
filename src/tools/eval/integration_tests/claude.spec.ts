/**
 * Integration tests for Claude Code headless adapter.
 *
 * @remarks
 * Tests verify the headless session manager works correctly with Claude Code CLI
 * using the schema-driven headless adapter approach.
 *
 * Run locally with API key:
 * ```bash
 * ANTHROPIC_API_KEY=sk-... bun test ./src/integration_tests/claude.spec.ts
 * ```
 *
 * Prerequisites:
 * 1. Claude CLI installed (`curl -fsSL https://claude.ai/install.sh | bash`)
 * 2. API key: `ANTHROPIC_API_KEY` environment variable
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

// Schema path for Claude headless adapter
const SCHEMA_PATH = join(PROJECT_ROOT, 'src/headless/tests/fixtures/claude-headless.json')

// Get API key from environment
const API_KEY = process.env.ANTHROPIC_API_KEY ?? ''

// Skip all tests if no API key is available
const describeWithApiKey = API_KEY ? describe : describe.skip

describeWithApiKey('Claude Code Integration', () => {
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

  test('uses MCP server from project config', async () => {
    // This test verifies that Claude discovers MCP servers from .mcp.json
    // The bun-docs MCP server is configured at project root
    const session = await sessionManager.create(PROJECT_ROOT)

    // Query the bun-docs MCP server (configured in .mcp.json)
    const result = await sessionManager.prompt(
      session.id,
      'Use the bun-docs MCP server to search for information about Bun.serve(). ' +
        'What are the key options for creating an HTTP server with Bun?',
    )

    // Response should contain Bun server-related information
    expect(result.output.length).toBeGreaterThan(0)
    // Should mention server/HTTP-related concepts from Bun docs
    expect(result.output.toLowerCase()).toMatch(/serve|server|http|port|fetch|handler/)
  })

  test('multi-turn conversation maintains context (stream mode)', async () => {
    // Multi-turn: multiple prompts to same session
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

  test('receives valid trajectory updates', async () => {
    const session = await sessionManager.create(PROJECT_ROOT)

    // Prompt that generates a response with trajectory updates
    const result = await sessionManager.prompt(
      session.id,
      'What programming language is this project written in? Look at the file extensions.',
    )

    // Result should have output
    expect(result.output).toBeDefined()
    expect(result.output.length).toBeGreaterThan(0)

    // Should have collected updates during execution
    expect(result.updates).toBeInstanceOf(Array)
    expect(result.updates.length).toBeGreaterThan(0)

    // All updates should have valid types
    const validTypes = ['thought', 'tool_call', 'message', 'plan']
    const allValidTypes = result.updates.every((u) => validTypes.includes(u.type))
    expect(allValidTypes).toBe(true)
  })
})
