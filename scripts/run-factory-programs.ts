#!/usr/bin/env bun

import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

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
  outOfScopePaths?: string[]
  status: 'prepared' | 'running' | 'succeeded' | 'failed'
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

const runCommand = async ({ args, cwd }: { args: string[]; cwd: string }): Promise<CommandResult> => {
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
    stderr,
    stdout,
  }
}

const createPlannedRunInput = ({
  attempts,
  baseRef,
  parallel,
  programPath,
}: {
  attempts: number
  baseRef: string
  parallel: number
  programPath: string
}): PlannedRunInput => ({
  programPath,
  attempts,
  parallel,
  baseRef,
  workerCommand: [
    'bun',
    'scripts/run-pi-factory-worker.ts',
    '--program',
    '{{program}}',
    '--artifact-dir',
    '{{artifact_dir}}',
  ],
  validateCommand: ['bun', 'scripts/factory-validate.ts', '--program', '{{program}}'],
})

const callProgramRunner = async ({
  attempts,
  baseRef,
  parallel,
  programPath,
  workspaceRoot,
}: {
  attempts: number
  baseRef: string
  parallel: number
  programPath: string
  workspaceRoot: string
}): Promise<ProgramRunRecord> => {
  const input = createPlannedRunInput({
    attempts,
    baseRef,
    parallel,
    programPath,
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

      const parsed = JSON.parse(content) as Partial<ModelReview>
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

export const buildJudgePrompt = async ({
  programPath,
  run,
}: {
  programPath: string
  run: ProgramRunRecord
}): Promise<string> => {
  const programMarkdown = await Bun.file(resolve(programPath)).text()
  const attempts = await Promise.all(
    run.attempts.map(async (attempt) => ({
      attempt: attempt.attempt,
      status: attempt.status,
      workerExitCode: attempt.workerExitCode ?? null,
      validateExitCode: attempt.validateExitCode ?? null,
      error: attempt.error ?? null,
      diffStat: await getAttemptDiffSummary(attempt),
    })),
  )

  return JSON.stringify(
    {
      programPath,
      lane: run.lane,
      programMarkdown,
      attempts,
    },
    null,
    2,
  )
}

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
      executionModel: process.env.PLAITED_EXECUTION_MODEL ?? 'google/gemma-4-31b-it',
      executionFallbackModel: process.env.PLAITED_EXECUTION_FALLBACK_MODEL ?? 'google/gemma-4-31b-it',
      judgeModel: process.env.PLAITED_PRIMARY_JUDGE_MODEL ?? 'z-ai/glm-5',
      metaVerifierModel: process.env.PLAITED_META_VERIFIER_MODEL ?? 'minimax/minimax-m2.5',
      attempts,
      parallel,
      baseRef,
      programs: programPaths,
    }),
  )
  await logger.write(`orchestration-start outputDir=${outputDir}`)
  await logger.write(`planner=${process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex'}`)
  await logger.write(
    `execution=${process.env.PLAITED_EXECUTION_PROVIDER ?? 'openrouter'}:${process.env.PLAITED_EXECUTION_MODEL ?? 'google/gemma-4-31b-it'}`,
  )
  await logger.write(`judge=${process.env.PLAITED_PRIMARY_JUDGE_MODEL ?? 'z-ai/glm-5'}`)
  await logger.write(`meta-verifier=${process.env.PLAITED_META_VERIFIER_MODEL ?? 'minimax/minimax-m2.5'}`)
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
      runInput: createPlannedRunInput({
        attempts,
        baseRef,
        parallel,
        programPath,
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
    const run = await callProgramRunner({
      attempts,
      baseRef,
      parallel,
      programPath,
      workspaceRoot,
    })
    await logger.write(`program-run-finished program=${programPath} runDir=${run.runDir}`)

    const judgePrompt = await buildJudgePrompt({
      programPath,
      run,
    })

    const judge = await callOpenRouterReview({
      logger,
      model: process.env.PLAITED_PRIMARY_JUDGE_MODEL ?? 'z-ai/glm-5',
      system:
        'You are a strict judge for autonomous factory-program attempts. Return JSON with keys decision and reasoning only.',
      prompt: [
        'Judge whether this program-runner result should be promoted, deferred, or rejected.',
        'Prefer defer when validation passed but the evidence is still incomplete.',
        judgePrompt,
      ].join('\n\n'),
    })
    await logger.write(`judge-finished program=${programPath} decision=${judge.decision}`)

    const metaVerifier = await callOpenRouterReview({
      logger,
      model: process.env.PLAITED_META_VERIFIER_MODEL ?? 'minimax/minimax-m2.5',
      system: 'You verify a prior judge result. Return JSON with keys decision and reasoning only.',
      prompt: JSON.stringify(
        {
          judge,
          run,
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
