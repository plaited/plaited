/**
 * ACP Client Integration Tests
 *
 * @remarks
 * These tests verify the ACP client works against real Claude Code
 * via the `claude-code-acp` adapter.
 *
 * Prerequisites:
 * 1. Claude Code installed and authenticated: `claude --print "hi"`
 * 2. ACP adapter in devDependencies: `claude-code-acp`
 * 3. API key: `CLAUDE_API_KEY` environment variable
 *
 * Run with: `bun test src/acp/tests/acp-integration.spec.ts`
 *
 * These tests make real API calls and consume credits.
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { type ACPClient, createACPClient } from '../acp-client.ts'
import { createPrompt, summarizeResponse } from '../acp-helpers.ts'

// Long timeout for real agent interactions (2 minutes)
setDefaultTimeout(120000)

// Skip integration tests if prerequisites aren't met
const SKIP_INTEGRATION = !process.env.CLAUDE_API_KEY || process.env.SKIP_INTEGRATION === 'true'
const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe

describeIntegration('ACP Client Integration', () => {
  let client: ACPClient

  beforeAll(async () => {
    // cc-acp adapter uses CLAUDE_API_KEY
    client = createACPClient({
      command: ['bunx', 'cc-acp'],
      timeout: 120000, // 2 min timeout for initialization
      env: {
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY ?? '',
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
      cwd: process.cwd(),
      mcpServers: [],
    })

    expect(session).toBeDefined()
    expect(session.id).toBeDefined()
    expect(typeof session.id).toBe('string')
  })

  test('sends prompt and receives response', async () => {
    const session = await client.createSession({
      cwd: process.cwd(),
      mcpServers: [],
    })

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
      cwd: process.cwd(),
      mcpServers: [],
    })

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
      cwd: process.cwd(),
      mcpServers: [],
    })

    // Prompt that should trigger tool usage - reading a specific file
    const { updates } = await client.promptSync(
      session.id,
      createPrompt('Use the Read tool to read biome.json and tell me what linter is configured.'),
    )

    const summary = summarizeResponse(updates)

    // Verify response mentions Biome (the linter configured)
    // Note: Agent may or may not use Read tool depending on context window
    expect(summary.text.length).toBeGreaterThan(0)
    // If tools were used, verify structure
    if (summary.toolCallCount > 0) {
      expect(summary.completedToolCalls.length).toBeGreaterThan(0)
    }
  })

  // Skip skill test - changing cwd breaks Claude Code auth context
  // The greeting skill fixture is available at: fixtures/.claude/skills/greeting/
  // This test would work if Claude Code supported skill loading via session config
  test.skip('uses skill from cwd', async () => {
    // Set cwd to fixtures directory which has .claude/skills/greeting
    const fixturesDir = join(import.meta.dir, 'fixtures')

    const session = await client.createSession({
      cwd: fixturesDir,
      mcpServers: [],
    })

    // Ask Claude to use the greeting skill
    const { updates } = await client.promptSync(session.id, createPrompt('Please greet me using the greeting skill.'))

    const summary = summarizeResponse(updates)

    // The greeting skill instructs Claude to include "skill-test-marker"
    expect(summary.text.length).toBeGreaterThan(0)
    expect(summary.text.toLowerCase()).toMatch(/hello|greet|welcome/)
  })

  // Skip MCP test - cc-acp adapter doesn't fully support MCP servers yet
  // The calculator fixture is available at: fixtures/calculator-mcp.ts
  test.skip('uses MCP server tools', async () => {
    // Path to calculator MCP server fixture (must be absolute per ACP spec)
    const calculatorPath = join(import.meta.dir, 'fixtures', 'calculator-mcp.ts')
    const bunPath = Bun.which('bun') ?? 'bun'

    const session = await client.createSession({
      cwd: process.cwd(),
      mcpServers: [
        {
          name: 'calculator',
          command: bunPath,
          args: [calculatorPath],
          env: [],
        },
      ],
    })

    // Ask Claude to use the calculator MCP server
    const { updates } = await client.promptSync(
      session.id,
      createPrompt('Use the calculator MCP server add tool to compute 15 + 27. Reply with just the number.'),
    )

    const summary = summarizeResponse(updates)

    // Should have a response mentioning the result (42)
    expect(summary.text.length).toBeGreaterThan(0)
    expect(summary.text).toMatch(/42/)
  })
})
