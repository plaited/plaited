#!/usr/bin/env bun

import { basename, dirname, relative, resolve } from 'node:path'
import type { ThinkingLevel } from '@mariozechner/pi-agent-core'
import {
  AuthStorage,
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'

type WorkerArgs = {
  artifactDir: string
  programPath: string
}

type WorkerRunResult = {
  exitCode: number
  stderr: string
  stdout: string
}

const DEFAULT_EXECUTION_TIMEOUT_MS = 300_000
const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

const parseArgs = (argv: string[]): WorkerArgs => {
  let programPath: string | undefined
  let artifactDir: string | undefined

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--program') {
      programPath = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--artifact-dir') {
      artifactDir = argv[index + 1]
      index += 1
    }
  }

  if (!programPath || !artifactDir) {
    throw new Error('Usage: bun scripts/run-pi-factory-worker.ts --program <path> --artifact-dir <dir>')
  }

  return {
    artifactDir: resolve(artifactDir),
    programPath,
  }
}

export const buildPiWorkerPrompt = ({ planner, programPath }: { planner: string; programPath: string }): string => {
  const lane = basename(dirname(programPath))

  return [
    `Execute the research lane defined in @${programPath}.`,
    `You are the execution worker for lane '${lane}'. The planning/orchestration authority is '${planner}'.`,
    'Read the lane program carefully before changing code.',
    'Stay inside the lane writable roots declared by the program and do not mutate unrelated files.',
    'Use the repo instructions from @AGENTS.md and verify the current code before editing.',
    'Make the strongest concrete implementation attempt you can in this worktree, then stop.',
  ].join(' ')
}

const appendArtifactLog = async ({
  artifactDir,
  fileName,
  message,
}: {
  artifactDir: string
  fileName: string
  message: string
}) => {
  const path = resolve(artifactDir, fileName)
  const current = (await Bun.file(path).exists()) ? await Bun.file(path).text() : ''
  await Bun.write(path, `${current}[${new Date().toISOString()}] ${message}\n`)
}

const resolveExecutionTimeoutMs = (): number => {
  const raw = Number(process.env.PLAITED_EXECUTION_TIMEOUT_MS ?? DEFAULT_EXECUTION_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EXECUTION_TIMEOUT_MS
}

const resolveThinkingLevel = (): ThinkingLevel => {
  const raw = process.env.PLAITED_EXECUTION_THINKING ?? 'high'
  return THINKING_LEVELS.includes(raw as ThinkingLevel) ? (raw as ThinkingLevel) : 'high'
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

const runSdkAttempt = async ({
  artifactDir,
  cwd,
  modelId,
  prompt,
  provider,
  thinking,
}: {
  artifactDir: string
  cwd: string
  modelId: string
  prompt: string
  provider: string
  thinking: ThinkingLevel
}): Promise<WorkerRunResult> => {
  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: `sdk-attempt-start provider=${provider} model=${modelId} cwd=${cwd}`,
  })

  const agentDir = getAgentDir()
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
  })
  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: 'resource-loader-reload-start',
  })
  await resourceLoader.reload()
  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: `resource-loader-reload-end skills=${resourceLoader.getSkills().skills.length} agents=${resourceLoader.getAgentsFiles().agentsFiles.length}`,
  })

  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
  const model = resolveModel({
    modelId,
    modelRegistry,
    provider,
  })
  const authConfigured = modelRegistry.hasConfiguredAuth(model)
  const resolvedAuth = await modelRegistry.getApiKeyAndHeaders(model)
  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: `model-resolved provider=${model.provider} model=${model.id} authConfigured=${authConfigured} authOk=${resolvedAuth.ok}`,
  })
  await Bun.write(
    resolve(artifactDir, 'sdk.auth.json'),
    `${JSON.stringify(
      {
        provider,
        requestedModelId: modelId,
        resolvedModelId: model.id,
        authConfigured,
        resolvedAuth,
      },
      null,
      2,
    )}\n`,
  )

  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  let timedOut = false
  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: 'create-agent-session-start',
  })
  const { session, modelFallbackMessage } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: thinking,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    tools: createCodingTools(cwd),
  })
  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: `create-agent-session-end fallback=${modelFallbackMessage ? 'yes' : 'no'}`,
  })

  if (modelFallbackMessage) {
    stderrChunks.push(`${modelFallbackMessage}\n`)
  }

  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'message_update') {
      if (event.assistantMessageEvent.type === 'text_delta') {
        stdoutChunks.push(event.assistantMessageEvent.delta)
      }
      if (event.assistantMessageEvent.type === 'thinking_delta') {
        stdoutChunks.push(event.assistantMessageEvent.delta)
      }
      return
    }

    if (event.type === 'tool_execution_start') {
      stderrChunks.push(`[tool:start] ${event.toolName}\n`)
      return
    }

    if (event.type === 'tool_execution_end') {
      stderrChunks.push(`[tool:end] ${event.toolName} error=${event.isError}\n`)
      return
    }

    if (event.type === 'auto_retry_start') {
      stderrChunks.push(`[auto-retry:start] attempt=${event.attempt}/${event.maxAttempts} ${event.errorMessage}\n`)
      return
    }

    if (event.type === 'auto_retry_end' && event.finalError) {
      stderrChunks.push(`[auto-retry:end] success=${event.success} ${event.finalError}\n`)
    }
  })

  await appendArtifactLog({
    artifactDir,
    fileName: 'worker.progress.log',
    message: `prompt-built chars=${prompt.length}`,
  })

  const timeoutMs = resolveExecutionTimeoutMs()
  const timeoutId = setTimeout(() => {
    timedOut = true
    stderrChunks.push(`[pi-worker] timeout after ${timeoutMs}ms\n`)
    void appendArtifactLog({
      artifactDir,
      fileName: 'worker.progress.log',
      message: `prompt-timeout timeoutMs=${timeoutMs}`,
    })
    void session.abort()
  }, timeoutMs)

  try {
    await appendArtifactLog({
      artifactDir,
      fileName: 'worker.progress.log',
      message: 'session-prompt-start',
    })
    await session.prompt(prompt)
    const errorMessage = session.agent.state.errorMessage
    if (timedOut || errorMessage) {
      const failureMessage = errorMessage ?? `Timed out after ${timeoutMs}ms`
      stderrChunks.push(`${failureMessage}\n`)
      await appendArtifactLog({
        artifactDir,
        fileName: 'worker.progress.log',
        message: `session-prompt-end success=false error=${JSON.stringify(failureMessage)}`,
      })
      return {
        exitCode: 1,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      }
    }
    await appendArtifactLog({
      artifactDir,
      fileName: 'worker.progress.log',
      message: 'session-prompt-end success=true',
    })
    return {
      exitCode: 0,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    stderrChunks.push(`${message}\n`)
    await appendArtifactLog({
      artifactDir,
      fileName: 'worker.progress.log',
      message: `session-prompt-end success=false error=${JSON.stringify(message)}`,
    })
    return {
      exitCode: 1,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
    }
  } finally {
    clearTimeout(timeoutId)
    unsubscribe()
    session.dispose()
    await Bun.write(
      resolve(artifactDir, 'sdk.session.json'),
      `${JSON.stringify(
        {
          cwd,
          provider,
          modelId,
          thinking,
          timedOut,
          errorMessage: session.agent.state.errorMessage ?? null,
          skillCount: resourceLoader.getSkills().skills.length,
          agentFiles: resourceLoader.getAgentsFiles().agentsFiles.map((file) => file.path),
        },
        null,
        2,
      )}\n`,
    )
  }
}

