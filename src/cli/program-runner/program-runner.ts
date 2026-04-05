import { basename, dirname, join, relative, resolve } from 'node:path'
import {
  type ProgramRunnerRun,
  type ProgramRunnerRunInput,
  ProgramRunnerRunInputSchema,
  ProgramRunnerRunSchema,
  type ProgramRunnerStatusInput,
  ProgramRunnerStatusInputSchema,
} from './program-runner.schemas.ts'
import { parseProgramScope } from './program-scope.ts'

const timestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const normalizePath = (value: string): string => value.replaceAll('\\', '/')

const toJson = (value: unknown): string => JSON.stringify(value, null, 2)

const runCommand = async ({
  args,
  cwd,
}: {
  args: string[]
  cwd: string
}): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    exitCode,
    stdout,
    stderr,
  }
}

/**
 * Resolves the git workspace root for a command invocation.
 *
 * @param cwd - Working directory used to run `git rev-parse`.
 * @returns Absolute workspace root path.
 *
 * @public
 */
export const getWorkspaceRoot = async (cwd: string): Promise<string> => {
  const result = await runCommand({
    args: ['git', 'rev-parse', '--show-toplevel'],
    cwd,
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to resolve git workspace root')
  }

  return result.stdout.trim()
}

const loadProgramRunnerContext = async ({
  defaultAllowedPaths,
  programPath,
  workspaceRoot,
}: {
  defaultAllowedPaths: string[]
  programPath: string
  workspaceRoot: string
}): Promise<{ allowedPaths: string[] }> => {
  const file = Bun.file(programPath)
  if (!(await file.exists())) {
    throw new Error(`Missing program file: ${programPath}`)
  }

  const text = await file.text()
  const scopePaths = await parseProgramScope({
    programMarkdown: text,
    programPath,
    workspaceRoot,
  })

  return {
    allowedPaths: scopePaths.length > 0 ? scopePaths : defaultAllowedPaths,
  }
}

/**
 * Derives the program lane name from a program markdown path.
 *
 * @param programPath - Workspace-relative path to the program markdown file.
 * @returns Directory name used as the program lane identifier.
 *
 * @public
 */
export const getProgramLane = (programPath: string): string => basename(dirname(programPath))

/**
 * Builds the directory path for a new program-runner execution.
 *
 * @param options - Program path and workspace context.
 * @param options.programPath - Workspace-relative path to the program markdown file.
 * @param options.rootDir - Optional override for the runs root directory.
 * @param options.workspaceRoot - Absolute workspace root path.
 * @returns Absolute directory path for the new run.
 *
 * @public
 */
export const buildProgramRunDir = ({
  programPath,
  rootDir,
  workspaceRoot,
}: {
  programPath: string
  rootDir?: string
  workspaceRoot: string
}): string => {
  const lane = getProgramLane(programPath)
  const runsRoot = rootDir ? resolve(rootDir) : join(workspaceRoot, '.worktrees', 'factory-program-runner', lane)
  return join(runsRoot, timestamp())
}

/**
 * Resolves absolute and relative defaults for a program-runner invocation.
 *
 * @param options - Program path and default allowed path inputs.
 * @param options.defaultAllowedPaths - Optional fallback writable roots.
 * @param options.programPath - Program path supplied by the caller.
 * @param options.workspaceRoot - Absolute workspace root path.
 * @returns Normalized absolute path, relative path, and default allowed paths.
 *
 * @public
 */
export const resolveProgramDefaults = ({
  defaultAllowedPaths,
  programPath,
  workspaceRoot,
}: {
  defaultAllowedPaths?: string[]
  programPath: string
  workspaceRoot: string
}): {
  absoluteProgramPath: string
  relativeProgramPath: string
  defaultAllowedPaths: string[]
} => {
  const absoluteProgramPath = resolve(workspaceRoot, programPath)
  const relativeProgramPath = normalizePath(relative(workspaceRoot, absoluteProgramPath))
  const relativeProgramDir = normalizePath(dirname(relativeProgramPath))

  return {
    absoluteProgramPath,
    relativeProgramPath,
    defaultAllowedPaths:
      defaultAllowedPaths && defaultAllowedPaths.length > 0
        ? defaultAllowedPaths.map(normalizePath)
        : [`${relativeProgramDir}/`],
  }
}

/**
 * Replaces template placeholders in worker or validation commands.
 *
 * @param options - Command template inputs.
 * @param options.attempt - Attempt number being executed.
 * @param options.artifactDir - Artifact directory for the attempt.
 * @param options.command - Command template segments.
 * @param options.programPath - Workspace-relative program path.
 * @param options.runDir - Run directory for the current execution.
 * @param options.worktreePath - Worktree path for the current attempt.
 * @returns Command segments with known placeholders expanded.
 *
 * @public
 */
export const substituteProgramRunnerCommand = ({
  attempt,
  artifactDir,
  command,
  programPath,
  runDir,
  worktreePath,
}: {
  attempt: number
  artifactDir: string
  command: string[]
  programPath: string
  runDir: string
  worktreePath: string
}): string[] => {
  const replacements: Record<string, string> = {
    '{{attempt}}': String(attempt),
    '{{artifact_dir}}': artifactDir,
    '{{program}}': programPath,
    '{{run_dir}}': runDir,
    '{{worktree}}': worktreePath,
  }

  return command.map((segment) => {
    let next = segment
    for (const [key, value] of Object.entries(replacements)) {
      next = next.replaceAll(key, value)
    }
    return next
  })
}

const writeAttemptStatus = async ({ attemptDir, run }: { attemptDir: string; run: ProgramRunnerRun }) => {
  await Bun.write(join(attemptDir, 'status.json'), toJson(ProgramRunnerRunSchema.parse(run)))
}

const createAttemptRecord = ({
  allowedPaths,
  attempt,
  runDir,
  validateCommand,
  workerCommand,
}: {
  allowedPaths: string[]
  attempt: number
  runDir: string
  validateCommand?: string[]
  workerCommand?: string[]
}) => {
  const attemptDir = join(runDir, `attempt-${String(attempt).padStart(2, '0')}`)
  const worktreePath = join(attemptDir, 'worktree')
  return {
    attempt,
    status: 'prepared' as const,
    worktreePath,
    artifactDir: attemptDir,
    allowedPaths,
    workerCommand,
    validateCommand,
  }
}

const ensureAttemptWorktree = async ({
  attempt,
  baseRef,
  workspaceRoot,
}: {
  attempt: { worktreePath: string }
  baseRef: string
  workspaceRoot: string
}) => {
  const result = await runCommand({
    args: ['git', 'worktree', 'add', '--detach', attempt.worktreePath, baseRef],
    cwd: workspaceRoot,
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `Failed to create worktree at ${attempt.worktreePath}`)
  }
}

const executeAttempt = async ({
  attempt,
  baseRef,
  programPath,
  runDir,
  validateCommand,
  workerCommand,
  workspaceRoot,
}: {
  attempt: ProgramRunnerRun['attempts'][number]
  baseRef: string
  programPath: string
  runDir: string
  validateCommand?: string[]
  workerCommand?: string[]
  workspaceRoot: string
}) => {
  await Bun.$`mkdir -p ${attempt.artifactDir}`.cwd(workspaceRoot).quiet()
  await ensureAttemptWorktree({
    attempt,
    baseRef,
    workspaceRoot,
  })

  attempt.status = 'running'
  attempt.startedAt = new Date().toISOString()

  if (workerCommand && workerCommand.length > 0) {
    const command = substituteProgramRunnerCommand({
      attempt: attempt.attempt,
      artifactDir: attempt.artifactDir,
      command: workerCommand,
      programPath,
      runDir,
      worktreePath: attempt.worktreePath,
    })
    attempt.workerCommand = command
    const result = await runCommand({
      args: command,
      cwd: attempt.worktreePath,
    })
    attempt.workerExitCode = result.exitCode
    await Bun.write(join(attempt.artifactDir, 'worker.stdout.log'), result.stdout)
    await Bun.write(join(attempt.artifactDir, 'worker.stderr.log'), result.stderr)
    if (result.exitCode !== 0) {
      attempt.status = 'failed'
      attempt.error = result.stderr.trim() || `Worker command failed with exit code ${result.exitCode}`
      attempt.finishedAt = new Date().toISOString()
      return
    }
  }

  if (validateCommand && validateCommand.length > 0) {
    const command = substituteProgramRunnerCommand({
      attempt: attempt.attempt,
      artifactDir: attempt.artifactDir,
      command: validateCommand,
      programPath,
      runDir,
      worktreePath: attempt.worktreePath,
    })
    attempt.validateCommand = command
    const result = await runCommand({
      args: command,
      cwd: attempt.worktreePath,
    })
    attempt.validateExitCode = result.exitCode
    await Bun.write(join(attempt.artifactDir, 'validate.stdout.log'), result.stdout)
    await Bun.write(join(attempt.artifactDir, 'validate.stderr.log'), result.stderr)
    if (result.exitCode !== 0) {
      attempt.status = 'failed'
      attempt.error = result.stderr.trim() || `Validation command failed with exit code ${result.exitCode}`
      attempt.finishedAt = new Date().toISOString()
      return
    }
  }

  attempt.status = 'succeeded'
  attempt.finishedAt = new Date().toISOString()
}

const runWithConcurrency = async ({
  items,
  limit,
  worker,
}: {
  items: ProgramRunnerRun['attempts']
  limit: number
  worker: (item: ProgramRunnerRun['attempts'][number]) => Promise<void>
}) => {
  const queue = [...items]
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) return
      await worker(item)
    }
  })

  await Promise.all(runners)
}

