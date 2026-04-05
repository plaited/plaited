#!/usr/bin/env bun

import { basename, dirname, relative, resolve } from 'node:path'

type WorkerArgs = {
  artifactDir: string
  programPath: string
}

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

const buildPiArgs = ({
  model,
  programPath,
  prompt,
  provider,
  thinking,
}: {
  model: string
  programPath: string
  prompt: string
  provider: string
  thinking: string
}): string[] => {
  return [
    'bunx',
    'pi',
    '--provider',
    provider,
    '--model',
    model,
    '--thinking',
    thinking,
    '--tools',
    'read,bash,edit,write,grep,find,ls',
    `@AGENTS.md`,
    `@${programPath}`,
    '-p',
    prompt,
  ]
}

const runCommand = async ({
  args,
  cwd,
}: {
  args: string[]
  cwd: string
}): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}> => {
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

const main = async () => {
  const { artifactDir, programPath } = parseArgs(Bun.argv)
  const resolvedProgramPath = resolve(programPath)
  const cwd = process.cwd()
  const prompt = buildPiWorkerPrompt({
    planner: process.env.PLAITED_AUTORESEARCH_PLANNER ?? 'codex',
    programPath: relative(cwd, resolvedProgramPath) || resolvedProgramPath,
  })

  const provider = process.env.PLAITED_EXECUTION_PROVIDER ?? 'openrouter'
  const primaryModel = process.env.PLAITED_EXECUTION_MODEL ?? 'qwen/qwen3.6-plus-preview'
  const fallbackModel = process.env.PLAITED_EXECUTION_FALLBACK_MODEL
  const thinking = process.env.PLAITED_EXECUTION_THINKING ?? 'high'

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

  const primaryResult = await runCommand({
    args: buildPiArgs({
      model: primaryModel,
      programPath: resolvedProgramPath,
      prompt,
      provider,
      thinking,
    }),
    cwd,
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

  const fallbackResult = await runCommand({
    args: buildPiArgs({
      model: fallbackModel,
      programPath: resolvedProgramPath,
      prompt,
      provider,
      thinking,
    }),
    cwd,
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
