#!/usr/bin/env bun

import { join, resolve } from 'node:path'

export type ResearchLaneConfig = {
  key: string
  scriptPath: string
  programPath: string
  validateCommand: string[]
  writableRoots: string[]
  skills?: string[]
  model?: string
  taskPrompt: string
  defaultAttempts: number
  defaultParallelism: number
  strategyNotes?: string[]
}

type AttemptStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'

type AttemptStatusRecord = {
  attempt: number
  strategy: string
  worktreePath: string
  status: AttemptStatus
  startedAt?: string
  finishedAt?: string
  pid?: number
  piExitCode?: number
  validateExitCode?: number
  error?: string
}

type RunManifest = {
  lane: string
  laneScriptPath: string
  createdAt: string
  attempts: number
  parallelism: number
  runDir: string
}

const REPO_ROOT = process.cwd()
export const MAX_ATTEMPT_RETRIES = 2

const pathExists = async (path: string): Promise<boolean> => {
  const result = await Bun.$`test -e ${path}`.quiet().nothrow()
  return result.exitCode === 0
}

export const normalizeScriptPath = (path: string) => {
  const normalized = path.replaceAll('\\', '/')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export const buildStrategyNotes = (attempts: number): string[] => {
  const base = [
    'minimal-diff-first: prefer the smallest coherent edit set that improves the lane contract.',
    'coverage-first: close the most obvious gaps in the lane output before broadening scope.',
    'validation-first: strengthen deterministically checkable outcomes before speculative expansion.',
    'structure-first: improve artifact organization and internal coherence before adding breadth.',
    'boundary-first: stay within the lane writable roots and avoid support-surface drift.',
    'traceability-first: preserve clear links between inputs, outputs, and validation evidence.',
    'reviewability-first: favor changes that are easy to inspect, compare, and promote.',
    'cleanup-first: remove stale or redundant lane output before introducing new complexity.',
  ]

  return Array.from({ length: attempts }, (_, index) => base[index % base.length]!)
}

export const getLaneConfig = async (scriptPath: string): Promise<ResearchLaneConfig> => {
  const normalizedScriptPath = normalizeScriptPath(scriptPath)
  if (!(await pathExists(normalizedScriptPath))) {
    throw new Error(`Missing lane script: ${normalizedScriptPath}`)
  }

  const imported = (await import(resolve(normalizedScriptPath))) as {
    RESEARCH_LANE_CONFIG?: ResearchLaneConfig
  }
  const config = imported.RESEARCH_LANE_CONFIG

  if (!config) {
    throw new Error(`Lane script does not export RESEARCH_LANE_CONFIG: ${normalizedScriptPath}`)
  }

  return config
}

export const parseRunArgs = async (args: string[]) => {
  const laneScriptPath = args[0]
  const command = (args[1] ?? 'run') as 'run' | 'status'
  const defaults = laneScriptPath ? await getLaneConfig(laneScriptPath).catch(() => null) : null
  let attempts = defaults?.defaultAttempts ?? 15
  let parallelism = defaults?.defaultParallelism ?? 3
  let runDir: string | null = null

  for (let i = 2; i < args.length; i += 1) {
    const arg = args[i]
    const next = args[i + 1]
    if ((arg === '--attempts' || arg === '--budget') && next) {
      attempts = Number(next)
      i += 1
      continue
    }
    if ((arg === '--parallel' || arg === '--concurrency') && next) {
      parallelism = Number(next)
      i += 1
      continue
    }
    if (arg === '--run-dir' && next) {
      runDir = next
      i += 1
    }
  }

  return { laneScriptPath, command, attempts, parallelism, runDir }
}

const formatTimestamp = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const buildRunDir = (lane: string) => join('.prompts', 'autoresearch-runner', lane, formatTimestamp())
const runAttemptDir = (runDir: string, attempt: number) =>
  join(runDir, `attempt-${attempt.toString().padStart(2, '0')}`)
const attemptStatusPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'status.json')
const attemptResultPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'result.json')
const attemptStdoutPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'stdout.log')
const attemptStderrPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'stderr.log')
const attemptWorktreePath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'repo')
const attemptPiStatePath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), '.pi-agent')