const main = async () => {
  const { artifactDir, programPath } = parseArgs(Bun.argv)
  const resolvedProgramPath = resolve(programPath)
  const cwd = process.cwd()
  const prompt = buildPiWorkerPrompt({
    planner: process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex',
    programPath: relative(cwd, resolvedProgramPath) || resolvedProgramPath,
  })

  const provider = process.env.PLAITED_EXECUTION_PROVIDER ?? 'openrouter'
  const primaryModel = process.env.PLAITED_EXECUTION_MODEL ?? 'google/gemma-4-31b-it'
  const fallbackModel = process.env.PLAITED_EXECUTION_FALLBACK_MODEL
  const thinking = resolveThinkingLevel()

  await Bun.write(
    resolve(artifactDir, 'worker.request.json'),
    `${JSON.stringify(
      {
        planner: process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex',
        provider,
        primaryModel,
        fallbackModel: fallbackModel ?? null,
        thinking,
        programPath: resolvedProgramPath,
        prompt,
      },
      null,
      2,
    )}\n`,
  )

  console.log(`[pi-worker] program=${programPath} model=${primaryModel} cwd=${cwd}`)

  const primaryResult = await runSdkAttempt({
    artifactDir,
    cwd,
    modelId: primaryModel,
    prompt,
    provider,
    thinking,
  })

  await Bun.write(resolve(artifactDir, 'pi.stdout.log'), primaryResult.stdout)
  await Bun.write(resolve(artifactDir, 'pi.stderr.log'), primaryResult.stderr)

  if (primaryResult.exitCode === 0) {
    console.log(`[pi-worker] primary model succeeded: ${primaryModel}`)
    return
  }

  if (!fallbackModel || fallbackModel === primaryModel) {
    console.error(`[pi-worker] primary model failed without fallback: ${primaryModel}`)
    process.exit(primaryResult.exitCode)
  }

  console.error(`[pi-worker] primary model failed, retrying with fallback: ${fallbackModel}`)

  const fallbackResult = await runSdkAttempt({
    artifactDir,
    cwd,
    modelId: fallbackModel,
    prompt,
    provider,
    thinking,
  })

  await Bun.write(resolve(artifactDir, 'pi-fallback.stdout.log'), fallbackResult.stdout)
  await Bun.write(resolve(artifactDir, 'pi-fallback.stderr.log'), fallbackResult.stderr)

  if (fallbackResult.exitCode !== 0) {
    console.error(`[pi-worker] fallback model failed: ${fallbackModel}`)
    process.exit(fallbackResult.exitCode)
  }

  console.log(`[pi-worker] fallback model succeeded: ${fallbackModel}`)
}

if (import.meta.main) {
  await main()
}
