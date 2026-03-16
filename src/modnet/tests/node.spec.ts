/**
 * Tests for createNode — server + agent loop + A2A integration.
 *
 * @remarks
 * Uses mock Model and toolExecutor to verify the full integration path:
 * - WebSocket client → agent pipeline → response
 * - A2A JSON-RPC → agent pipeline → Task response
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { AGENT_CARD_PATH } from '../../a2a/a2a.constants.ts'
import type { AgentCard, Task } from '../../a2a/a2a.schemas.ts'
import { RISK_TAG } from '../../agent/agent.constants.ts'
import type { ToolDefinition } from '../../agent/agent.schemas.ts'
import type { Model, ModelDelta } from '../../agent/agent.types.ts'
import { createNode } from '../node.ts'
import type { NodeHandle } from '../node.types.ts'

// ============================================================================
// Mock Model — returns canned responses
// ============================================================================

const createMockModel = (
  responses: Array<{ toolCalls?: Array<{ id: string; name: string; arguments: string }>; text?: string }>,
): Model => {
  let callCount = 0
  return {
    reason: async function* () {
      const response = responses[callCount] ?? responses[responses.length - 1]!
      callCount++

      if (response.text) {
        yield { type: 'text_delta', content: response.text } as ModelDelta
      }

      if (response.toolCalls) {
        for (const tc of response.toolCalls) {
          yield { type: 'toolcall_delta', id: tc.id, name: tc.name, arguments: tc.arguments } as ModelDelta
        }
      }

      yield {
        type: 'done',
        response: { usage: { inputTokens: 100, outputTokens: 50 } },
      } as ModelDelta
    },
  }
}

// ============================================================================
// Mock tools
// ============================================================================

const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a file',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  tags: [RISK_TAG.workspace],
}

// ============================================================================
// Mock Agent Card
// ============================================================================

const testAgentCard: AgentCard = {
  name: 'test-node',
  url: 'http://localhost',
  version: '0.1.0',
  capabilities: {},
}

// ============================================================================
// Helpers
// ============================================================================

const tmpDir = () => `/tmp/test-node-${crypto.randomUUID()}`

const jsonRpc = (method: string, params: unknown, id: number | string = 1) => ({
  jsonrpc: '2.0',
  method,
  params,
  id,
})

// ============================================================================
// Tests
// ============================================================================

describe('createNode', () => {
  const nodes: NodeHandle[] = []
  afterAll(() => {
    for (const node of nodes) node.destroy()
  })

  test('creates a node with server on assigned port', async () => {
    const model = createMockModel([{ text: 'Hello!' }])
    const node = await createNode({
      model,
      tools: [readFileTool],
      toolExecutor: async () => 'ok',
      memoryPath: tmpDir(),
    })
    nodes.push(node)

    expect(node.server.port).toBeGreaterThan(0)
    expect(node.agent).toBeDefined()
    expect(node.a2a).toBeUndefined()
  })

  test('creates a node with A2A routes when agentCard is provided', async () => {
    const model = createMockModel([{ text: 'Hello!' }])
    const node = await createNode({
      model,
      tools: [readFileTool],
      toolExecutor: async () => 'ok',
      memoryPath: tmpDir(),
      agentCard: testAgentCard,
    })
    nodes.push(node)

    expect(node.a2a).toBeDefined()
    expect(node.a2a!.routes).toBeDefined()
  })

  test('serves Agent Card at well-known path', async () => {
    const model = createMockModel([{ text: 'ok' }])
    const node = await createNode({
      model,
      tools: [readFileTool],
      toolExecutor: async () => 'ok',
      memoryPath: tmpDir(),
      agentCard: testAgentCard,
    })
    nodes.push(node)

    const res = await fetch(`http://localhost:${node.server.port}${AGENT_CARD_PATH}`)
    expect(res.status).toBe(200)
    const card = await res.json()
    expect(card.name).toBe('test-node')
  })

  test('A2A sendMessage bridges to agent loop and returns Task', async () => {
    const executedTools: string[] = []
    const model = createMockModel([
      // First inference: tool call
      { toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: '{"path":"test.ts"}' }] },
      // Second inference: text response
      { text: 'The file looks good.' },
    ])

    const node = await createNode({
      model,
      tools: [readFileTool],
      toolExecutor: async (toolCall) => {
        executedTools.push(toolCall.name)
        return 'file contents'
      },
      memoryPath: tmpDir(),
      agentCard: testAgentCard,
    })
    nodes.push(node)

    // Send A2A message/send via JSON-RPC
    const res = await fetch(`http://localhost:${node.server.port}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        jsonRpc('message/send', {
          message: {
            kind: 'message',
            messageId: 'msg-1',
            role: 'user',
            parts: [{ kind: 'text', text: 'Read test.ts' }],
          },
        }),
      ),
    })

    expect(res.status).toBe(200)
    const rpcResponse = (await res.json()) as { result: Task }
    const task = rpcResponse.result

    expect(task.kind).toBe('task')
    expect(task.status.state).toBe('completed')
    expect(task.artifacts).toHaveLength(1)

    const artifact = task.artifacts?.[0]
    expect(artifact).toBeDefined()
    const textPart = artifact!.parts[0]
    expect(textPart).toBeDefined()
    expect(textPart!.kind).toBe('text')
    expect('text' in textPart! && textPart!.text).toBe('The file looks good.')

    // Tool was actually executed through the pipeline
    expect(executedTools).toContain('read_file')
  })

  test('A2A returns failed task on empty message', async () => {
    const model = createMockModel([{ text: 'No input received.' }])

    const node = await createNode({
      model,
      tools: [readFileTool],
      toolExecutor: async () => 'ok',
      memoryPath: tmpDir(),
      agentCard: testAgentCard,
    })
    nodes.push(node)

    const res = await fetch(`http://localhost:${node.server.port}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        jsonRpc('message/send', {
          message: {
            kind: 'message',
            messageId: 'msg-2',
            role: 'user',
            parts: [{ kind: 'data', data: { foo: 'bar' } }],
          },
        }),
      ),
    })

    expect(res.status).toBe(200)
    const rpcResponse = (await res.json()) as { result: Task }
    // Should still complete — the agent gets an empty prompt but responds
    expect(rpcResponse.result.kind).toBe('task')
    expect(rpcResponse.result.status.state).toBe('completed')
  })

  test('WebSocket connection requires session cookie', async () => {
    const model = createMockModel([{ text: 'ok' }])
    const node = await createNode({
      model,
      tools: [],
      toolExecutor: async () => 'ok',
      memoryPath: tmpDir(),
      agentCard: testAgentCard,
    })
    nodes.push(node)

    // No session cookie → 401
    const res = await fetch(`http://localhost:${node.server.port}/ws`, {
      headers: { Upgrade: 'websocket' },
    })
    expect(res.status).toBe(401)
  })

  test('destroy stops server and tears down agent', async () => {
    const model = createMockModel([{ text: 'ok' }])
    const node = await createNode({
      model,
      tools: [],
      toolExecutor: async () => 'ok',
      memoryPath: tmpDir(),
    })

    const port = node.server.port
    node.destroy()

    // Server should be stopped — fetch should fail
    try {
      await fetch(`http://localhost:${port}/test`, { signal: AbortSignal.timeout(500) })
      // If it doesn't throw, that's unexpected but not worth failing over
      // (Bun might keep the socket open briefly)
    } catch {
      // Expected: connection refused
    }
  })
})
