#!/usr/bin/env bun

import { mkdir } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

type ProgramPhase = {
  name: string
  programs: string[]
}

type OrchestrationInput = {
  attempts?: number
  baseRef?: string
  dryRun?: boolean
  outputDir?: string
  parallel?: number
  phase?: string
  programs?: string[]
  test?: boolean
}

type ProgramRunAttempt = {
  artifactDir: string
  attempt: number
  changedPaths?: string[]
  error?: string
  formatExitCode?: number
  outOfScopePaths?: string[]
  repoOutOfScopePaths?: string[]
  status: 'prepared' | 'running' | 'succeeded' | 'failed'
  targetedTestsExitCode?: number
  typecheckExitCode?: number
  validateExitCode?: number
  workerExitCode?: number
  worktreePath: string
}

type ProgramRunRecord = {
  lane: string
  programPath: string
  runDir: string
  attempts: ProgramRunAttempt[]
}

type ModelReview = {
  decision: 'accept' | 'defer' | 'reject'
  reasoning: string
}

type LaneSummary = {
  judge?: ModelReview
  lane: string
  metaVerifier?: ModelReview
  programPath: string
  runDir: string
  succeededAttempts: number
  totalAttempts: number
}

type Logger = {
  path: string
  write: (message: string) => Promise<void>
}

type PreflightCheck = {
  name: string
  ok: boolean
  detail: string
}

type PlannedRunInput = {
  programPath: string
  attempts: number
  parallel: number
  baseRef: string
  runDir: string
  workerCommand: string[]
  validateCommand: string[]
}

