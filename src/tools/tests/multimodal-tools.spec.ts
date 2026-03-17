/**
 * Integration tests for multimodal tools: embed_search, analyze_image, speak.
 *
 * @remarks
 * All tests use mock backends (no real MLX servers needed). Verifies:
 * - Each tool handler returns the correct output shape
 * - Input validation rejects invalid arguments
 * - Tools are callable via createAgentLoop() (tool_call → tool_result round-trip)
 * - Tool definitions are valid ToolDefinition objects
 */

import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgentLoop } from '../../agent/create-agent-loop.ts'
import { AGENT_EVENTS, RISK_TAG } from '../../agent/agent.constants.ts'
import { ToolDefinitionSchema } from '../../agent/agent.schemas.ts'
import type { Model, ModelDelta } from '../../agent/agent.types.ts'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../../events.ts'
import {
  AnalyzeImageOutputSchema,
  createAnalyzeImageHandler,
  analyzeImageToolDefinition,
} from '../analyze-image.ts'
import {
  EmbedSearchOutputSchema,
  createEmbedSearchHandler,
  embedSearchToolDefinition,
} from '../embed-search.ts'
import { SpeakOutputSchema, createSpeakHandler, speakToolDefinition } from '../speak.ts'

// ============================================================================
// Mock model — triggers a single tool call then returns a text response
// ============================================================================

const createMockModelWithToolCall = (toolName: string, toolArgs: Record<string, unknown>): Model => {
  let callCount = 0
  return {
    reason: async function* () {
      callCount++
      if (callCount === 1) {
        yield { type: 'toolcall_delta', id: 'test-tool-1', name: toolName, arguments: JSON.stringify(toolArgs) } as ModelDelta
      } else {
        yield { type: 'text_delta', content: 'Done.' } as ModelDelta
      }
      yield { type: 'done', response: { usage: { inputTokens: 50, outputTokens: 10 } } } as ModelDelta
    },
  }
}

// ============================================================================
// Shared context helper
// ============================================================================

const mockCtx = (workspace: string) => ({
  workspace,
  signal: AbortSignal.timeout(5000),
})

// ============================================================================
// Shared round-trip helper
// ============================================================================

type ToolCallEntry = { type: string; detail: unknown }

const runToolCallRoundTrip = async (
  toolName: string,
  toolArgs: Record<string, unknown>,
  handler: (args: Record<string, unknown>, ctx: { workspace: string; signal: AbortSignal }) => Promise<unknown>,
  toolDef: (typeof embedSearchToolDefinition),
  workspace: string,
): Promise<ToolCallEntry[]> => {
  const events: ToolCallEntry[] = []

  const agent = await createAgentLoop({
    model: createMockModelWithToolCall(toolName, toolArgs),
    tools: [{ ...toolDef, tags: [RISK_TAG.workspace] }],
    toolExecutor: async (toolCall) => handler(toolCall.arguments as Record<string, unknown>, mockCtx(workspace)),
    memoryPath: workspace,
  })

  agent.subscribe({
    [AGENT_EVENTS.tool_result](d: unknown) { events.push({ type: AGENT_EVENTS.tool_result, detail: d }) },
    [AGENT_EVENTS.message](d: unknown) { events.push({ type: AGENT_EVENTS.message, detail: d }) },
  })

  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
    detail: { sessionId: 'test', source: 'document', isReconnect: false },
  })
  agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt: `call ${toolName}` } })

  // Wait for message (loop complete) or timeout
  const start = Date.now()
  while (Date.now() - start < 5000) {
    if (events.some((e) => e.type === AGENT_EVENTS.message)) break
    await Bun.sleep(20)
  }

  agent.destroy()
  return events
}

// ============================================================================
// embed_search
// ============================================================================

