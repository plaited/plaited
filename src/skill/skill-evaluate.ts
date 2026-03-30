/**
 * Evaluate one skill's behavioral quality using the shared trial harness.
 *
 * @remarks
 * This stays separate from `validate-skill`, which only covers structural
 * AgentSkills compatibility. `evaluate-skill` runs trigger or output prompts
 * against an adapter, optionally compares against a baseline, and writes the
 * same run artifacts used elsewhere in the repo.
 *
 * @public
 */

import { realpath } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import * as z from 'zod'
import { parseCli } from '../cli.ts'
import {
  formatEvalSummary,
  loadAdapter,
  loadGrader,
  loadPrompts,
  runTrial,
  summarizeEvalResults,
  type TrialRunSummary,
} from '../improve.ts'
import { findSkillEvaluationSurface } from './skill.utils.ts'

type SkillEvaluationMode = 'trigger' | 'output'
type SkillEvaluationBaseline = 'none' | 'without-skill' | 'previous-skill'

type SkillEvaluationAggregateSummary = {
  generatedAt: string
  skillPath: string
  mode: SkillEvaluationMode
  baseline: SkillEvaluationBaseline
  promptsPath: string
  rubricPath?: string
  scenarios: Array<{
    label: string
    passRate?: number
    eligibleRate?: number
    averageScore?: number
    totalTrials: number
  }>
  delta?: {
    passRate?: number
    eligibleRate?: number
    averageScore?: number
  }
}

type SkillEvaluationRunArtifacts = {
  label: string
  cwd: string
  resultsPath: string
  summaryPath: string
  summaryJsonPath: string
  workspaceDir?: string
  worktreeDir?: string
  summary: TrialRunSummary
}

type SkillEvaluationOutput = {
  skillPath: string
  mode: SkillEvaluationMode
  baseline: SkillEvaluationBaseline
  promptsPath: string
  rubricPath?: string
  runDir: string
  benchmarkPath: string
  resultsMarkdownPath: string
  latestBenchmarkPath: string
  latestResultsPath: string
  latestRunPath: string
  commitSha?: string
  runs: SkillEvaluationRunArtifacts[]
}

const EvaluateSkillInputSchema = z.object({
  skillPath: z.string().describe('Path to the skill directory to evaluate'),
  mode: z
    .enum(['trigger', 'output'])
    .default('trigger')
    .describe('Which local eval surface to run: trigger prompts or output cases'),
  adapterPath: z.string().describe('Path to the adapter module or executable'),
  graderPath: z.string().optional().describe('Optional grader module or executable'),
  promptsPath: z.string().optional().describe('Optional prompt JSONL override'),
  baseline: z
    .enum(['none', 'without-skill', 'previous-skill'])
    .default('none')
    .describe('Optional baseline mode to compare against'),
  useWorktree: z.boolean().default(false).describe('Create isolated git worktrees for baseline or workspace isolation'),
  keepWorktrees: z.boolean().default(false).describe('Keep generated worktrees on disk after the run'),
  commit: z.boolean().default(true).describe('Commit the updated eval artifacts into git when possible'),
  commitMessage: z.string().optional().describe('Override the default git commit message'),
  workspaceDir: z.string().optional().describe('Base directory for per-trial workspace creation'),
  outputDir: z.string().optional().describe('Directory for run artifacts'),
  runId: z.string().optional().describe('Stable run id (defaults to timestamp)'),
  k: z.number().int().min(1).default(1).describe('Trials per prompt'),
  timeout: z.number().int().positive().optional().describe('Per-trial timeout in milliseconds'),
  concurrency: z.number().int().min(1).default(1).describe('Concurrent prompts within one run'),
  progress: z.boolean().default(false).describe('Emit progress to stderr'),
})

const TrialSummarySchema = z.record(z.string(), z.unknown())