type CommandResult = {
  exitCode: number
  stderr: string
  stdout: string
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const DEFAULT_PROGRAM_PHASES: ProgramPhase[] = [
  {
    name: 'infrastructure',
    programs: [
      'dev-research/server-factory/program.md',
      'dev-research/fanout-factories/program.md',
      'dev-research/verification-factories/program.md',
      'dev-research/observability-factories/program.md',
    ],
  },
  {
    name: 'behavior',
    programs: [
      'dev-research/plan-factories/program.md',
      'dev-research/edit-factories/program.md',
      'dev-research/context-assembly-factories/program.md',
      'dev-research/tool-registry-factories/program.md',
    ],
  },
  {
    name: 'capabilities',
    programs: [
      'dev-research/search-factories/program.md',
      'dev-research/memory-factories/program.md',
      'dev-research/module-discovery-factories/program.md',
      'dev-research/skill-factories/program.md',
      'dev-research/mcp-factories/program.md',
      'dev-research/a2a-factories/program.md',
    ],
  },
  {
    name: 'policy',
    programs: [
      'dev-research/node-auth-factories/program.md',
      'dev-research/identity-trust-factories/program.md',
      'dev-research/permission-audit-factories/program.md',
      'dev-research/notification-factories/program.md',
    ],
  },
  {
    name: 'integration',
    programs: [
      'dev-research/default-factories/program.md',
      'dev-research/agent-bootstrap/program.md',
      'dev-research/autoresearch-factories/program.md',
    ],
  },
]

const timestamp = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

const parseInput = async (): Promise<OrchestrationInput> => {
  const arg = Bun.argv[2]
  if (arg) {
    return JSON.parse(arg) as OrchestrationInput
  }

  const stdin = await Bun.stdin.text()
  return stdin.trim() ? (JSON.parse(stdin) as OrchestrationInput) : {}
}

export const resolvePrograms = ({ phase, programs }: { phase?: string; programs?: string[] }): string[] => {
  if (programs && programs.length > 0) {
    return programs
  }

  const selectedPhases = phase ? DEFAULT_PROGRAM_PHASES.filter((item) => item.name === phase) : DEFAULT_PROGRAM_PHASES

  if (selectedPhases.length === 0) {
    throw new Error(`Unknown phase: ${phase}`)
  }

  return selectedPhases.flatMap((item) => item.programs)
}

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

const appendJsonl = async ({ path, row }: { path: string; row: unknown }) => {
  const file = Bun.file(path)
  const current = (await file.exists()) ? await file.text() : ''
  await Bun.write(path, `${current}${JSON.stringify(row)}\n`)
}

const createLogger = (path: string): Logger => ({
  path,
  write: async (message) => {
    const line = `[${new Date().toISOString()}] ${message}`
    console.log(line)
    const file = Bun.file(path)
    const current = (await file.exists()) ? await file.text() : ''
    await Bun.write(path, `${current}${line}\n`)
  },
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const runCommand = async ({
  args,
  cwd,
  stdin,
}: {
  args: string[]
  cwd: string
  stdin?: string
}): Promise<CommandResult> => {
  const proc = Bun.spawn(args, {
    cwd,
    stdin: stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (stdin !== undefined && proc.stdin) {
    proc.stdin.write(stdin)
    proc.stdin.end()
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    exitCode,
    stderr,
    stdout,
  }
}

const buildProgramRunDir = ({ programPath, workspaceRoot }: { programPath: string; workspaceRoot: string }) =>
  resolve(workspaceRoot, '.worktrees', 'factory-program-runner', basename(dirname(programPath)), timestamp())

const getExecutionPlanPath = (runDir: string) => join(runDir, 'execution-plan.md')
const MAX_ARTIFACT_EXCERPT_CHARS = 4_000
const MAX_CHANGED_FILE_EXCERPT_CHARS = 2_500
const MAX_CHANGED_FILE_EXCERPTS = 8

const buildPlannerPrompt = async ({ programPath }: { programPath: string }) => {
  const programMarkdown = await Bun.file(resolve(programPath)).text()

  return [
    'Read AGENTS.md and the provided factory-program lane.',
    'Produce an execution plan for a separate coding agent to implement in a detached worktree.',
    'Do not write code. Do not modify files. Plan only.',
    'Return Markdown only.',
    'Keep the plan concrete and bounded.',
    'Plan only within the executable writable roots for the lane. Do not propose documentation or program.md edits.',
    'Bias toward a smallest viable first implementation slice that can realistically be completed in one coding attempt.',
    'Prefer one narrow helper-and-wiring pass plus focused tests over a broad multi-surface refactor.',
    'Include these sections exactly: Objective, Constraints, Execution Steps, Validation, Exit Criteria.',
    'In Execution Steps, list a short ordered sequence of concrete edits/tests and mention the expected file paths when you can infer them.',
    'Respect the writable roots declared by the lane program and call them out under Constraints.',
    'In Validation, require formatting, type checking, and targeted tests for the affected files or lane surface only. Do not propose running a full unrelated test suite.',
    'Do not include optional follow-up work, future phases, or documentation sync steps in the execution plan.',
    '',
    `Lane program: @${programPath}`,
    '',
    programMarkdown,
  ].join('\n')
}

const generateExecutionPlan = async ({
  logger,
  planner,
  programPath,
  runDir,
  workspaceRoot,
}: {
  logger: Logger
  planner: string
  programPath: string
  runDir: string
  workspaceRoot: string
}) => {
  await mkdir(runDir, { recursive: true })

  const plannerPrompt = await buildPlannerPrompt({ programPath })
  const plannerPromptPath = join(runDir, 'planner.prompt.md')
  const plannerStdoutPath = join(runDir, 'planner.stdout.log')
  const plannerStderrPath = join(runDir, 'planner.stderr.log')
  const planPath = getExecutionPlanPath(runDir)

  await Bun.write(plannerPromptPath, `${plannerPrompt}\n`)

  const result = await runCommand({
    args: [planner, '-a', 'never', 'exec', '-s', 'read-only', '-C', workspaceRoot, '-o', planPath, plannerPrompt],
    cwd: workspaceRoot,
  })

  await Bun.write(plannerStdoutPath, result.stdout)
  await Bun.write(plannerStderrPath, result.stderr)

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Planner failed for ${programPath}`)
  }

  const planFile = Bun.file(planPath)
  if (!(await planFile.exists())) {
    throw new Error(`Planner did not produce execution plan for ${programPath}`)
  }

  const planMarkdown = (await planFile.text()).trim()
  if (!planMarkdown) {
    throw new Error(`Planner produced empty execution plan for ${programPath}`)
  }

  await logger.write(`planner-finished program=${programPath} planPath=${planPath}`)
  return {
    planMarkdown,
    planPath,
  }
}

const createPlannedRunInput = ({
  attempts,
  baseRef,
  parallel,
  programPath,
  runDir,
}: {
  attempts: number
  baseRef: string
  parallel: number
  programPath: string
  runDir: string
}): PlannedRunInput => ({
  programPath,
  attempts,
  parallel,
  baseRef,
  runDir,
  workerCommand: [
    'bun',
    'scripts/run-pi-factory-worker.ts',
    '--program',
    '{{program}}',
    '--artifact-dir',
    '{{artifact_dir}}',
    '--plan',
    '{{run_dir}}/execution-plan.md',
    '--retry-guidance',
    '{{run_dir}}/retry-guidance.md',
  ],
  validateCommand: [
    'bun',
    'scripts/factory-validate.ts',
    '--program',
    '{{program}}',
    '--changed-paths-file',
    '{{artifact_dir}}/changed-paths.json',
  ],
})

const callProgramRunner = async ({
  attempts,
  baseRef,
  parallel,
  programPath,
  runDir,
  workspaceRoot,
}: {
  attempts: number
  baseRef: string
  parallel: number
  programPath: string
  runDir: string
  workspaceRoot: string
}): Promise<ProgramRunRecord> => {
  const input = createPlannedRunInput({
    attempts,
    baseRef,
    parallel,
    programPath,
    runDir,
  })

  const result = await runCommand({
    args: ['bun', 'run', './bin/plaited.ts', 'program-runner', 'run', JSON.stringify(input)],
    cwd: workspaceRoot,
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `program-runner failed for ${programPath}`)
  }

  return JSON.parse(result.stdout) as ProgramRunRecord
}

const runPreflight = async ({ workspaceRoot }: { workspaceRoot: string }): Promise<PreflightCheck[]> => {
  const checks: PreflightCheck[] = []
  const requiredEnvVars = [
    'OPENROUTER_API_KEY',
    'PLAITED_EXECUTION_MODEL',
    'PLAITED_EXECUTION_FALLBACK_MODEL',
    'PLAITED_PRIMARY_JUDGE_MODEL',
    'PLAITED_META_VERIFIER_MODEL',
  ]

  for (const name of requiredEnvVars) {
    const value = process.env[name]
    checks.push({
      name: `env:${name}`,
      ok: !!value,
      detail: value ? 'present' : 'missing',
    })
  }

  const commands: Array<{ name: string; args: string[] }> = [
    { name: 'bun-version', args: ['bun', '--version'] },
    { name: 'codex-version', args: ['codex', '--version'] },
    { name: 'git-version', args: ['git', '--version'] },
    { name: 'pi-version', args: ['bunx', 'pi', '--version'] },
    { name: 'typecheck', args: ['bun', '--bun', 'tsc', '--noEmit'] },
    { name: 'script-tests', args: ['bun', 'test', 'scripts/tests/factory-program-scripts.spec.ts'] },
  ]

  for (const command of commands) {
    const result = await runCommand({
      args: command.args,
      cwd: workspaceRoot,
    })
    checks.push({
      name: command.name,
      ok: result.exitCode === 0,
      detail: result.exitCode === 0 ? result.stdout.trim() || 'ok' : result.stderr.trim() || result.stdout.trim(),
    })
  }

  return checks
}

const getAttemptDiffSummary = async (attempt: ProgramRunAttempt) => {
  const diffSummaryPath = resolve(attempt.artifactDir, 'diff-summary.txt')
  const file = Bun.file(diffSummaryPath)
  if (await file.exists()) {
    return (await file.text()).trim()
  }

  const sections = []
  if (attempt.changedPaths && attempt.changedPaths.length > 0) {
    sections.push(['Changed paths:', ...attempt.changedPaths].join('\n'))
  }
  if (attempt.outOfScopePaths && attempt.outOfScopePaths.length > 0) {
    sections.push(['Out of scope paths:', ...attempt.outOfScopePaths].join('\n'))
  }
  return sections.join('\n\n')
}

const readAttemptArtifactExcerpt = async ({
  attempt,
  fileName,
  maxChars = MAX_ARTIFACT_EXCERPT_CHARS,
}: {
  attempt: ProgramRunAttempt
  fileName: string
  maxChars?: number
}) => {
  const path = resolve(attempt.artifactDir, fileName)
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return null
  }

  const text = (await file.text()).trim()
  if (!text) {
    return null
  }

  if (text.length <= maxChars) {
    return text
  }

  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`
}

const readChangedFileExcerpts = async ({
  attempt,
  maxCharsPerFile = MAX_CHANGED_FILE_EXCERPT_CHARS,
  maxFiles = MAX_CHANGED_FILE_EXCERPTS,
}: {
  attempt: ProgramRunAttempt
  maxCharsPerFile?: number
  maxFiles?: number
}) => {
  const changedPaths = attempt.changedPaths ?? []
  const excerpts = await Promise.all(
    changedPaths.slice(0, maxFiles).map(async (relativePath) => {
      const path = resolve(attempt.worktreePath, relativePath)
      const file = Bun.file(path)
      if (!(await file.exists())) {
        return {
          path: relativePath,
          content: '[missing from worktree]',
        }
      }

      const text = await file.text()
      const content =
        text.length <= maxCharsPerFile
          ? text
          : `${text.slice(0, maxCharsPerFile)}\n...[truncated ${text.length - maxCharsPerFile} chars]`

      return {
        path: relativePath,
        content,
      }
    }),
  )

  return excerpts
}

const extractJsonObject = (content: string): string => {
  const trimmed = content.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced?.[1]?.trim() || trimmed
}

const callOpenRouterReview = async ({
  logger,
  model,
  prompt,
  system,
}: {
  logger?: Logger
  model: string
  prompt: string
  system: string
}): Promise<ModelReview> => {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for judge and meta-verifier reviews')
  }

  const maxAttempts = 4

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
          const backoffMs = 2_000 * attempt
          await logger?.write(
            `openrouter-retry model=${model} attempt=${attempt} status=${response.status} backoffMs=${backoffMs}`,
          )
          await sleep(backoffMs)
          continue
        }
        throw new Error(`OpenRouter review failed for model ${model}: ${response.status} ${body}`)
      }

      const json = (await response.json()) as OpenRouterResponse
      const content = json.choices?.[0]?.message?.content
      if (!content) {
        throw new Error(`OpenRouter review returned no content for model ${model}`)
      }

      const parsed = JSON.parse(extractJsonObject(content)) as Partial<ModelReview>
      if (parsed.decision !== 'accept' && parsed.decision !== 'defer' && parsed.decision !== 'reject') {
        throw new Error(`Invalid review decision from model ${model}: ${content}`)
      }
      if (!parsed.reasoning) {
        throw new Error(`Missing review reasoning from model ${model}: ${content}`)
      }

      return {
        decision: parsed.decision,
        reasoning: parsed.reasoning,
      }
    } catch (error) {
      if (attempt < maxAttempts) {
        const backoffMs = 2_000 * attempt
        await logger?.write(
          `openrouter-retry model=${model} attempt=${attempt} error=${JSON.stringify(error instanceof Error ? error.message : String(error))} backoffMs=${backoffMs}`,
        )
        await sleep(backoffMs)
        continue
      }
      throw error
    }
  }

  throw new Error(`OpenRouter review exhausted retries for model ${model}`)
}

