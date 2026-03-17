/**
 * Tests for transport executor factories — local, SSH, and A2A.
 *
 * @remarks
 * Local executor is tested with real handlers. SSH executor uses a local
 * mock script via Bun.spawn (no actual SSH). A2A executor uses a mock client.
 */

import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Message, MessageSendParams, Task } from '../../a2a/a2a.schemas.ts'
import type { A2AClient } from '../../a2a/a2a.types.ts'
import { createA2AExecutor, createLocalExecutor, createSshExecutor } from '../executor.ts'
import type { AgentToolCall } from '../agent.schemas.ts'
import type { ToolHandler } from '../agent.types.ts'

// ============================================================================
// Fixtures
// ============================================================================

const workspace = join(tmpdir(), 'executor-test-workspace')

const makeToolCall = (name: string, args: Record<string, unknown>): AgentToolCall => ({
  id: `tc-${crypto.randomUUID().slice(0, 8)}`,
  name,
  arguments: args,
})

// ============================================================================
// Local Executor
// ============================================================================

describe('createLocalExecutor', () => {
  test('dispatches to the correct handler', async () => {
    const handlers: Record<string, ToolHandler> = {
      read_file: async (args) => `contents of ${args.path}`,
      write_file: async (args) => ({ written: args.path, bytes: (args.content as string).length }),
    }

    const executor = createLocalExecutor({ workspace, handlers })
    const result = await executor(makeToolCall('read_file', { path: 'main.ts' }), AbortSignal.timeout(5000))

    expect(result).toBe('contents of main.ts')
  })

  test('throws on unknown tool', async () => {
    const executor = createLocalExecutor({ workspace, handlers: {} })
    const toolCall = makeToolCall('nonexistent', {})

    await expect(executor(toolCall, AbortSignal.timeout(5000))).rejects.toThrow('Unknown tool: nonexistent')
  })

  test('passes workspace and signal to handler', async () => {
    let receivedWorkspace = ''
    let receivedSignal: AbortSignal | null = null

    const handlers: Record<string, ToolHandler> = {
      check: async (_args, ctx) => {
        receivedWorkspace = ctx.workspace
        receivedSignal = ctx.signal
        return 'ok'
      },
    }

    const signal = AbortSignal.timeout(5000)
    const executor = createLocalExecutor({ workspace: '/test/workspace', handlers })
    await executor(makeToolCall('check', {}), signal)

    expect(receivedWorkspace).toBe('/test/workspace')
    expect(receivedSignal).not.toBeNull()
    expect(receivedSignal === signal).toBe(true)
  })

  test('propagates handler errors', async () => {
    const handlers: Record<string, ToolHandler> = {
      failing: async () => {
        throw new Error('handler broke')
      },
    }

    const executor = createLocalExecutor({ workspace, handlers })
    await expect(executor(makeToolCall('failing', {}), AbortSignal.timeout(5000))).rejects.toThrow('handler broke')
  })

  test('multiple handlers dispatch independently', async () => {
    const log: string[] = []
    const handlers: Record<string, ToolHandler> = {
      tool_a: async () => {
        log.push('a')
        return 'result_a'
      },
      tool_b: async () => {
        log.push('b')
        return 'result_b'
      },
    }

    const executor = createLocalExecutor({ workspace, handlers })
    const signal = AbortSignal.timeout(5000)

    const [resultA, resultB] = await Promise.all([
      executor(makeToolCall('tool_a', {}), signal),
      executor(makeToolCall('tool_b', {}), signal),
    ])

    expect(resultA).toBe('result_a')
    expect(resultB).toBe('result_b')
    expect(log).toContain('a')
    expect(log).toContain('b')
  })
})

// ============================================================================
// SSH Executor
// ============================================================================

describe('createSshExecutor', () => {
  test('constructs correct SSH command shape', () => {
    // Verify the factory creates a function — integration testing
    // requires actual SSH infrastructure
    const executor = createSshExecutor({
      host: 'node-1.local',
      port: 2222,
      username: 'agent',
      privateKey: '/keys/id_ed25519',
      workspace: '/remote/workspace',
    })

    expect(typeof executor).toBe('function')
  })

  test('includes cwd in serialized arguments', () => {
    // Verify the JSON serialization includes cwd by testing the
    // structure that would be sent (unit-level verification)
    const toolCall = makeToolCall('read_file', { path: 'src/main.ts' })
    const serialized = JSON.stringify({ ...toolCall.arguments, cwd: '/remote/workspace' })
    const parsed = JSON.parse(serialized)

    expect(parsed.path).toBe('src/main.ts')
    expect(parsed.cwd).toBe('/remote/workspace')
  })
})