const EvaluateSkillOutputSchema = z.object({
  skillPath: z.string(),
  mode: z.enum(['trigger', 'output']),
  baseline: z.enum(['none', 'without-skill', 'previous-skill']),
  promptsPath: z.string(),
  rubricPath: z.string().optional(),
  runDir: z.string(),
  benchmarkPath: z.string(),
  resultsMarkdownPath: z.string(),
  latestBenchmarkPath: z.string(),
  latestResultsPath: z.string(),
  latestRunPath: z.string(),
  commitSha: z.string().optional(),
  runs: z.array(
    z.object({
      label: z.string(),
      cwd: z.string(),
      resultsPath: z.string(),
      summaryPath: z.string(),
      summaryJsonPath: z.string(),
      workspaceDir: z.string().optional(),
      worktreeDir: z.string().optional(),
      summary: TrialSummarySchema,
    }),
  ),
})

export { EvaluateSkillInputSchema, EvaluateSkillOutputSchema }
export type { SkillEvaluationOutput, SkillEvaluationRunArtifacts }

const timestampRunId = (): string => new Date().toISOString().replace(/[:.]/g, '-')

const ensureDir = async (path: string): Promise<void> => {
  await Bun.$`mkdir -p ${path}`.quiet()
}

const resolvePathFromCwd = (path: string): string => resolve(process.cwd(), path)

const canonicalizePath = async (path: string): Promise<string> => {
  try {
    return await realpath(path)
  } catch {
    return path
  }
}

const resolvePromptsPath = async (
  skillPath: string,
  mode: SkillEvaluationMode,
  promptsPath?: string,
): Promise<{ promptsPath: string; rubricPath?: string }> => {
  if (promptsPath) {
    return { promptsPath: resolvePathFromCwd(promptsPath) }
  }

  const evaluation = await findSkillEvaluationSurface(skillPath)
  if (!evaluation) {
    throw new Error(`No evaluation surface found under ${skillPath}/evals`)
  }

  if (mode === 'trigger' && evaluation.triggerPrompts) {
    return { promptsPath: evaluation.triggerPrompts, rubricPath: evaluation.rubric }
  }

  if (mode === 'output' && evaluation.outputCases) {
    return { promptsPath: evaluation.outputCases, rubricPath: evaluation.rubric }
  }

  throw new Error(`Skill is missing ${mode === 'trigger' ? 'evals/trigger-prompts.jsonl' : 'evals/output-cases.jsonl'}`)
}

const getGitRoot = async (cwd: string): Promise<string> => {
  const result = await Bun.$`git -C ${cwd} rev-parse --show-toplevel`.quiet().nothrow()
  if (result.exitCode !== 0) {
    throw new Error(`Skill evaluation worktrees require a git repository: ${cwd}`)
  }

  return canonicalizePath(result.text().trim())
}

const findRepoRootForSkill = async (skillPath: string): Promise<string | undefined> => {
  const result = await Bun.$`git -C ${dirname(skillPath)} rev-parse --show-toplevel`.quiet().nothrow()
  if (result.exitCode !== 0) {
    return undefined
  }

  return canonicalizePath(result.text().trim())
}

const addDetachedWorktree = async ({
  repoRoot,
  worktreeDir,
}: {
  repoRoot: string
  worktreeDir: string
}): Promise<void> => {
  await Bun.$`git -C ${repoRoot} worktree add --detach ${worktreeDir}`.quiet()
}

const removeWorktree = async ({ repoRoot, worktreeDir }: { repoRoot: string; worktreeDir: string }): Promise<void> => {
  await Bun.$`git -C ${repoRoot} worktree remove --force ${worktreeDir}`.quiet().nothrow()
}

const resolvePathInWorktree = async ({
  repoRoot,
  worktreeDir,
  path,
}: {
  repoRoot: string
  worktreeDir: string
  path: string
}): Promise<string> => {
  const [canonicalRepoRoot, canonicalPath] = await Promise.all([canonicalizePath(repoRoot), canonicalizePath(path)])
  const relativePath = relative(canonicalRepoRoot, canonicalPath)
  if (relativePath.startsWith('..') || relativePath === '') {
    return path
  }

  return join(worktreeDir, relativePath)
}