const buildJudgePayload = async ({ programPath, run }: { programPath: string; run: ProgramRunRecord }) => {
  const programMarkdown = await Bun.file(resolve(programPath)).text()
  const executionPlanPath = getExecutionPlanPath(run.runDir)
  const executionPlan = (await Bun.file(executionPlanPath).exists()) ? await Bun.file(executionPlanPath).text() : null
  const attempts = await Promise.all(
    run.attempts.map(async (attempt) => ({
      attempt: attempt.attempt,
      status: attempt.status,
      workerExitCode: attempt.workerExitCode ?? null,
      formatExitCode: attempt.formatExitCode ?? null,
      typecheckExitCode: attempt.typecheckExitCode ?? null,
      targetedTestsExitCode: attempt.targetedTestsExitCode ?? null,
      validateExitCode: attempt.validateExitCode ?? null,
      error: attempt.error ?? null,
      changedPaths: attempt.changedPaths ?? [],
      outOfScopePaths: attempt.outOfScopePaths ?? [],
      repoOutOfScopePaths: attempt.repoOutOfScopePaths ?? [],
      diffStat: await getAttemptDiffSummary(attempt),
      changedFileExcerpts: await readChangedFileExcerpts({
        attempt,
      }),
      workerStdout: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'pi.stdout.log',
      }),
      workerStderr: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'pi.stderr.log',
      }),
      workerProgress: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'worker.progress.log',
      }),
      validateStdout: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'validate.stdout.log',
      }),
      validateStderr: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'validate.stderr.log',
      }),
      formatStdout: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'format.stdout.log',
      }),
      formatStderr: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'format.stderr.log',
      }),
      typecheckStdout: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'typecheck.stdout.log',
      }),
      typecheckStderr: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'typecheck.stderr.log',
      }),
      targetedTestsStdout: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'targeted-tests.stdout.log',
      }),
      targetedTestsStderr: await readAttemptArtifactExcerpt({
        attempt,
        fileName: 'targeted-tests.stderr.log',
      }),
    })),
  )

  return {
    programPath,
    lane: run.lane,
    executionPlan,
    programMarkdown,
    attempts,
  }
}