/**
 * Creates a worktree-backed program run and executes its attempts.
 *
 * @param input - Program-runner execution input.
 * @returns Persisted run record with updated attempt status.
 *
 * @public
 */
export const runFactoryProgram = async (input: ProgramRunnerRunInput): Promise<ProgramRunnerRun> => {
  const parsed = ProgramRunnerRunInputSchema.parse(input)
  const workspaceRoot = await getWorkspaceRoot(process.cwd())
  const resolved = resolveProgramDefaults({
    defaultAllowedPaths: parsed.defaultAllowedPaths,
    programPath: parsed.programPath,
    workspaceRoot,
  })
  const context = await loadProgramRunnerContext({
    defaultAllowedPaths: resolved.defaultAllowedPaths,
    programPath: resolved.absoluteProgramPath,
    workspaceRoot,
  })
  const runDir = buildProgramRunDir({
    programPath: resolved.relativeProgramPath,
    rootDir: parsed.runDir,
    workspaceRoot,
  })

  await Bun.$`mkdir -p ${runDir}`.cwd(workspaceRoot).quiet()

  const run: ProgramRunnerRun = {
    lane: getProgramLane(resolved.relativeProgramPath),
    programPath: resolved.relativeProgramPath,
    runDir,
    workspaceRoot,
    allowedPaths: context.allowedPaths,
    workerCommand: parsed.workerCommand,
    validateCommand: parsed.validateCommand,
    attempts: Array.from({ length: parsed.attempts }, (_, index) =>
      createAttemptRecord({
        allowedPaths: context.allowedPaths,
        attempt: index + 1,
        runDir,
        validateCommand: parsed.validateCommand,
        workerCommand: parsed.workerCommand,
      }),
    ),
  }

  await Bun.write(join(runDir, 'run.json'), toJson(ProgramRunnerRunSchema.parse(run)))

  await runWithConcurrency({
    items: run.attempts,
    limit: parsed.parallel,
    worker: async (attempt) => {
      try {
        await executeAttempt({
          attempt,
          baseRef: parsed.baseRef,
          programPath: resolved.relativeProgramPath,
          runDir,
          validateCommand: parsed.validateCommand,
          workerCommand: parsed.workerCommand,
          workspaceRoot,
        })
      } catch (error) {
        attempt.status = 'failed'
        attempt.error = error instanceof Error ? error.message : String(error)
        attempt.finishedAt = new Date().toISOString()
      }
      await writeAttemptStatus({
        attemptDir: attempt.artifactDir,
        run,
      })
      await Bun.write(join(runDir, 'run.json'), toJson(ProgramRunnerRunSchema.parse(run)))
    },
  })

  return ProgramRunnerRunSchema.parse(run)
}