const hideSkillInWorktree = async ({
  worktreeDir,
  repoRoot,
  skillPath,
}: {
  worktreeDir: string
  repoRoot: string
  skillPath: string
}): Promise<void> => {
  const [canonicalRepoRoot, canonicalSkillPath] = await Promise.all([
    canonicalizePath(repoRoot),
    canonicalizePath(skillPath),
  ])
  const relativeSkillPath = relative(canonicalRepoRoot, canonicalSkillPath)
  const worktreeSkillPath = join(worktreeDir, relativeSkillPath)
  const hiddenRoot = join(worktreeDir, '.skill-eval-hidden')
  const hiddenSkillPath = join(hiddenRoot, basename(skillPath))
  await ensureDir(hiddenRoot)
  await Bun.$`mv ${worktreeSkillPath} ${hiddenSkillPath}`.quiet()
}

const writeScenarioArtifacts = async ({
  scenarioDir,
  run,
}: {
  scenarioDir: string
  run: SkillEvaluationRunArtifacts
}): Promise<void> => {
  await Bun.write(run.summaryJsonPath, `${JSON.stringify(run.summary, null, 2)}\n`)
  await Bun.write(run.summaryPath, formatEvalSummary(run.summary))
  await Bun.write(
    join(scenarioDir, 'run.json'),
    `${JSON.stringify(
      {
        label: run.label,
        cwd: run.cwd,
        resultsPath: run.resultsPath,
        summaryPath: run.summaryPath,
        summaryJsonPath: run.summaryJsonPath,
        workspaceDir: run.workspaceDir,
        worktreeDir: run.worktreeDir,
      },
      null,
      2,
    )}\n`,
  )
}

const formatMetric = (value: number | undefined): string => (value === undefined ? 'n/a' : value.toFixed(3))

const getRelativeToRepo = async ({ repoRoot, path }: { repoRoot: string; path: string }): Promise<string> => {
  const [canonicalRepoRoot, canonicalPath] = await Promise.all([canonicalizePath(repoRoot), canonicalizePath(path)])
  return relative(canonicalRepoRoot, canonicalPath) || '.'
}

const stageAndCommitEvalArtifacts = async ({
  repoRoot,
  skillPath,
  runDir,
  latestBenchmarkPath,
  latestResultsPath,
  latestRunPath,
  commitMessage,
}: {
  repoRoot: string
  skillPath: string
  runDir: string
  latestBenchmarkPath: string
  latestResultsPath: string
  latestRunPath: string
  commitMessage?: string
}): Promise<string | undefined> => {
  const paths = [runDir, latestBenchmarkPath, latestResultsPath, latestRunPath]

  for (const path of paths) {
    const relativePath = await getRelativeToRepo({ repoRoot, path })
    await Bun.$`git -C ${repoRoot} add -- ${relativePath}`.quiet()
  }

  const staged = await Bun.$`git -C ${repoRoot} diff --cached --name-only`.quiet()
  if (!staged.text().trim()) {
    return undefined
  }

  const skillName = basename(skillPath)
  const finalMessage = commitMessage ?? `chore(skills): record eval for ${skillName}`
  const body = `Update eval artifacts for ${skillName}, including the latest summary pointer and the run-specific report under evals/runs/.`
  await Bun.$`git -C ${repoRoot} commit -m ${finalMessage} -m ${body}`.quiet()

  const head = await Bun.$`git -C ${repoRoot} rev-parse HEAD`.quiet()
  return head.text().trim()
}

const createAggregateSummary = ({
  skillPath,
  mode,
  baseline,
  promptsPath,
  rubricPath,
  runs,
}: {
  skillPath: string
  mode: SkillEvaluationMode
  baseline: SkillEvaluationBaseline
  promptsPath: string
  rubricPath?: string
  runs: SkillEvaluationRunArtifacts[]
}): SkillEvaluationAggregateSummary => {
  const scenarios = runs.map((run) => ({
    label: run.label,
    passRate: run.summary.passRate,
    eligibleRate: run.summary.eligibleRate,
    averageScore: run.summary.averageScore,
    totalTrials: run.summary.totalTrials,
  }))

  const withSkill = scenarios.find((scenario) => scenario.label === 'with-skill')
  const baselineScenario = scenarios.find((scenario) => scenario.label !== 'with-skill')

  return {
    generatedAt: new Date().toISOString(),
    skillPath,
    mode,
    baseline,
    promptsPath,
    ...(rubricPath && { rubricPath }),
    scenarios,
    ...(withSkill && baselineScenario
      ? {
          delta: {
            passRate:
              withSkill.passRate !== undefined && baselineScenario.passRate !== undefined
                ? Number((withSkill.passRate - baselineScenario.passRate).toFixed(3))
                : undefined,
            eligibleRate:
              withSkill.eligibleRate !== undefined && baselineScenario.eligibleRate !== undefined
                ? Number((withSkill.eligibleRate - baselineScenario.eligibleRate).toFixed(3))
                : undefined,
            averageScore:
              withSkill.averageScore !== undefined && baselineScenario.averageScore !== undefined
                ? Number((withSkill.averageScore - baselineScenario.averageScore).toFixed(3))
                : undefined,
          },
        }
      : {}),
  }
}