export const buildJudgePrompt = async ({
  programPath,
  run,
}: {
  programPath: string
  run: ProgramRunRecord
}): Promise<string> => JSON.stringify(await buildJudgePayload({ programPath, run }), null, 2)

const createLaneSummary = ({
  judge,
  metaVerifier,
  programPath,
  run,
}: {
  judge?: ModelReview
  metaVerifier?: ModelReview
  programPath: string
  run: ProgramRunRecord
}): LaneSummary => ({
  lane: run.lane,
  programPath,
  runDir: run.runDir,
  succeededAttempts: run.attempts.filter((attempt) => attempt.status === 'succeeded').length,
  totalAttempts: run.attempts.length,
  judge,
  metaVerifier,
})

const main = async () => {
  const input = await parseInput()
  const workspaceRoot = process.cwd()
  const attempts = input.attempts ?? Number(process.env.PLAITED_PROGRAM_ATTEMPTS ?? 3)
  const parallel = input.parallel ?? Number(process.env.PLAITED_PROGRAM_PARALLEL ?? 2)
  const baseRef = input.baseRef ?? 'HEAD'
  const programPaths = resolvePrograms({
    phase: input.phase,
    programs: input.programs,
  })

  const outputDir = resolve(
    input.outputDir ?? join(workspaceRoot, '.plaited', 'orchestration', 'factory-programs', timestamp()),
  )
  await mkdir(outputDir, { recursive: true })

  const logger = createLogger(join(outputDir, 'orchestrator.log'))
  const summaryPath = join(outputDir, 'summary.json')
  const rowsPath = join(outputDir, 'runs.jsonl')
  const summaries: LaneSummary[] = []

  await Bun.write(
    join(outputDir, 'config.json'),
    toJson({
      planner: process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex',
      executionProvider: process.env.PLAITED_EXECUTION_PROVIDER ?? 'openrouter',
      executionModel: process.env.PLAITED_EXECUTION_MODEL ?? 'google/gemma-4-26b-a4b-it',
      executionFallbackModel: process.env.PLAITED_EXECUTION_FALLBACK_MODEL ?? 'google/gemma-4-26b-a4b-it',
      judgeModel: process.env.PLAITED_PRIMARY_JUDGE_MODEL ?? 'minimax/minimax-m2.7',
      metaVerifierModel: process.env.PLAITED_META_VERIFIER_MODEL ?? 'deepseek/deepseek-v3.2',
      attempts,
      parallel,
      baseRef,
      programs: programPaths,
    }),
  )
  await logger.write(`orchestration-start outputDir=${outputDir}`)
  await logger.write(`planner=${process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex'}`)
  await logger.write(
    `execution=${process.env.PLAITED_EXECUTION_PROVIDER ?? 'openrouter'}:${process.env.PLAITED_EXECUTION_MODEL ?? 'google/gemma-4-26b-a4b-it'}`,
  )
  await logger.write(`judge=${process.env.PLAITED_PRIMARY_JUDGE_MODEL ?? 'minimax/minimax-m2.7'}`)
  await logger.write(`meta-verifier=${process.env.PLAITED_META_VERIFIER_MODEL ?? 'deepseek/deepseek-v3.2'}`)
  await logger.write(
    `program-count=${programPaths.length} attempts=${attempts} parallel=${parallel} baseRef=${baseRef}`,
  )

  if (input.test) {
    await logger.write('preflight-start')
    const checks = await runPreflight({ workspaceRoot })
    await Bun.write(join(outputDir, 'preflight.json'), toJson(checks))
    for (const check of checks) {
      await logger.write(`preflight-check name=${check.name} ok=${check.ok} detail=${JSON.stringify(check.detail)}`)
    }
    const failed = checks.filter((check) => !check.ok)
    if (failed.length > 0) {
      await logger.write(`preflight-failed count=${failed.length}`)
      process.exit(1)
    }
    await logger.write('preflight-passed')
    console.log(
      JSON.stringify(
        {
          mode: 'test',
          outputDir,
          checks,
        },
        null,
        2,
      ),
    )
    return
  }

  if (input.dryRun) {
    const plan = programPaths.map((programPath) => ({
      programPath,
      runDir: buildProgramRunDir({
        programPath,
        workspaceRoot,
      }),
      runInput: createPlannedRunInput({
        attempts,
        baseRef,
        parallel,
        programPath,
        runDir: buildProgramRunDir({
          programPath,
          workspaceRoot,
        }),
      }),
    }))
    await Bun.write(join(outputDir, 'dry-run-plan.json'), toJson(plan))
    for (const item of plan) {
      await logger.write(`dry-run program=${item.programPath}`)
    }
    await logger.write('dry-run-finished')
    console.log(
      JSON.stringify(
        {
          mode: 'dryRun',
          outputDir,
          plan,
        },
        null,
        2,
      ),
    )
    return
  }

  for (const programPath of programPaths) {
    await logger.write(`program-start program=${programPath}`)
    const runDir = buildProgramRunDir({
      programPath,
      workspaceRoot,
    })
    const planner = process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex'
    await logger.write(`planner-start program=${programPath} planner=${planner}`)
    await generateExecutionPlan({
      logger,
      planner,
      programPath,
      runDir,
      workspaceRoot,
    })
    const run = await callProgramRunner({
      attempts,
      baseRef,
      parallel,
      programPath,
      runDir,
      workspaceRoot,
    })
    await logger.write(`program-run-finished program=${programPath} runDir=${run.runDir}`)

    const judgePayload = await buildJudgePayload({
      programPath,
      run,
    })
    const judgePrompt = JSON.stringify(judgePayload, null, 2)

    const judge = await callOpenRouterReview({
      logger,
      model: process.env.PLAITED_PRIMARY_JUDGE_MODEL ?? 'minimax/minimax-m2.7',
      system:
        'You are a strict judge for autonomous factory-program attempts. Return JSON with keys decision and reasoning only.',
      prompt: [
        'Judge whether this program-runner result should be promoted, deferred, or rejected.',
        'Prefer defer when validation passed but the evidence is still incomplete.',
        'The executionPlan is the planner-approved target. Evaluate whether the worker substantially executed that plan within lane constraints.',
        judgePrompt,
      ].join('\n\n'),
    })
    await logger.write(`judge-finished program=${programPath} decision=${judge.decision}`)

    const metaVerifier = await callOpenRouterReview({
      logger,
      model: process.env.PLAITED_META_VERIFIER_MODEL ?? 'deepseek/deepseek-v3.2',
      system: 'You verify a prior judge result. Return JSON with keys decision and reasoning only.',
      prompt: JSON.stringify(
        {
          judge,
          evidence: judgePayload,
        },
        null,
        2,
      ),
    })
    await logger.write(`meta-verifier-finished program=${programPath} decision=${metaVerifier.decision}`)

    const summary = createLaneSummary({
      judge,
      metaVerifier,
      programPath,
      run,
    })
    summaries.push(summary)

    await appendJsonl({
      path: rowsPath,
      row: summary,
    })
    await Bun.write(
      summaryPath,
      toJson({
        planner: process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex',
        generatedAt: new Date().toISOString(),
        summaries,
      }),
    )
    await logger.write(
      `program-summary program=${programPath} succeededAttempts=${summary.succeededAttempts}/${summary.totalAttempts}`,
    )
  }

  await logger.write('orchestration-finished')

  console.log(
    JSON.stringify(
      {
        outputDir,
        runs: summaries,
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  await main()
}