const ensureDir = async (path: string) => {
  await Bun.$`mkdir -p ${path}`.quiet()
}

const writeJson = async (path: string, value: unknown) => {
  await ensureDir(join(path, '..'))
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`)
}

const runCommand = async ({
  cmd,
  cwd,
  stdoutPath,
  stderrPath,
  env,
}: {
  cmd: string[]
  cwd: string
  stdoutPath: string
  stderrPath: string
  env?: Record<string, string>
}) => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdoutText = proc.stdout ? await new Response(proc.stdout).text() : ''
  const stderrText = proc.stderr ? await new Response(proc.stderr).text() : ''

  await Promise.all([Bun.write(stdoutPath, stdoutText), Bun.write(stderrPath, stderrText)])

  const exitCode = await proc.exited
  return { proc, exitCode }
}

const writeAttemptStatus = async (runDir: string, attempt: number, status: AttemptStatusRecord) => {
  await writeJson(attemptStatusPath(runDir, attempt), status)
}

const createWorktree = async (runDir: string, attempt: number) => {
  const worktreePath = attemptWorktreePath(runDir, attempt)
  await ensureDir(runAttemptDir(runDir, attempt))
  await Bun.$`git worktree add --detach ${worktreePath} HEAD`.cwd(REPO_ROOT).quiet()
  return worktreePath
}

const buildSystemPrompt = async (config: ResearchLaneConfig) => {
  const programText = (await Bun.file(config.programPath).text()).trim()
  const writableRoots = config.writableRoots.map((path) => `- ${path}`).join('\n')
  return `${programText}

Execution contract:
- Work only within the selected lane surfaces.
- Keep the main repo untouched during attempts; treat promotion as a separate step.
- Prefer deterministic, reviewable edits over broad speculative rewrites.
- Run the lane validator before finishing.

Writable roots:
${writableRoots}`
}

const buildPiCommand = async ({ config, strategy }: { config: ResearchLaneConfig; strategy: string }) => {
  const systemPrompt = await buildSystemPrompt(config)
  const cmd = [
    'bunx',
    'varlock',
    'run',
    '--path',
    REPO_ROOT,
    '--',
    'bunx',
    'pi',
    '--model',
    config.model ?? 'openrouter/minimax/minimax-m2.7',
    '--no-skills',
  ]

  for (const skill of config.skills ?? []) {
    cmd.push('--skill', resolve(skill))
  }

  cmd.push(
    '--append-system-prompt',
    systemPrompt,
    '-p',
    `${config.taskPrompt}

Attempt strategy:
${strategy}`,
  )

  return cmd
}

const summarizeDiff = async (worktreePath: string) => {
  const diff = await Bun.$`git diff --stat`.cwd(worktreePath).quiet().nothrow()
  return (await diff.text()).trim()
}

export const normalizeRepoPath = (path: string) =>
  path
    .replaceAll('\\', '/')
    .replace(/^\.\/+/u, '')
    .replace(/\/+$/u, '')

export const isAllowedPath = ({ path, writableRoots }: { path: string; writableRoots: string[] }) => {
  const normalizedPath = normalizeRepoPath(path)
  return writableRoots.some((root) => {
    const normalizedRoot = normalizeRepoPath(root)
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
  })
}

export const buildScopeViolationMessage = ({
  disallowedPaths,
  writableRoots,
}: {
  disallowedPaths: string[]
  writableRoots: string[]
}) => `Your previous attempt modified files outside the allowed lane surface.

Disallowed paths:
${disallowedPaths.map((path) => `- ${path}`).join('\n')}

Allowed writable roots:
${writableRoots.map((path) => `- ${path}`).join('\n')}

Retry with a narrower edit set. Only modify files inside the allowed writable roots.`

const readChangedPaths = async (worktreePath: string) => {
  const diff = await Bun.$`git diff --name-only`.cwd(worktreePath).quiet().nothrow()
  const untracked = await Bun.$`git ls-files --others --exclude-standard`.cwd(worktreePath).quiet().nothrow()

  return [...(await diff.text()).split('\n'), ...(await untracked.text()).split('\n')]
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path, index, paths) => paths.indexOf(path) === index)
}

const readAttemptStatuses = async (runDir: string, attempts: number) => {
  const rows: AttemptStatusRecord[] = []
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const file = Bun.file(attemptStatusPath(runDir, attempt))
    if (await file.exists()) {
      rows.push((await file.json()) as AttemptStatusRecord)
    }
  }
  return rows
}

const runAttempt = async ({
  runDir,
  attempt,
  config,
  strategy,
}: {
  runDir: string
  attempt: number
  config: ResearchLaneConfig
  strategy: string
}) => {
  const worktreePath = await createWorktree(runDir, attempt)
  const startedAt = new Date().toISOString()
  await writeAttemptStatus(runDir, attempt, {
    attempt,
    strategy,
    worktreePath,
    status: 'running',
    startedAt,
  })

  let retryCount = 0
  let currentStrategy = strategy
  let piExitCode = 1
  let validateExitCode = 1
  let diffStat = ''
  let changedPaths: string[] = []
  let disallowedPaths: string[] = []
  let errorMessage = ''
  let pid: number | undefined

  while (retryCount <= MAX_ATTEMPT_RETRIES) {
    const piCommand = await buildPiCommand({ config, strategy: currentStrategy })
    const { proc, exitCode } = await runCommand({
      cmd: piCommand,
      cwd: worktreePath,
      stdoutPath: attemptStdoutPath(runDir, attempt),
      stderrPath: attemptStderrPath(runDir, attempt),
      env: {
        PI_CODING_AGENT_DIR: attemptPiStatePath(runDir, attempt),
      },
    })
    pid = proc.pid
    piExitCode = exitCode
    changedPaths = await readChangedPaths(worktreePath)
    disallowedPaths = changedPaths.filter((path) => !isAllowedPath({ path, writableRoots: config.writableRoots }))

    if (disallowedPaths.length > 0) {
      errorMessage = buildScopeViolationMessage({
        disallowedPaths,
        writableRoots: config.writableRoots,
      })

      await Bun.write(join(runAttemptDir(runDir, attempt), `retry-${retryCount + 1}.txt`), `${errorMessage}\n`)

      if (retryCount < MAX_ATTEMPT_RETRIES) {
        currentStrategy = `${strategy}

Retry guidance:
${errorMessage}`
        retryCount += 1
        continue
      }

      validateExitCode = 1
      diffStat = await summarizeDiff(worktreePath)
      break
    }

    const validate = await Bun.spawn({
      cmd: config.validateCommand,
      cwd: worktreePath,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    })

    const validateStdout = validate.stdout ? await new Response(validate.stdout).text() : ''
    const validateStderr = validate.stderr ? await new Response(validate.stderr).text() : ''

    await Promise.all([
      Bun.write(join(runAttemptDir(runDir, attempt), 'validate.stdout.log'), validateStdout),
      Bun.write(join(runAttemptDir(runDir, attempt), 'validate.stderr.log'), validateStderr),
    ])

    validateExitCode = await validate.exited
    diffStat = await summarizeDiff(worktreePath)
    errorMessage = piExitCode === 0 && validateExitCode === 0 ? '' : `pi=${piExitCode}, validate=${validateExitCode}`
    break
  }

  const finishedAt = new Date().toISOString()
  const status: AttemptStatusRecord = {
    attempt,
    strategy,
    worktreePath,
    status: piExitCode === 0 && validateExitCode === 0 && disallowedPaths.length === 0 ? 'completed' : 'failed',
    startedAt,
    finishedAt,
    pid,
    piExitCode,
    validateExitCode,
    ...(piExitCode === 0 && validateExitCode === 0 && disallowedPaths.length === 0 ? {} : { error: errorMessage }),
  }

  await writeAttemptStatus(runDir, attempt, status)
  await writeJson(attemptResultPath(runDir, attempt), {
    attempt,
    strategy,
    retryCount,
    piExitCode,
    validateExitCode,
    diffStat,
    changedPaths,
    disallowedPaths,
    worktreePath,
  })
}

const runWithParallelism = async ({
  attempts,
  parallelism,
  task,
}: {
  attempts: number
  parallelism: number
  task: (attempt: number) => Promise<void>
}) => {
  let next = 1
  const workers = Array.from({ length: parallelism }, async () => {
    while (next <= attempts) {
      const current = next
      next += 1
      await task(current)
    }
  })
  await Promise.all(workers)
}

const main = async () => {
  const { laneScriptPath, command, attempts, parallelism, runDir } = await parseRunArgs(Bun.argv.slice(2))
  if (!laneScriptPath) {
    console.error(
      'Usage: bun scripts/autoresearch-runner.ts <lane-script-path> [run|status] [--attempts N] [--parallel N] [--run-dir PATH]',
    )
    process.exit(1)
  }

  const config = await getLaneConfig(laneScriptPath)

  if (command === 'status') {
    const effectiveRunDir = runDir
    if (!effectiveRunDir) {
      console.error('status requires --run-dir PATH')
      process.exit(1)
    }

    const manifestFile = Bun.file(join(effectiveRunDir, 'manifest.json'))
    if (!(await manifestFile.exists())) {
      console.error(`No manifest found at ${effectiveRunDir}`)
      process.exit(1)
    }

    const manifest = (await manifestFile.json()) as RunManifest
    const statuses = await readAttemptStatuses(effectiveRunDir, manifest.attempts)
    console.log(
      JSON.stringify(
        {
          manifest,
          attempts: statuses,
        },
        null,
        2,
      ),
    )
    return
  }

  const effectiveRunDir = runDir ?? buildRunDir(config.key)
  await ensureDir(effectiveRunDir)
  await writeJson(join(effectiveRunDir, 'manifest.json'), {
    lane: config.key,
    laneScriptPath: normalizeScriptPath(laneScriptPath),
    createdAt: new Date().toISOString(),
    attempts,
    parallelism,
    runDir: effectiveRunDir,
  } satisfies RunManifest)

  const strategyNotes =
    config.strategyNotes && config.strategyNotes.length > 0
      ? Array.from(
          { length: attempts },
          (_, index) => config.strategyNotes?.[index % config.strategyNotes.length] ?? '',
        )
      : buildStrategyNotes(attempts)

  const stopHandler = async () => {
    const statuses = await readAttemptStatuses(effectiveRunDir, attempts)
    await Promise.all(
      statuses
        .filter((status) => status.status === 'running' && status.pid)
        .map(async (status) => {
          try {
            process.kill(status.pid!, 'SIGTERM')
          } catch {
            // ignore
          }
          await writeAttemptStatus(effectiveRunDir, status.attempt, {
            ...status,
            status: 'stopped',
            finishedAt: new Date().toISOString(),
            error: 'Stopped by operator',
          })
        }),
    )
    process.exit(1)
  }

  process.on('SIGINT', () => {
    void stopHandler()
  })

  await runWithParallelism({
    attempts,
    parallelism,
    task: async (attempt) => {
      const strategy = strategyNotes[attempt - 1]!
      await writeAttemptStatus(effectiveRunDir, attempt, {
        attempt,
        strategy,
        worktreePath: attemptWorktreePath(effectiveRunDir, attempt),
        status: 'queued',
      })
      await runAttempt({
        runDir: effectiveRunDir,
        attempt,
        config,
        strategy,
      })
    },
  })

  const statuses = await readAttemptStatuses(effectiveRunDir, attempts)
  console.log(
    JSON.stringify(
      {
        runDir: effectiveRunDir,
        lane: config.key,
        completed: statuses.filter((status) => status.status === 'completed').length,
        failed: statuses.filter((status) => status.status === 'failed').length,
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  await main()
}