const formatRunDelta = (label: string, left: number | undefined, right: number | undefined): string | null => {
  if (left === undefined || right === undefined) {
    return null
  }

  const delta = Number((left - right).toFixed(3))
  const sign = delta > 0 ? '+' : ''
  return `- ${label}: ${sign}${delta.toFixed(3)}`
}

const formatPromptComparisons = (runs: SkillEvaluationRunArtifacts[]): string[] => {
  if (runs.length < 2) {
    return []
  }

  const withSkill = runs.find((run) => run.label === 'with-skill')
  const baseline = runs.find((run) => run.label !== 'with-skill')
  if (!withSkill || !baseline) {
    return []
  }

  const baselinePrompts = new Map(baseline.summary.prompts.map((prompt) => [prompt.id, prompt]))
  const lines: string[] = []

  for (const prompt of withSkill.summary.prompts) {
    const baselinePrompt = baselinePrompts.get(prompt.id)
    if (!baselinePrompt) {
      continue
    }

    const passDelta =
      prompt.passRate !== undefined && baselinePrompt.passRate !== undefined
        ? Number((prompt.passRate - baselinePrompt.passRate).toFixed(3))
        : undefined
    const scoreDelta =
      prompt.averageScore !== undefined && baselinePrompt.averageScore !== undefined
        ? Number((prompt.averageScore - baselinePrompt.averageScore).toFixed(3))
        : undefined
    const pieces = [
      `pass=${passDelta === undefined ? 'n/a' : `${passDelta > 0 ? '+' : ''}${passDelta.toFixed(3)}`}`,
      `score=${scoreDelta === undefined ? 'n/a' : `${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(3)}`}`,
    ]
    lines.push(`- ${prompt.id}: ${pieces.join(', ')}`)
  }

  return lines
}

const formatResultsMarkdown = ({
  aggregate,
  runs,
}: {
  aggregate: SkillEvaluationAggregateSummary
  runs: SkillEvaluationRunArtifacts[]
}): string => {
  const lines = [
    '# Skill Eval Results',
    '',
    `_Generated: ${aggregate.generatedAt}_`,
    '',
    `- Skill: ${aggregate.skillPath}`,
    `- Mode: ${aggregate.mode}`,
    `- Baseline: ${aggregate.baseline}`,
    `- Prompts: ${aggregate.promptsPath}`,
  ]

  if (aggregate.rubricPath) {
    lines.push(`- Rubric: ${aggregate.rubricPath}`)
  }

  lines.push(
    '',
    '## Scenario Summary',
    '',
    '| Scenario | Pass Rate | Eligible Rate | Avg Score | Trials |',
    '|---|---:|---:|---:|---:|',
  )

  for (const scenario of aggregate.scenarios) {
    lines.push(
      `| ${scenario.label} | ${formatMetric(scenario.passRate)} | ${formatMetric(scenario.eligibleRate)} | ${formatMetric(scenario.averageScore)} | ${scenario.totalTrials} |`,
    )
  }

  const withSkill = runs.find((run) => run.label === 'with-skill')
  const baseline = runs.find((run) => run.label !== 'with-skill')

  if (withSkill && baseline) {
    const deltaLines = [
      formatRunDelta('Pass rate delta', withSkill.summary.passRate, baseline.summary.passRate),
      formatRunDelta('Eligible rate delta', withSkill.summary.eligibleRate, baseline.summary.eligibleRate),
      formatRunDelta('Average score delta', withSkill.summary.averageScore, baseline.summary.averageScore),
    ].filter((line): line is string => line !== null)

    lines.push('', '## Scenario Delta', '')
    if (deltaLines.length === 0) {
      lines.push('- No comparable aggregate deltas available')
    } else {
      lines.push(...deltaLines)
    }

    const promptLines = formatPromptComparisons(runs)
    if (promptLines.length > 0) {
      lines.push('', '## Prompt Delta', '', ...promptLines)
    }

    lines.push(
      '',
      '## Human Review',
      '',
      '- Inspect the scenario summary first to decide whether the skill is buying measurable quality.',
      '- If aggregate deltas are small, read the prompt delta section to find which prompts actually moved.',
      '- Use the per-scenario `summary.md` and `results.jsonl` files when a prompt needs deeper inspection.',
    )
  }

  return `${lines.join('\n')}\n`
}

