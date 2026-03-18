#!/usr/bin/env bun

/**
 * Dev autoresearch harness for improving Plaited itself.
 *
 * @remarks
 * This is developer tooling. It is not a shipped runtime feature of Plaited.
 * The harness runs one bounded slice in an isolated worktree, validates the
 * result, and logs keep/revise/discard output via the improve-layer utilities.
 */

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadAdapter, loadGrader, logExperiment, type GraderResult } from '../src/improve.ts'

type CliInput = {
  adapterPath: string
  commit: boolean
  judge: boolean
  judgePath: string
  maxAttempts: number
  metaVerifierPath: string
  programPath: string
  slicePath: string
}

type SliceDecision = 'keep' | 'revise' | 'discard'

type ValidationResult = {
  passed: boolean
  notes: string
}

type JudgeBundle = {
  primary: GraderResult
  meta?: GraderResult
}

const PROJECT_ROOT = join(import.meta.dir, '..')

const getArg = (args: string[], flag: string, fallback?: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag)

const parseInput = (args: string[]): CliInput => {
  return {
    adapterPath: getArg(args, '--adapter', './scripts/codex-cli-adapter.ts')!,
    commit: hasFlag(args, '--commit'),
    judge: hasFlag(args, '--judge'),
    judgePath: getArg(args, '--judge-path', './scripts/claude-code-judge.ts')!,
    maxAttempts: Number(getArg(args, '--max-attempts', '1')),
    metaVerifierPath: getArg(args, '--meta-verifier-path', './scripts/gemini-meta-verifier.ts')!,
    programPath: getArg(args, '--program', './dev-research/program.md')!,
    slicePath: getArg(args, '--slice', './dev-research/runtime-taxonomy/slice-1.md')!,
  }
}

const requireMarkdown = async (path: string, headings: string[]): Promise<string> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw new Error(`Missing file: ${path}`)
  const text = await file.text()
  for (const heading of headings) {
    if (!text.includes(heading)) throw new Error(`Missing heading "${heading}" in ${path}`)
  }
  return text
}

const createWorktree = async (id: string): Promise<string> => {
  const safeId = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const base = (await Bun.$`mktemp -d ${join(tmpdir(), `plaited-dev-${safeId}-XXXXXX`)}`.quiet()).text().trim()
  const target = join(base, 'repo')
  const add = await Bun.$`git worktree add --detach ${target} HEAD`.cwd(PROJECT_ROOT).nothrow().quiet()
  if (add.exitCode !== 0) {
    throw new Error(`git worktree add failed: ${add.stderr.toString().trim()}`)
  }
  return target
}

const removeWorktree = async (worktree: string) => {
  await Bun.$`git worktree remove --force ${worktree}`.cwd(PROJECT_ROOT).nothrow().quiet()
}

const commitWorktreeExperiment = async (cwd: string, description: string): Promise<string> => {
  await Bun.$`git add -A`.cwd(cwd).quiet()
  await Bun.$`git commit -m ${{ raw: `experiment: ${description}` }}`.cwd(cwd).quiet()
  return (await Bun.$`git rev-parse --short HEAD`.cwd(cwd).quiet()).text().trim()
}

const runCheck = async (cwd: string, command: string[]): Promise<ValidationResult> => {
  const result = await Bun.spawn(command, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
    result.exited,
  ])

  if (exitCode !== 0) {
    return {
      passed: false,
      notes: `${stdout}${stderr}`.trim().slice(0, 1000) || `Command failed: ${command.join(' ')}`,
    }
  }

  return { passed: true, notes: 'ok' }
}

const getChangedFiles = async (cwd: string): Promise<string[]> => {
  const result = await Bun.$`git diff --name-only`.cwd(cwd).quiet()
  return result
    .text()
    .trim()
    .split('\n')
    .filter(Boolean)
}

const getDiffStat = async (cwd: string): Promise<string> => {
  return (await Bun.$`git diff --stat`.cwd(cwd).quiet()).text().trim()
}

const getPatch = async (cwd: string): Promise<string> => {
  return (await Bun.$`git diff --no-ext-diff`.cwd(cwd).quiet()).text().trim()
}

const buildPrompt = (program: string, slice: string) => {
  return [
    'Execution mode:',
    '- Use an autoresearch-style workflow for this bounded development slice.',
    '- The architecture is already decided by the program and slice files below.',
    '- Make one bounded attempt, run validation, and state whether the result should be kept or revised.',
    '',
    'Program:',
    program,
    '',
    'Slice:',
    slice,
  ].join('\n')
}

const buildChecks = (typecheck: ValidationResult, tests: ValidationResult) => ({
  typecheck: {
    passed: typecheck.passed,
    notes: typecheck.notes,
  },
  tests: {
    passed: tests.passed,
    notes: tests.notes,
  },
})