/**
 * Finds the most recent run directory for a program lane.
 *
 * @param options - Program path and workspace context.
 * @param options.programPath - Workspace-relative path to the program markdown file.
 * @param options.workspaceRoot - Absolute workspace root path.
 * @returns Absolute path to the most recent run directory.
 *
 * @public
 */
export const findLatestProgramRunDir = async ({
  programPath,
  workspaceRoot,
}: {
  programPath: string
  workspaceRoot: string
}): Promise<string> => {
  const lane = getProgramLane(programPath)
  const runsRoot = join(workspaceRoot, '.worktrees', 'factory-program-runner', lane)
  const directoryCheck = await Bun.$`test -d ${runsRoot}`.nothrow().quiet()
  if (directoryCheck.exitCode !== 0) {
    throw new Error(`No runs found for ${programPath}`)
  }

  const entries = await Array.fromAsync(new Bun.Glob('*').scan({ cwd: runsRoot, onlyFiles: false }))
  const candidates = entries.sort()
  const latest = candidates.at(-1)
  if (!latest) {
    throw new Error(`No runs found for ${programPath}`)
  }

  return join(runsRoot, latest)
}

/**
 * Loads a persisted program-runner run from disk.
 *
 * @param input - Status lookup input.
 * @returns Parsed run record.
 *
 * @public
 */
export const loadFactoryProgramRun = async (input: ProgramRunnerStatusInput): Promise<ProgramRunnerRun> => {
  const parsed = ProgramRunnerStatusInputSchema.parse(input)
  const workspaceRoot = await getWorkspaceRoot(process.cwd())
  const resolved = resolveProgramDefaults({
    programPath: parsed.programPath,
    workspaceRoot,
  })
  const runDir =
    parsed.runDir ??
    (await findLatestProgramRunDir({
      programPath: resolved.relativeProgramPath,
      workspaceRoot,
    }))
  const raw = await Bun.file(join(runDir, 'run.json')).json()
  return ProgramRunnerRunSchema.parse(raw)
}