const createScenarioRun = async ({
  label,
  cwd,
  worktreeDir,
  sourceWorktreeDir,
  repoRoot,
  outputDir,
  workspaceDir,
  adapterPath,
  graderPath,
  promptsPath,
  k,
  timeout,
  concurrency,
  progress,
}: {
  label: string
  cwd: string
  worktreeDir?: string
  sourceWorktreeDir?: string
  repoRoot?: string
  outputDir: string
  workspaceDir?: string
  adapterPath: string
  graderPath?: string
  promptsPath: string
  k: number
  timeout?: number
  concurrency: number
  progress: boolean
}): Promise<SkillEvaluationRunArtifacts> => {
  const scenarioDir = join(outputDir, label)
  await ensureDir(scenarioDir)

  const pathResolutionWorktreeDir = sourceWorktreeDir ?? worktreeDir
  const [scenarioAdapterPath, scenarioGraderPath, scenarioPromptsPath] =
    pathResolutionWorktreeDir && repoRoot
      ? await Promise.all([
          resolvePathInWorktree({ repoRoot, worktreeDir: pathResolutionWorktreeDir, path: adapterPath }),
          graderPath
            ? resolvePathInWorktree({ repoRoot, worktreeDir: pathResolutionWorktreeDir, path: graderPath })
            : Promise.resolve(undefined),
          resolvePathInWorktree({ repoRoot, worktreeDir: pathResolutionWorktreeDir, path: promptsPath }),
        ])
      : [adapterPath, graderPath, promptsPath]

  const [adapter, grader, prompts] = await Promise.all([
    loadAdapter(scenarioAdapterPath),
    scenarioGraderPath ? loadGrader(scenarioGraderPath) : Promise.resolve(undefined),
    loadPrompts(scenarioPromptsPath),
  ])

  const resultsPath = join(scenarioDir, 'results.jsonl')
  const summaryPath = join(scenarioDir, 'summary.md')
  const summaryJsonPath = join(scenarioDir, 'summary.json')

  const results = await runTrial({
    adapter,
    prompts,
    grader,
    k,
    cwd,
    timeout,
    concurrency,
    workspaceDir,
    outputPath: resultsPath,
    progress,
  })

  const summary = summarizeEvalResults(results)
  const run: SkillEvaluationRunArtifacts = {
    label,
    cwd,
    resultsPath,
    summaryPath,
    summaryJsonPath,
    ...(workspaceDir && { workspaceDir }),
    ...(worktreeDir && { worktreeDir }),
    summary,
  }

  await writeScenarioArtifacts({ scenarioDir, run })
  return run
}

/**
 * Evaluate one skill against its local behavioral-evaluation surface.
 *
 * @public
 */
