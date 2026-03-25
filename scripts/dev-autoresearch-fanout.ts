#!/usr/bin/env bun

import { basename, join, resolve } from 'node:path'

type CliInput = {
  slicePath: string
  adapterPath: string
  judge: boolean
  judgePath: string
  metaVerifierPath: string
  concurrency: number
  attempts: number
  outputDir: string
  strategiesFile?: string
  commit: boolean
  push: boolean
  quiet: boolean
  dryRun: boolean
}

type AttemptStatus = {
  attempt: number
  strategyNote: string
  startedAt?: string
  finishedAt?: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  exitCode?: number
  resultJsonPath: string
  stdoutPath: string
  stderrPath: string
}

const BOOLEAN_FLAGS = new Set(['--judge', '--commit', '--push', '--quiet', '--dry-run'])

const getPositionalArgs = (args: string[]): string[] => {
  const positional: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) continue
    if (arg.startsWith('--')) {
      if (!BOOLEAN_FLAGS.has(arg)) index += 1
      continue
    }
    positional.push(arg)
  }
  return positional
}

const getArg = (args: string[], flag: string, fallback?: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag)

export const parseInput = (args: string[]): CliInput => {
  const [slicePath] = getPositionalArgs(args)
  if (!slicePath) {
    throw new Error('Usage: bun scripts/dev-autoresearch-fanout.ts <slice-path> [options]')
  }

  const attempts = Number(getArg(args, '--attempts', '5'))
  const concurrency = Number(getArg(args, '--concurrency', '5'))
  if (!Number.isFinite(attempts) || attempts <= 0) {
    throw new Error(`Invalid --attempts value: ${attempts}`)
  }
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error(`Invalid --concurrency value: ${concurrency}`)
  }

  return {
    slicePath,
    adapterPath: getArg(args, '--adapter', './scripts/codex-cli-adapter.ts')!,
    judge: hasFlag(args, '--judge'),
    judgePath: getArg(args, '--judge-path', './scripts/repo-improvement-judge.ts')!,
    metaVerifierPath: getArg(args, '--meta-verifier-path', './scripts/repo-improvement-meta-verifier.ts')!,
    concurrency,
    attempts,
    outputDir: getArg(args, '--output-dir', join('tmp', `${basename(slicePath, '.md')}-fanout`))!,
    strategiesFile: getArg(args, '--strategies-file'),
    commit: hasFlag(args, '--commit'),
    push: hasFlag(args, '--push'),
    quiet: hasFlag(args, '--quiet'),
    dryRun: hasFlag(args, '--dry-run'),
  }
}

const loadStrategies = async ({ attempts, path }: { attempts: number; path?: string }): Promise<string[]> => {
  if (!path) {
    return Array.from({ length: attempts }, (_, index) => `Attempt ${index + 1}: default slice strategy.`)
  }

  const text = await Bun.file(path).text()
  const strategies = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  if (strategies.length < attempts) {
    throw new Error(`Strategies file ${path} only provided ${strategies.length} entries for ${attempts} attempts`)
  }

  return strategies.slice(0, attempts)
}

const writeStatus = async ({ path, status }: { path: string; status: AttemptStatus }) => {
  await Bun.write(path, `${JSON.stringify(status, null, 2)}\n`)
}

const createAttemptCommand = ({
  input,
  strategyNote,
  resultJsonPath,
}: {
  input: CliInput
  strategyNote: string
  resultJsonPath: string
}): string[] => {
  const command = [
    'bun',
    '--no-env-file',
    'scripts/dev-autoresearch.ts',
    input.slicePath,
    '--adapter',
    input.adapterPath,
    '--max-attempts',
    '1',
    '--result-json',
    resultJsonPath,
    '--strategy-note',
    strategyNote,
    '--judge-path',
    input.judgePath,
    '--meta-verifier-path',
    input.metaVerifierPath,
  ]

  if (input.judge) command.push('--judge')
  if (input.commit) command.push('--commit')
  if (input.push) command.push('--push')
  if (input.quiet) command.push('--quiet')

  return command
}

const runAttempt = async ({
  input,
  attempt,
  strategyNote,
  outputDir,
}: {
  input: CliInput
  attempt: number
  strategyNote: string
  outputDir: string
}) => {
  const attemptDir = join(outputDir, `attempt-${String(attempt).padStart(2, '0')}`)
  await Bun.$`mkdir -p ${attemptDir}`.quiet()

  const stdoutPath = join(attemptDir, 'stdout.log')
  const stderrPath = join(attemptDir, 'stderr.log')
  const resultJsonPath = join(attemptDir, 'result.json')
  const statusPath = join(attemptDir, 'status.json')
  const startedAt = new Date().toISOString()

  await writeStatus({
    path: statusPath,
    status: {
      attempt,
      strategyNote,
      startedAt,
      status: 'running',
      resultJsonPath,
      stdoutPath,
      stderrPath,
    },
  })

  const command = createAttemptCommand({ input, strategyNote, resultJsonPath })
  const proc = Bun.spawn(command, {
    cwd: resolve('.'),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  await Bun.write(stdoutPath, stdout)
  await Bun.write(stderrPath, stderr)

  await writeStatus({
    path: statusPath,
    status: {
      attempt,
      strategyNote,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: exitCode === 0 ? 'succeeded' : 'failed',
      exitCode,
      resultJsonPath,
      stdoutPath,
      stderrPath,
    },
  })

  return { attempt, exitCode, attemptDir, resultJsonPath, stdoutPath, stderrPath }
}

const runPool = async ({ concurrency, work }: { concurrency: number; work: Array<() => Promise<void>> }) => {
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, work.length) }, async () => {
    while (index < work.length) {
      const current = index
      index += 1
      await work[current]!()
    }
  })
  await Promise.all(workers)
}

const main = async () => {
  const input = parseInput(process.argv.slice(2))
  const outputDir = resolve(input.outputDir)
  const strategies = await loadStrategies({ attempts: input.attempts, path: input.strategiesFile })

  if (input.dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: 'dev-autoresearch-fanout',
          slicePath: input.slicePath,
          attempts: input.attempts,
          concurrency: input.concurrency,
          outputDir,
          strategiesPreview: strategies.slice(0, 5),
        },
        null,
        2,
      ),
    )
    return
  }

  await Bun.$`mkdir -p ${outputDir}`.quiet()
  await Bun.write(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify(
      {
        mode: 'dev-autoresearch-fanout',
        startedAt: new Date().toISOString(),
        slicePath: input.slicePath,
        adapterPath: input.adapterPath,
        judge: input.judge,
        attempts: input.attempts,
        concurrency: input.concurrency,
        strategiesFile: input.strategiesFile ?? null,
        strategies,
      },
      null,
      2,
    )}\n`,
  )

  const work = strategies.map((strategyNote, index) => async () => {
    const attempt = index + 1
    console.log(`attempt:start ${attempt}/${input.attempts}`)
    await runAttempt({ input, attempt, strategyNote, outputDir })
    console.log(`attempt:done ${attempt}/${input.attempts}`)
  })

  await runPool({ concurrency: input.concurrency, work })
  console.log(`fanout:done attempts=${input.attempts} output=${outputDir}`)
}

if (import.meta.main) {
  await main()
}
