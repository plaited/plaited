/**
 * ACP Client Integration Tests
 *
 * @remarks
 * These tests verify the ACP client works against real Claude Code
 * via the `claude-code-acp` adapter.
 *
 * **Run in Docker only** for consistent environment:
 * ```bash
 * ANTHROPIC_API_KEY=sk-... bun run test:acp
 * ```
 *
 * Prerequisites:
 * 1. Docker installed
 * 2. API key: `ANTHROPIC_API_KEY` environment variable
 *
 * These tests make real API calls and consume credits.
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { type ACPClient, createACPClient } from '../acp-client.ts'
import { createPrompt, summarizeResponse } from '../acp-helpers.ts'

// Long timeout for real agent interactions (2 minutes)
setDefaultTimeout(120000)

// Fixtures directory with .claude/skills and .mcp.json
const FIXTURES_DIR = `${import.meta.dir}/fixtures`

// Use haiku for all tests to reduce costs
const TEST_MODEL = 'claude-haiku-4-5-20251001'

describe('ACP Client Integration', () => {
  let client: ACPClient

  beforeAll(async () => {
    // cc-acp adapter expects ANTHROPIC_API_KEY
    client = createACPClient({
      command: ['bunx', 'claude-code-acp'],
      timeout: 120000, // 2 min timeout for initialization
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
      },
    })

    await client.connect()
  })

  afterAll(async () => {
    await client?.disconnect()
  })

  test('connects and initializes', () => {
    expect(client.isConnected()).toBe(true)

    const initResult = client.getInitializeResult()
    expect(initResult).toBeDefined()
    expect(initResult?.protocolVersion).toBeDefined()
  })

  test('reports agent capabilities', () => {
    const capabilities = client.getCapabilities()
    expect(capabilities).toBeDefined()
  })

  test('creates session', async () => {
    const session = await client.createSession({
      cwd: FIXTURES_DIR,
      mcpServers: [],
    })

    expect(session).toBeDefined()
    expect(session.id).toBeDefined()
    expect(typeof session.id).toBe('string')
  })

  test('sends prompt and receives response', async () => {
    const session = await client.createSession({
      cwd: FIXTURES_DIR,
      mcpServers: [],
    })

    // Use haiku for faster/cheaper test runs
    await client.setModel(session.id, TEST_MODEL)

    // Simple prompt that doesn't require tools
    const { result, updates } = await client.promptSync(
      session.id,
      createPrompt('What is 2 + 2? Reply with just the number.'),
    )

    expect(result).toBeDefined()
    expect(updates).toBeInstanceOf(Array)

    // Summarize and verify response structure
    const summary = summarizeResponse(updates)
    expect(summary.text).toBeDefined()
    expect(summary.text.length).toBeGreaterThan(0)
  })

  test('streaming prompt yields updates', async () => {
    const session = await client.createSession({
      cwd: FIXTURES_DIR,
      mcpServers: [],
    })

    // Use haiku for faster/cheaper test runs
    await client.setModel(session.id, TEST_MODEL)

    const events: string[] = []

    for await (const event of client.prompt(session.id, createPrompt('Say "hello" and nothing else.'))) {
      events.push(event.type)
      if (event.type === 'complete') {
        expect(event.result).toBeDefined()
      }
    }

    expect(events).toContain('complete')
  })

  test('handles tool usage prompt', async () => {
    const session = await client.createSession({
      cwd: FIXTURES_DIR,
      mcpServers: [],
    })

    // Use haiku for faster/cheaper test runs
    await client.setModel(session.id, TEST_MODEL)

    // Prompt that should trigger tool usage - reading a specific file
    const { updates } = await client.promptSync(
      session.id,
      createPrompt('Use the Read tool to read calculator-mcp.ts and tell me what tools the MCP server provides.'),
    )

    const summary = summarizeResponse(updates)

    // Verify response mentions calculator tools
    expect(summary.text.length).toBeGreaterThan(0)
    // Response should mention the calculator tools (add, subtract, etc.)
    expect(summary.text.toLowerCase()).toMatch(/add|subtract|multiply|divide|calculator/)
  })

  test('uses skill from cwd', async () => {
    const session = await client.createSession({
      cwd: FIXTURES_DIR,
      mcpServers: [],
    })

    // Use haiku for faster/cheaper test runs
    await client.setModel(session.id, TEST_MODEL)

    // Ask Claude to use the greeting skill
    const { updates } = await client.promptSync(session.id, createPrompt('Please greet me using the greeting skill.'))

    const summary = summarizeResponse(updates)

    // The greeting skill instructs Claude to include specific phrases
    expect(summary.text.length).toBeGreaterThan(0)
    expect(summary.text.toLowerCase()).toMatch(/hello|greet|welcome/)
  })

  test('uses MCP server tools', async () => {
    // Path to calculator MCP server fixture (must be absolute per ACP spec)
    const calculatorPath = `${FIXTURES_DIR}/calculator-mcp.ts`
    const bunPath = Bun.which('bun') ?? 'bun'

    // Retry helper for flaky MCP server startup
    const maxRetries = 3
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const session = await client.createSession({
        cwd: FIXTURES_DIR,
        mcpServers: [
          {
            name: 'calculator',
            command: bunPath,
            args: [calculatorPath],
            env: [],
          },
        ],
      })

      // Set model to haiku for faster/cheaper test runs
      await client.setModel(session.id, TEST_MODEL)

      // Ask Claude to use the calculator MCP server
      const { updates } = await client.promptSync(
        session.id,
        createPrompt('Use the calculator MCP server add tool to compute 15 + 27. Reply with just the number.'),
      )

      const summary = summarizeResponse(updates)

      // Check if we got 42 in the response
      if (summary.text.match(/42/)) {
        expect(summary.text.length).toBeGreaterThan(0)
        expect(summary.text).toMatch(/42/)
        return // Success!
      }

      // MCP server might not have been ready, retry
      lastError = new Error(`Attempt ${attempt}: Response did not contain 42. Got: ${summary.text.slice(0, 100)}...`)
      if (attempt < maxRetries) {
        console.log(`MCP test attempt ${attempt} failed, retrying...`)
      }
    }

    // All retries exhausted
    throw lastError ?? new Error('MCP test failed after all retries')
  })
})