export const evaluateSkill = async (
  input: z.infer<typeof EvaluateSkillInputSchema>,
): Promise<SkillEvaluationOutput> => {
  const skillPath = await canonicalizePath(resolvePathFromCwd(input.skillPath))
  const adapterPath = resolvePathFromCwd(input.adapterPath)
  const graderPath = input.graderPath ? resolvePathFromCwd(input.graderPath) : undefined
  const { promptsPath, rubricPath } = await resolvePromptsPath(skillPath, input.mode, input.promptsPath)
  const repoRoot = await findRepoRootForSkill(skillPath)
  const scenarioRoot = repoRoot ?? dirname(skillPath)

  const runId = input.runId ?? timestampRunId()
  const runDir = input.outputDir ? resolvePathFromCwd(input.outputDir) : join(skillPath, 'evals', 'runs', runId)
  await ensureDir(runDir)
  const benchmarkPath = join(runDir, 'benchmark.json')
  const resultsMarkdownPath = join(runDir, 'RESULTS.md')
  const latestBenchmarkPath = join(skillPath, 'evals', 'benchmark.json')
  const latestResultsPath = join(skillPath, 'evals', 'RESULTS.md')
  const latestRunPath = join(skillPath, 'evals', 'latest-run.json')

  const runArtifacts: SkillEvaluationRunArtifacts[] = []
  const worktreesToCleanup: { repoRoot: string; worktreeDir: string }[] = []

  const defaultWorkspaceBase = input.workspaceDir ? resolvePathFromCwd(input.workspaceDir) : undefined
  const withSkillWorkspaceDir = defaultWorkspaceBase ? join(defaultWorkspaceBase, 'with-skill') : undefined

  try {
    runArtifacts.push(
      await createScenarioRun({
        label: 'with-skill',
        cwd: scenarioRoot,
        outputDir: runDir,
        workspaceDir: withSkillWorkspaceDir,
        adapterPath,
        graderPath,
        promptsPath,
        k: input.k,
        timeout: input.timeout,
        concurrency: input.concurrency,
        progress: input.progress,
      }),
    )

    if (input.baseline === 'previous-skill') {
      throw new Error('baseline=previous-skill is not implemented yet')
    }

    if (input.baseline === 'without-skill') {
      if (!input.useWorktree) {
        throw new Error('baseline=without-skill requires useWorktree=true')
      }

      const repoRoot = await getGitRoot(dirname(skillPath))
      const withSkillWorktreeDir = join(repoRoot, '.worktrees', `skill-eval-${basename(skillPath)}-${runId}-with-skill`)
      const withoutSkillWorktreeDir = join(
        repoRoot,
        '.worktrees',
        `skill-eval-${basename(skillPath)}-${runId}-without-skill`,
      )
      await ensureDir(join(repoRoot, '.worktrees'))
      await addDetachedWorktree({ repoRoot, worktreeDir: withSkillWorktreeDir })
      await addDetachedWorktree({ repoRoot, worktreeDir: withoutSkillWorktreeDir })
      worktreesToCleanup.push(
        { repoRoot, worktreeDir: withSkillWorktreeDir },
        { repoRoot, worktreeDir: withoutSkillWorktreeDir },
      )
      await hideSkillInWorktree({ worktreeDir: withoutSkillWorktreeDir, repoRoot, skillPath })

      runArtifacts[0] = await createScenarioRun({
        label: 'with-skill',
        cwd: withSkillWorktreeDir,
        worktreeDir: withSkillWorktreeDir,
        sourceWorktreeDir: withSkillWorktreeDir,
        repoRoot,
        outputDir: runDir,
        workspaceDir: withSkillWorkspaceDir,
        adapterPath,
        graderPath,
        promptsPath,
        k: input.k,
        timeout: input.timeout,
        concurrency: input.concurrency,
        progress: input.progress,
      })

      runArtifacts.push(
        await createScenarioRun({
          label: 'without-skill',
          cwd: withoutSkillWorktreeDir,
          worktreeDir: withoutSkillWorktreeDir,
          sourceWorktreeDir: withSkillWorktreeDir,
          repoRoot,
          outputDir: runDir,
          workspaceDir: defaultWorkspaceBase ? join(defaultWorkspaceBase, 'without-skill') : undefined,
          adapterPath,
          graderPath,
          promptsPath,
          k: input.k,
          timeout: input.timeout,
          concurrency: input.concurrency,
          progress: input.progress,
        }),
      )
    }

    const aggregate = createAggregateSummary({
      skillPath,
      mode: input.mode,
      baseline: input.baseline,
      promptsPath,
      rubricPath,
      runs: runArtifacts,
    })

    await Bun.write(benchmarkPath, `${JSON.stringify(aggregate, null, 2)}\n`)
    const resultsMarkdown = formatResultsMarkdown({ aggregate, runs: runArtifacts })
    await Bun.write(resultsMarkdownPath, resultsMarkdown)
    await Bun.write(latestBenchmarkPath, `${JSON.stringify(aggregate, null, 2)}\n`)
    await Bun.write(latestResultsPath, resultsMarkdown)

    const output: SkillEvaluationOutput = {
      skillPath,
      mode: input.mode,
      baseline: input.baseline,
      promptsPath,
      ...(rubricPath && { rubricPath }),
      runDir,
      benchmarkPath,
      resultsMarkdownPath,
      latestBenchmarkPath,
      latestResultsPath,
      latestRunPath,
      runs: runArtifacts,
    }

    await Bun.write(latestRunPath, `${JSON.stringify(output, null, 2)}\n`)
    const commitSha =
      input.commit && repoRoot
        ? await stageAndCommitEvalArtifacts({
            repoRoot,
            skillPath,
            runDir,
            latestBenchmarkPath,
            latestResultsPath,
            latestRunPath,
            commitMessage: input.commitMessage,
          })
        : undefined

    if (commitSha) {
      output.commitSha = commitSha
      await Bun.write(latestRunPath, `${JSON.stringify(output, null, 2)}\n`)
    }

    await Bun.write(join(runDir, 'run.json'), `${JSON.stringify(output, null, 2)}\n`)
    return output
  } finally {
    if (!input.keepWorktrees) {
      for (const worktree of worktreesToCleanup) {
        await removeWorktree(worktree)
      }
    }
  }
}

