#!/usr/bin/env bun

import { join, resolve } from 'node:path'

type ProgramKey = 'default-hypergraph' | 'behavioral-factories'

type ProgramConfig = {
  key: ProgramKey
  programPath: string
  validateCommand: string[]
  writableRoots: string[]
  skills: string[]
  taskPrompt: string
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
  program: ProgramKey
  createdAt: string
  attempts: number
  concurrency: number
  runDir: string
}

const PROGRAMS: Record<ProgramKey, ProgramConfig> = {
  'default-hypergraph': {
    key: 'default-hypergraph',
    programPath: join('dev-research', 'default-hypergraph', 'program.md'),
    validateCommand: ['bun', 'scripts/default-hypergraph.ts', 'validate'],
    writableRoots: [join('dev-research', 'default-hypergraph'), join('scripts'), join('package.json')],
    skills: [join('skills', 'hypergraph-memory'), join('skills', 'mss-vocabulary'), join('skills', 'behavioral-core')],
    taskPrompt:
      'Improve the default hypergraph program artifacts. Prefer small deterministic edits that strengthen the seed graph, validation, and concept coverage. Run the validator before finishing and summarize what changed.',
  },
  'behavioral-factories': {
    key: 'behavioral-factories',
    programPath: join('dev-research', 'behavioral-factories', 'program.md'),
    validateCommand: ['bun', 'scripts/behavioral-factories.ts', 'validate'],
    writableRoots: [join('dev-research', 'behavioral-factories'), join('scripts'), join('package.json')],
    skills: [join('skills', 'behavioral-core'), join('skills', 'hypergraph-memory'), join('skills', 'mss-vocabulary')],
    taskPrompt:
      'Improve the behavioral factories program artifacts. Prefer deterministic policy and factory surfaces, not freeform prompts. Run the validator before finishing and summarize what changed.',
  },
}

export const buildStrategyNotes = (attempts: number): string[] => {
  const base = [
    'coverage-first: close the most obvious symbolic coverage gaps first.',
    'link-integrity-first: strengthen required graph and factory links before broadening scope.',
    'runtime-trigger-first: focus on search, retrieval, ask-human, and stop semantics.',
    'decomposition-first: improve fanout, merge, and single-path decision concepts.',
    'safety-first: strengthen boundary, uncertainty, and unsupported-claim handling.',
    'minimal-diff: prefer the smallest coherent edit set that improves validation.',
    'agent-sensor-first: emphasize tool, sensor, and evidence-state representation.',
    'modnet-structure-first: strengthen Structural IA and MSS relationships.',
    'factory-contract-first: clarify deterministic graph-to-factory compilation surfaces.',
    'evaluation-first: improve deterministic validation surfaces and testability.',
  ]

  return Array.from({ length: attempts }, (_, index) => base[index % base.length]!)
}

export const getProgramConfig = (key: ProgramKey): ProgramConfig => PROGRAMS[key]

export const parseRunArgs = (args: string[]) => {
  const program = args[0] as ProgramKey | undefined
  const command = (args[1] ?? 'run') as 'run' | 'status'
  let attempts = 5
  let concurrency = 2
  let runDir: string | null = null

  for (let i = 2; i < args.length; i += 1) {
    const arg = args[i]
    const next = args[i + 1]
    if (arg === '--attempts' && next) {
      attempts = Number(next)
      i += 1
      continue
    }
    if (arg === '--concurrency' && next) {
      concurrency = Number(next)
      i += 1
      continue
    }
    if (arg === '--run-dir' && next) {
      runDir = next
      i += 1
    }
  }

  return { program, command, attempts, concurrency, runDir }
}

const formatTimestamp = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const buildRunDir = (program: ProgramKey) => join('.prompts', 'research-fanout', program, formatTimestamp())

const runAttemptDir = (runDir: string, attempt: number) =>
  join(runDir, `attempt-${attempt.toString().padStart(2, '0')}`)
const attemptStatusPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'status.json')
const attemptResultPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'result.json')
const attemptStdoutPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'stdout.log')
const attemptStderrPath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'stderr.log')
const attemptWorktreePath = (runDir: string, attempt: number) => join(runAttemptDir(runDir, attempt), 'repo')

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
  return {
    proc,
    exitCode,
  }
}