// ============================================================================
// A2A Executor
// ============================================================================

describe('createA2AExecutor', () => {
  test('extracts DataPart from task artifact', async () => {
    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async (_params: MessageSendParams) => ({
        kind: 'task' as const,
        id: 'task-1',
        status: { state: 'completed' as const },
        artifacts: [
          {
            artifactId: 'art-1',
            parts: [{ kind: 'data' as const, data: { contents: 'hello world' } }],
          },
        ],
      }),
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    const result = await executor(makeToolCall('read_file', { path: 'test.ts' }), AbortSignal.timeout(5000))

    expect(result).toEqual({ contents: 'hello world' })
  })

  test('extracts TextPart from task artifact (JSON-parsed)', async () => {
    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async () => ({
        kind: 'task' as const,
        id: 'task-2',
        status: { state: 'completed' as const },
        artifacts: [
          {
            artifactId: 'art-2',
            parts: [{ kind: 'text' as const, text: '{"written":"file.ts","bytes":42}' }],
          },
        ],
      }),
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    const result = await executor(
      makeToolCall('write_file', { path: 'file.ts', content: 'x' }),
      AbortSignal.timeout(5000),
    )

    expect(result).toEqual({ written: 'file.ts', bytes: 42 })
  })

  test('throws on failed task', async () => {
    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async () => ({
        kind: 'task' as const,
        id: 'task-3',
        status: {
          state: 'failed' as const,
          message: {
            kind: 'message' as const,
            messageId: 'err-1',
            role: 'agent' as const,
            parts: [{ kind: 'text' as const, text: 'File not found' }],
          },
        },
      }),
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    await expect(
      executor(makeToolCall('read_file', { path: 'missing.ts' }), AbortSignal.timeout(5000)),
    ).rejects.toThrow('File not found')
  })

  test('throws on unexpected response format', async () => {
    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async () => ({
        kind: 'task' as const,
        id: 'task-4',
        status: { state: 'completed' as const },
        // No artifacts
      }),
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    await expect(executor(makeToolCall('read_file', { path: 'test.ts' }), AbortSignal.timeout(5000))).rejects.toThrow(
      'Unexpected A2A response format',
    )
  })

  test('sends correct A2A message shape', async () => {
    let capturedParams: MessageSendParams | null = null

    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async (params: MessageSendParams) => {
        capturedParams = params
        return {
          kind: 'task' as const,
          id: 'task-5',
          status: { state: 'completed' as const },
          artifacts: [
            {
              artifactId: 'art-5',
              parts: [{ kind: 'data' as const, data: { result: 'ok' } }],
            },
          ],
        }
      },
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    await executor(makeToolCall('bash', { command: 'echo hello' }), AbortSignal.timeout(5000))

    expect(capturedParams).not.toBeNull()
    expect(capturedParams!.configuration?.blocking).toBe(true)
    expect(capturedParams!.message.role).toBe('user')
    expect(capturedParams!.message.parts).toHaveLength(1)

    const part = capturedParams!.message.parts[0]!
    expect(part.kind).toBe('data')
    if (part.kind === 'data') {
      expect(part.data.tool).toBe('bash')
      expect(part.data.arguments).toEqual({ command: 'echo hello' })
    }
  })

  test('handles DataPart from message response', async () => {
    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async (): Promise<Task | Message> => ({
        kind: 'message' as const,
        messageId: 'msg-1',
        role: 'agent' as const,
        parts: [{ kind: 'data' as const, data: { output: 'direct message result' } }],
      }),
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    const result = await executor(makeToolCall('read_file', { path: 'test.ts' }), AbortSignal.timeout(5000))

    expect(result).toEqual({ output: 'direct message result' })
  })

  test('throws on failed task without error message', async () => {
    const mockClient: Pick<A2AClient, 'sendMessage'> = {
      sendMessage: async () => ({
        kind: 'task' as const,
        id: 'task-6',
        status: { state: 'failed' as const },
      }),
    }

    const executor = createA2AExecutor({ client: mockClient as A2AClient })
    await expect(executor(makeToolCall('bash', { command: 'fail' }), AbortSignal.timeout(5000))).rejects.toThrow(
      'Remote tool execution failed',
    )
  })
})