const runJudges = async ({
  enabled,
  judgePath,
  metaVerifierPath,
  task,
  candidateOutput,
  program,
  slice,
  changedFiles,
  diffStat,
  patch,
  checks,
}: {
  enabled: boolean
  judgePath: string
  metaVerifierPath: string
  task: string
  candidateOutput: string
  program: string
  slice: string
  changedFiles: string[]
  diffStat: string
  patch: string
  checks: ReturnType<typeof buildChecks>
}): Promise<JudgeBundle | undefined> => {
  if (!enabled) return undefined

  const judge = await loadGrader(judgePath)
  const metadata = {
    changedFiles,
    diffStat,
    patch,
    checks,
    program,
    slice,
  }

  const primary = await judge({
    input: task,
    output: candidateOutput,
    metadata,
  })

  const metaVerifier = await loadGrader(metaVerifierPath)
  const meta = await metaVerifier({
    input: task,
    output: JSON.stringify(primary, null, 2),
    metadata: {
      ...metadata,
      candidateOutput,
    },
  })

  return { primary, meta }
}

const main = async () => {
  const input = parseInput(process.argv.slice(2))

  const program = await requireMarkdown(input.programPath, [
    '## Mission',
    '## Fixed Architecture',
    '## Runtime Taxonomy',
    '## Validation',
  ])
  const slice = await requireMarkdown(input.slicePath, ['# Slice', '## Target', '## Acceptance Criteria'])
  const prompt = buildPrompt(program, slice)
  const adapter = await loadAdapter(input.adapterPath)
  const sliceId = input.slicePath.split('/').at(-1)?.replace('.md', '') ?? 'slice'

  console.log(`mode=repo-harness adapter=${input.adapterPath} slice=${sliceId} judge=${input.judge}`)

  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    const worktree = await createWorktree(`${sliceId}-${attempt}`)

    try {
      const result = await adapter({ prompt, cwd: worktree })
      const changedFiles = await getChangedFiles(worktree)
      const diffStat = await getDiffStat(worktree)
      const patch = await getPatch(worktree)
      const typecheck = await runCheck(worktree, ['bun', '--bun', 'tsc', '--noEmit'])
      const tests = await runCheck(worktree, ['bun', 'test', 'src/', 'skills/', 'scripts/'])
      const checks = buildChecks(typecheck, tests)
      const judges = await runJudges({
        enabled: input.judge,
        judgePath: input.judgePath,
        metaVerifierPath: input.metaVerifierPath,
        task: slice,
        candidateOutput: result.output,
        program,
        slice,
        changedFiles,
        diffStat,
        patch,
        checks,
      })

      const judgePassed = judges ? judges.primary.pass && (judges.meta?.pass ?? true) : true
      const passed = changedFiles.length > 0 && typecheck.passed && tests.passed && judgePassed
      const decision: SliceDecision =
        passed ? 'keep' : changedFiles.length > 0 ? 'revise' : 'discard'

      let commit = ''
      if (passed && input.commit) {
        commit = await commitWorktreeExperiment(worktree, `dev-autoresearch ${sliceId} attempt ${attempt}`)
      }

      await logExperiment({
        commit,
        description: `dev-autoresearch ${sliceId} attempt ${attempt}`,
        scores: {
          changed_files: changedFiles.length,
          typecheck: typecheck.passed ? 1 : 0,
          tests: tests.passed ? 1 : 0,
        },
        status: decision === 'keep' ? 'keep' : decision === 'discard' ? 'crash' : 'discard',
        timestamp: new Date().toISOString(),
        prompts: [sliceId],
        metadata: {
          adapterPath: input.adapterPath,
          decision,
          diffStat,
          patch: patch.slice(0, 12000),
          output: result.output,
          changedFiles,
          checks,
          judge: judges?.primary,
          metaVerification: judges?.meta,
        },
      })

      console.log(`attempt=${attempt} decision=${decision}`)
      console.log(`changed=${changedFiles.length} diff="${diffStat || 'no diff'}"`)
      if (judges) {
        console.log(`judge=${judges.primary.pass ? 'pass' : 'fail'} score=${judges.primary.score.toFixed(2)}`)
        if (judges.meta) {
          console.log(`meta=${judges.meta.pass ? 'pass' : 'fail'} score=${judges.meta.score.toFixed(2)}`)
        }
      }

      if (decision === 'keep') {
        console.log(commit ? `commit=${commit}` : 'commit=skipped')
        return
      }
    } finally {
      await removeWorktree(worktree)
    }
  }

  process.exit(1)
}

await main()