/**
 * CLI entry point for `plaited evaluate-skill`.
 *
 * @public
 */
export const evaluateSkillCli = async (args: string[]): Promise<void> => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI help output
    console.log(`plaited evaluate-skill

Evaluate one skill's trigger or output prompts through the shared trial harness.

Usage: plaited evaluate-skill '<json>' [options]
       echo '<json>' | plaited evaluate-skill

Input:
  skillPath     string   Path to the skill directory
  mode          string   "trigger" | "output" (default: "trigger")
  adapterPath   string   Path to adapter module/executable
  graderPath    string   Optional grader module/executable
  promptsPath   string   Optional prompt JSONL override
  baseline      string   "none" | "without-skill" | "previous-skill"
  useWorktree   boolean  Required for baseline "without-skill"
  keepWorktrees boolean  Preserve generated worktrees
  workspaceDir  string   Base directory for per-trial workspaces
  outputDir     string   Artifact output directory
  runId         string   Stable run id override
  k             number   Trials per prompt
  timeout       number   Per-trial timeout in ms
  concurrency   number   Concurrent prompts
  progress      boolean  Emit progress to stderr

Examples:
  plaited evaluate-skill '{"skillPath":"skills/generative-ui","mode":"trigger","adapterPath":"./scripts/codex-cli-adapter.ts","graderPath":"./scripts/gemini-judge.ts","k":2,"progress":true}'
  plaited evaluate-skill '{"skillPath":"skills/generative-ui","mode":"trigger","adapterPath":"./scripts/codex-cli-adapter.ts","baseline":"without-skill","useWorktree":true}'
  plaited evaluate-skill --schema input
  plaited evaluate-skill --schema output`)
    console.log(`
Notes:
  baseline="without-skill" snapshots both scenarios into detached worktrees.
  Repo-local adapter, grader, and prompt paths are resolved inside each worktree
  so Codex comparisons stay stable even if the current checkout is dirty.`)
    process.exit(0)
  }

  const input = await parseCli(args, EvaluateSkillInputSchema, {
    name: 'evaluate-skill',
    outputSchema: EvaluateSkillOutputSchema,
  })

  // biome-ignore lint/suspicious/noConsole: CLI JSON output
  console.log(JSON.stringify(await evaluateSkill(input), null, 2))
}