describe('embed_search', () => {
  test('handler returns mock results (no url)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'embed-test-'))
    try {
      const handler = createEmbedSearchHandler()
      const result = await handler({ query: 'agent loop pattern', memoryDir: '.memory', topK: 2 }, mockCtx(dir))
      const parsed = EmbedSearchOutputSchema.safeParse(result)
      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      expect(parsed.data.results.length).toBe(2)
      expect(parsed.data.results[0]!.score).toBeGreaterThan(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('handler rejects empty query', async () => {
    const handler = createEmbedSearchHandler()
    await expect(
      handler({ query: '', memoryDir: '.memory' }, mockCtx(tmpdir())),
    ).rejects.toThrow('Invalid embed_search input')
  })

  test('tool definition is valid ToolDefinition', () => {
    const parsed = ToolDefinitionSchema.safeParse(embedSearchToolDefinition)
    expect(parsed.success).toBe(true)
    expect(embedSearchToolDefinition.function.name).toBe('embed_search')
    expect(embedSearchToolDefinition.tags).toContain(RISK_TAG.workspace)
    expect(embedSearchToolDefinition.tags).toContain(RISK_TAG.inbound)
  })

  test('round-trip through createAgentLoop', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'embed-loop-test-'))
    try {
      const handler = createEmbedSearchHandler()
      const events = await runToolCallRoundTrip(
        'embed_search',
        { query: 'behavioral programming', memoryDir: '.memory' },
        handler,
        embedSearchToolDefinition,
        dir,
      )

      const toolResultEvent = events.find((e) => e.type === AGENT_EVENTS.tool_result)
      expect(toolResultEvent).toBeDefined()
      const detail = toolResultEvent?.detail as { result: { name: string; output: unknown } } | undefined
      expect(detail?.result?.name).toBe('embed_search')
      const output = EmbedSearchOutputSchema.safeParse(detail?.result?.output)
      expect(output.success).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

// ============================================================================
// analyze_image
// ============================================================================

describe('analyze_image', () => {
  test('handler returns mock output (no url)', async () => {
    const handler = createAnalyzeImageHandler()
    const result = await handler({ imagePath: 'test.png' }, mockCtx(tmpdir()))
    const parsed = AnalyzeImageOutputSchema.safeParse(result)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(typeof parsed.data.description).toBe('string')
    expect(parsed.data.description.length).toBeGreaterThan(0)
  })

  test('handler rejects empty imagePath', async () => {
    const handler = createAnalyzeImageHandler()
    await expect(
      handler({ imagePath: '' }, mockCtx(tmpdir())),
    ).rejects.toThrow('Invalid analyze_image input')
  })

  test('tool definition is valid ToolDefinition', () => {
    const parsed = ToolDefinitionSchema.safeParse(analyzeImageToolDefinition)
    expect(parsed.success).toBe(true)
    expect(analyzeImageToolDefinition.function.name).toBe('analyze_image')
    expect(analyzeImageToolDefinition.tags).toContain(RISK_TAG.workspace)
    expect(analyzeImageToolDefinition.tags).toContain(RISK_TAG.inbound)
  })

  test('round-trip through createAgentLoop', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vision-loop-test-'))
    try {
      const handler = createAnalyzeImageHandler()
      const events = await runToolCallRoundTrip(
        'analyze_image',
        { imagePath: 'screenshot.png', prompt: 'List all UI elements' },
        handler,
        analyzeImageToolDefinition,
        dir,
      )

      const toolResultEvent = events.find((e) => e.type === AGENT_EVENTS.tool_result)
      expect(toolResultEvent).toBeDefined()
      const detail = toolResultEvent?.detail as { result: { name: string; output: unknown } } | undefined
      expect(detail?.result?.name).toBe('analyze_image')
      const output = AnalyzeImageOutputSchema.safeParse(detail?.result?.output)
      expect(output.success).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

// ============================================================================
// speak
// ============================================================================

describe('speak', () => {
  test('handler writes placeholder file in mock mode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'speak-test-'))
    try {
      const handler = createSpeakHandler()
      const outputPath = join(dir, 'output.wav')
      const result = await handler({ text: 'Hello world', outputPath }, mockCtx(dir))
      const parsed = SpeakOutputSchema.safeParse(result)
      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      expect(parsed.data.mock).toBe(true)
      expect(parsed.data.audioPath).toBe(outputPath)
      const fileExists = await Bun.file(outputPath).exists()
      expect(fileExists).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('handler rejects empty text', async () => {
    const handler = createSpeakHandler()
    await expect(
      handler({ text: '', outputPath: 'out.wav' }, mockCtx(tmpdir())),
    ).rejects.toThrow('Invalid speak input')
  })

  test('handler rejects text over 4096 chars', async () => {
    const handler = createSpeakHandler()
    await expect(
      handler({ text: 'a'.repeat(4097), outputPath: 'out.wav' }, mockCtx(tmpdir())),
    ).rejects.toThrow('Invalid speak input')
  })

  test('tool definition is valid ToolDefinition', () => {
    const parsed = ToolDefinitionSchema.safeParse(speakToolDefinition)
    expect(parsed.success).toBe(true)
    expect(speakToolDefinition.function.name).toBe('speak')
    expect(speakToolDefinition.tags).toContain(RISK_TAG.workspace)
    expect(speakToolDefinition.tags).toContain(RISK_TAG.inbound)
  })

  test('round-trip through createAgentLoop', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'speak-loop-test-'))
    try {
      const outputFile = join(dir, 'greeting.wav')
      const handler = createSpeakHandler()
      const events = await runToolCallRoundTrip(
        'speak',
        { text: 'Welcome to the modnet node.', outputPath: outputFile },
        handler,
        speakToolDefinition,
        dir,
      )

      const toolResultEvent = events.find((e) => e.type === AGENT_EVENTS.tool_result)
      expect(toolResultEvent).toBeDefined()
      const detail = toolResultEvent?.detail as { result: { name: string; output: unknown } } | undefined
      expect(detail?.result?.name).toBe('speak')
      const output = SpeakOutputSchema.safeParse(detail?.result?.output)
      expect(output.success).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
