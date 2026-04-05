#!/usr/bin/env bun

import type { ThinkingLevel } from '@mariozechner/pi-agent-core'
import {
  AuthStorage,
  createAgentSession,
  createCodingTools,
  createReadOnlyTools,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'

type ToolMode = 'read-only' | 'workspace-write'

type PiAgentLogBuffers = {
  messageChunks: string[]
  stderrChunks: string[]
  stdoutChunks: string[]
}

type AgentArgs = {
  cwd: string
  model: string
  outputFile: string
  promptFile: string
  provider: string
  stderrFile: string
  stdoutFile: string
  thinking: ThinkingLevel
  timeoutMs: number
  toolMode: ToolMode
}

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

const parseArgs = (argv: string[]): AgentArgs => {
  const values = new Map<string, string>()

  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('Invalid arguments for run-pi-orchestrator-agent.ts')
    }
    values.set(key.slice(2), value)
  }

  const toolMode = values.get('tool-mode')
  const thinking = values.get('thinking')

  if (
    !values.get('cwd') ||
    !values.get('model') ||
    !values.get('output-file') ||
    !values.get('prompt-file') ||
    !values.get('provider') ||
    !values.get('stderr-file') ||
    !values.get('stdout-file') ||
    !toolMode ||
    !thinking ||
    !values.get('timeout-ms')
  ) {
    throw new Error('Missing required arguments for run-pi-orchestrator-agent.ts')
  }

  if (toolMode !== 'read-only' && toolMode !== 'workspace-write') {
    throw new Error(`Unsupported tool mode: ${toolMode}`)
  }

  if (!THINKING_LEVELS.includes(thinking as ThinkingLevel)) {
    throw new Error(`Unsupported thinking level: ${thinking}`)
  }

  const timeoutMs = Number(values.get('timeout-ms'))
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${values.get('timeout-ms')}`)
  }

  return {
    cwd: values.get('cwd')!,
    model: values.get('model')!,
    outputFile: values.get('output-file')!,
    promptFile: values.get('prompt-file')!,
    provider: values.get('provider')!,
    stderrFile: values.get('stderr-file')!,
    stdoutFile: values.get('stdout-file')!,
    thinking: thinking as ThinkingLevel,
    timeoutMs,
    toolMode,
  }
}

const truncateForLog = (value: string, maxChars = 1_000): string =>
  value.length <= maxChars ? value : `${value.slice(0, maxChars)}...[truncated ${value.length - maxChars} chars]`

const summarizeToolResult = (result: unknown): string => {
  if (!result || typeof result !== 'object') {
    return String(result)
  }

  const candidate = result as {
    content?: Array<{ type?: string; text?: string }>
    details?: unknown
  }

  const textParts = Array.isArray(candidate.content)
    ? candidate.content
        .filter((item) => item?.type === 'text' && typeof item.text === 'string' && item.text.trim().length > 0)
        .map((item) => item.text!.trim())
    : []

  const details = candidate.details ? ` details=${truncateForLog(JSON.stringify(candidate.details))}` : ''
  if (textParts.length === 0) {
    return truncateForLog(JSON.stringify(result))
  }

  return `${truncateForLog(textParts.join(' | '))}${details}`
}

export const recordPiSessionEvent = ({ buffers, event }: { buffers: PiAgentLogBuffers; event: unknown }) => {
  if (!event || typeof event !== 'object' || !('type' in event)) {
    return
  }

  const typedEvent = event as Record<string, unknown>
  if (typedEvent.type === 'message_update') {
    const assistantMessageEvent = typedEvent.assistantMessageEvent as Record<string, unknown> | undefined
    if (assistantMessageEvent?.type === 'text_delta' && typeof assistantMessageEvent.delta === 'string') {
      buffers.messageChunks.push(assistantMessageEvent.delta)
      buffers.stdoutChunks.push(assistantMessageEvent.delta)
    }
    if (assistantMessageEvent?.type === 'thinking_delta' && typeof assistantMessageEvent.delta === 'string') {
      buffers.stdoutChunks.push(assistantMessageEvent.delta)
    }
    return
  }

  if (typedEvent.type === 'tool_execution_start' && typeof typedEvent.toolName === 'string') {
    buffers.stderrChunks.push(`[tool:start] ${typedEvent.toolName}\n`)
    return
  }

  if (typedEvent.type === 'tool_execution_update' && typeof typedEvent.toolName === 'string') {
    buffers.stderrChunks.push(`[tool:update] ${typedEvent.toolName} ${summarizeToolResult(typedEvent.partialResult)}\n`)
    return
  }

  if (typedEvent.type === 'tool_execution_end' && typeof typedEvent.toolName === 'string') {
    buffers.stderrChunks.push(
      `[tool:end] ${typedEvent.toolName} error=${String(typedEvent.isError)} result=${summarizeToolResult(typedEvent.result)}\n`,
    )
    return
  }

  if (typedEvent.type === 'auto_retry_start') {
    buffers.stderrChunks.push(
      `[auto-retry:start] attempt=${String(typedEvent.attempt)}/${String(typedEvent.maxAttempts)} ${String(typedEvent.errorMessage ?? '')}\n`,
    )
    return
  }

  if (typedEvent.type === 'auto_retry_end' && typedEvent.finalError) {
    buffers.stderrChunks.push(
      `[auto-retry:end] success=${String(typedEvent.success)} ${String(typedEvent.finalError)}\n`,
    )
  }
}

export const writePiAgentArtifacts = async ({
  buffers,
  outputFile,
  stderrFile,
  stdoutFile,
}: {
  buffers: PiAgentLogBuffers
  outputFile: string
  stderrFile: string
  stdoutFile: string
}) => {
  await Bun.write(outputFile, buffers.messageChunks.join(''))
  await Bun.write(stdoutFile, buffers.stdoutChunks.join(''))
  await Bun.write(stderrFile, buffers.stderrChunks.join(''))
}

const resolveModel = ({
  modelId,
  modelRegistry,
  provider,
}: {
  modelId: string
  modelRegistry: ModelRegistry
  provider: string
}) => {
  const model = modelRegistry.find(provider, modelId)
  if (model) {
    return model
  }

  const available = modelRegistry
    .getAll()
    .filter((candidate) => candidate.provider === provider)
    .map((candidate) => candidate.id)
    .slice(0, 20)

  throw new Error(
    available.length > 0
      ? `Model not found for provider '${provider}': ${modelId}. Known models include: ${available.join(', ')}`
      : `Model not found for provider '${provider}': ${modelId}`,
  )
}

const main = async () => {
  const args = parseArgs(Bun.argv)
  const buffers: PiAgentLogBuffers = {
    messageChunks: [],
    stdoutChunks: [],
    stderrChunks: [],
  }
  let timedOut = false
  let exitCode = 0
  let session: Awaited<ReturnType<typeof createAgentSession>>['session'] | undefined
  let unsubscribe: (() => void) | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    const prompt = await Bun.file(args.promptFile).text()
    const agentDir = getAgentDir()
    const resourceLoader = new DefaultResourceLoader({
      cwd: args.cwd,
      agentDir,
    })
    await resourceLoader.reload()

    const authStorage = AuthStorage.create()
    const modelRegistry = ModelRegistry.create(authStorage)
    const model = resolveModel({
      modelId: args.model,
      modelRegistry,
      provider: args.provider,
    })

    const tools = args.toolMode === 'read-only' ? createReadOnlyTools(args.cwd) : createCodingTools(args.cwd)

    const sessionResult = await createAgentSession({
      cwd: args.cwd,
      agentDir,
      authStorage,
      modelRegistry,
      model,
      thinkingLevel: args.thinking,
      resourceLoader,
      sessionManager: SessionManager.inMemory(),
      tools,
    })
    session = sessionResult.session

    if (sessionResult.modelFallbackMessage) {
      buffers.stderrChunks.push(`${sessionResult.modelFallbackMessage}\n`)
    }

    unsubscribe = session.subscribe((event) => {
      recordPiSessionEvent({
        buffers,
        event,
      })
    })

    timeoutId = setTimeout(() => {
      timedOut = true
      buffers.stderrChunks.push(`[pi] timeout after ${args.timeoutMs}ms\n`)
      void session?.abort()
    }, args.timeoutMs)

    await session.prompt(prompt)
    const errorMessage = session.agent.state.errorMessage
    if (timedOut || errorMessage) {
      exitCode = 1
      buffers.stderrChunks.push(`${errorMessage ?? `Timed out after ${args.timeoutMs}ms`}\n`)
    }
  } catch (error) {
    exitCode = 1
    buffers.stderrChunks.push(`${error instanceof Error ? error.message : String(error)}\n`)
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    unsubscribe?.()
    session?.dispose()
    await writePiAgentArtifacts({
      buffers,
      outputFile: args.outputFile,
      stderrFile: args.stderrFile,
      stdoutFile: args.stdoutFile,
    })
  }

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

if (import.meta.main) {
  await main()
}