const writeAttemptStatus = async (runDir: string, attempt: number, status: AttemptStatusRecord) => {
  await writeJson(attemptStatusPath(runDir, attempt), status)
}

const createWorktree = async (runDir: string, attempt: number) => {
  const worktreePath = attemptWorktreePath(runDir, attempt)
  await ensureDir(runAttemptDir(runDir, attempt))
  await Bun.$`git worktree add --detach ${worktreePath} HEAD`.cwd(process.cwd()).quiet()
  return worktreePath
}

const buildSystemPrompt = async (config: ProgramConfig) => {
  const programText = (await Bun.file(config.programPath).text()).trim()
  const writableRoots = config.writableRoots.map((path) => `- ${path}`).join('\n')
  return `${programText}

Execution contract:
- Work only within the selected program surfaces.
- Prefer deterministic edits over broad speculative changes.
- Run the required validator before finishing.
- Preserve explicit observability and testability.

Writable roots:
${writableRoots}`
}

const buildPiCommand = async ({ config, strategy }: { config: ProgramConfig; strategy: string }) => {
  const systemPrompt = await buildSystemPrompt(config)
  const cmd = [
    'bunx',
    'varlock',
    'run',
    '--',
    'bunx',
    'pi',
    '--model',
    'openrouter/minimax/minimax-m2.7',
    '--no-skills',
  ]

  for (const skill of config.skills) {
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
  config: ProgramConfig
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

  const piCommand = await buildPiCommand({ config, strategy })
  const { proc, exitCode: piExitCode } = await runCommand({
    cmd: piCommand,
    cwd: worktreePath,
    stdoutPath: attemptStdoutPath(runDir, attempt),
    stderrPath: attemptStderrPath(runDir, attempt),
  })

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

  const validateExitCode = await validate.exited
  const diffStat = await summarizeDiff(worktreePath)
  const finishedAt = new Date().toISOString()
  const status: AttemptStatusRecord = {
    attempt,
    strategy,
    worktreePath,
    status: piExitCode === 0 && validateExitCode === 0 ? 'completed' : 'failed',
    startedAt,
    finishedAt,
    pid: proc.pid,
    piExitCode,
    validateExitCode,
    ...(piExitCode === 0 && validateExitCode === 0 ? {} : { error: `pi=${piExitCode}, validate=${validateExitCode}` }),
  }

  await writeAttemptStatus(runDir, attempt, status)
  await writeJson(attemptResultPath(runDir, attempt), {
    attempt,
    strategy,
    piExitCode,
    validateExitCode,
    diffStat,
    worktreePath,
  })
}

const runWithConcurrency = async ({
  attempts,
  concurrency,
  task,
}: {
  attempts: number
  concurrency: number
  task: (attempt: number) => Promise<void>
}) => {
  let next = 1
  const workers = Array.from({ length: concurrency }, async () => {
    while (next <= attempts) {
      const current = next
      next += 1
      await task(current)
    }
  })
  await Promise.all(workers)
}

const main = async () => {
  const { program, command, attempts, concurrency, runDir } = parseRunArgs(Bun.argv.slice(2))
  if (!program || !(program in PROGRAMS)) {
    console.error(
      'Usage: bun scripts/research-pi-fanout.ts <default-hypergraph|behavioral-factories> [run|status] [--attempts N] [--concurrency N] [--run-dir PATH]',
    )
    process.exit(1)
  }

  const config = getProgramConfig(program)

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

  const effectiveRunDir = runDir ?? buildRunDir(program)
  await ensureDir(effectiveRunDir)
  await writeJson(join(effectiveRunDir, 'manifest.json'), {
    program,
    createdAt: new Date().toISOString(),
    attempts,
    concurrency,
    runDir: effectiveRunDir,
  } satisfies RunManifest)

  const strategyNotes = buildStrategyNotes(attempts)

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

  await runWithConcurrency({
    attempts,
    concurrency,
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
        program,
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
