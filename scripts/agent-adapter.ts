#!/usr/bin/env bun

import { join, resolve } from 'node:path'
import {
  acceptAutoresearchLane,
  evaluateAutoresearchLane,
  loadAutoresearchLaneStatus,
  revertAutoresearchLane,
} from '../src/cli/autoresearch/autoresearch.ts'
import type {
  AutoresearchEvaluateOutput,
  AutoresearchExperiment,
  AutoresearchLaneState,
} from '../src/cli/autoresearch/autoresearch.types.ts'

type AgentAdapterArgs = {
  laneDir: string
  programPath: string
  worktree: string
  maxConsecutiveRejects: number
  maxIterations: number
  minScoreDelta: number
  agentCommand: string[]
}

type AgentAdapterDecision = {
  accept: boolean
  reason: string
}

type AgentAdapterResult = {
  acceptedIterations: number[]
  laneDir: string
  programPath: string
  rejectedIterations: number[]
  stopReason: string
  worktree: string
}

const AGENT_ADAPTER_DIR = 'agent-adapter'

const toJson = (value: unknown): string => JSON.stringify(value, null, 2)

const getIterationArtifactDir = ({ iteration, laneDir }: { iteration: number; laneDir: string }): string =>
  join(laneDir, AGENT_ADAPTER_DIR, `iteration-${String(iteration).padStart(3, '0')}`)

const parseIntegerFlag = ({ name, value }: { name: string; value: string | undefined }): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${String(value)}`)
  }

  return parsed
}

const parseNumberFlag = ({ name, value }: { name: string; value: string | undefined }): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${String(value)}`)
  }

  return parsed
}

export const parseAgentAdapterArgs = (argv: string[]): AgentAdapterArgs => {
  const args = argv.slice(2)
  const separatorIndex = args.indexOf('--')
  const optionArgs = separatorIndex >= 0 ? args.slice(0, separatorIndex) : args
  const agentCommand = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : []

  if (optionArgs.length < 3) {
    throw new Error(
      'Usage: bun scripts/agent-adapter.ts <lane_dir> <program_path> <worktree> [options] -- <agent_command...>',
    )
  }

  const laneDir = optionArgs[0]
  const programPath = optionArgs[1]
  const worktree = optionArgs[2]
  const rest = optionArgs.slice(3)

  const parsedArgs: AgentAdapterArgs = {
    laneDir: laneDir!,
    programPath: programPath!,
    worktree: worktree!,
    maxConsecutiveRejects: 3,
    maxIterations: 10,
    minScoreDelta: 0,
    agentCommand,
  }

  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index]

    if (option === '--max-iterations') {
      parsedArgs.maxIterations = parseIntegerFlag({
        name: option,
        value: rest[index + 1],
      })
      index += 1
      continue
    }

    if (option === '--max-consecutive-rejects') {
      parsedArgs.maxConsecutiveRejects = parseIntegerFlag({
        name: option,
        value: rest[index + 1],
      })
      index += 1
      continue
    }

    if (option === '--min-score-delta') {
      parsedArgs.minScoreDelta = parseNumberFlag({
        name: option,
        value: rest[index + 1],
      })
      index += 1
      continue
    }

    throw new Error(`Unknown agent-adapter option: ${option}`)
  }

  if (parsedArgs.agentCommand.length === 0) {
    throw new Error('Missing agent command. Pass it after `--`.')
  }

  return parsedArgs
}

const getAcceptedExperiment = (laneState: AutoresearchLaneState): AutoresearchExperiment | undefined =>
  laneState.lastAcceptedIteration === undefined
    ? undefined
    : laneState.experiments.find((experiment) => experiment.iteration === laneState.lastAcceptedIteration)

export const shouldAcceptAutoresearchEvaluation = ({
  evaluation,
  laneState,
  minScoreDelta,
}: {
  evaluation: AutoresearchEvaluateOutput
  laneState: AutoresearchLaneState
  minScoreDelta: number
}): AgentAdapterDecision => {
  if (evaluation.changedPaths.length === 0) {
    return {
      accept: false,
      reason: 'candidate made no writable-root changes',
    }
  }

  if (!evaluation.pass) {
    return {
      accept: false,
      reason: 'evaluation did not pass',
    }
  }

  const acceptedExperiment = getAcceptedExperiment(laneState)
  if (!acceptedExperiment) {
    return {
      accept: true,
      reason: 'accepted first passing candidate with writable-root changes',
    }
  }

  if (evaluation.score === undefined || acceptedExperiment.score === undefined) {
    return {
      accept: false,
      reason: 'missing comparable score against accepted baseline',
    }
  }

  if (evaluation.score >= acceptedExperiment.score + minScoreDelta) {
    return {
      accept: true,
      reason: `score improved from ${acceptedExperiment.score} to ${evaluation.score}`,
    }
  }

  return {
    accept: false,
    reason: `score ${evaluation.score} did not beat accepted baseline ${acceptedExperiment.score}`,
  }
}

export const substituteAgentCommand = ({
  command,
  iteration,
  laneDir,
  programPath,
  promptFile,
  targetId,
  worktree,
}: {
  command: string[]
  iteration: number
  laneDir: string
  programPath: string
  promptFile: string
  targetId: string
  worktree: string
}): string[] =>
  command.map((segment) =>
    segment
      .replaceAll('{{iteration}}', String(iteration))
      .replaceAll('{{lane_dir}}', laneDir)
      .replaceAll('{{program}}', programPath)
      .replaceAll('{{prompt_file}}', promptFile)
      .replaceAll('{{target_id}}', targetId)
      .replaceAll('{{worktree}}', worktree),
  )

const summarizeRecentExperiments = (experiments: AutoresearchExperiment[]): string => {
  const recentExperiments = experiments.slice(-3)
  if (recentExperiments.length === 0) {
    return 'No prior experiments.'
  }

  return recentExperiments
    .map(
      (experiment) =>
        `- iteration ${experiment.iteration}: pass=${String(experiment.pass)} score=${experiment.score ?? 'n/a'} summary=${experiment.summary}`,
    )
    .join('\n')
}

export const buildAgentStepPrompt = ({
  iteration,
  laneState,
  programMarkdown,
}: {
  iteration: number
  laneState: AutoresearchLaneState
  programMarkdown: string
}): string =>
  [
    '# Autoresearch Lane',
    '',
    `You are executing one bounded autoresearch step for target \`${laneState.target.id}\`.`,
    '',
    'Constraints:',
    `- Only edit files under: ${(laneState.target.writableRoots ?? []).join(', ') || '(no writable roots declared)'}`,
    '- Make one coherent candidate change, then stop.',
    '- Do not call `plaited autoresearch accept` or `plaited autoresearch revert`; the adapter will decide that.',
    '- Prefer narrow validation for the changed surface before you exit.',
    '',
    'Lane state:',
    `- Iteration: ${iteration}`,
    `- Last accepted iteration: ${laneState.lastAcceptedIteration ?? 'none'}`,
    `- Target path: ${laneState.target.path ?? 'not specified'}`,
    '',
    'Recent experiments:',
    summarizeRecentExperiments(laneState.experiments),
    '',
    'Lane program:',
    programMarkdown.trim(),
    '',
  ].join('\n')

const runCommand = async ({
  args,
  cwd,
}: {
  args: string[]
  cwd: string
}): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
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

export const runAgentAdapter = async (args: AgentAdapterArgs): Promise<AgentAdapterResult> => {
  const acceptedIterations: number[] = []
  const rejectedIterations: number[] = []
  let consecutiveRejects = 0

  process.chdir(args.worktree)
  await Bun.$`mkdir -p ${join(args.laneDir, AGENT_ADAPTER_DIR)}`.quiet()

  for (let iterationCount = 0; iterationCount < args.maxIterations; iterationCount += 1) {
    const laneState = await loadAutoresearchLaneStatus({
      laneDir: args.laneDir,
    })
    const iteration = laneState.experiments.length + 1
    const artifactDir = getIterationArtifactDir({
      iteration,
      laneDir: args.laneDir,
    })
    await Bun.$`mkdir -p ${artifactDir}`.quiet()

    const programFile = Bun.file(resolve(args.worktree, args.programPath))
    const programMarkdown = await programFile.text()
    const prompt = buildAgentStepPrompt({
      iteration,
      laneState,
      programMarkdown,
    })
    const promptFile = join(artifactDir, 'prompt.md')

    await Bun.write(join(artifactDir, 'status.before.json'), toJson(laneState))
    await Bun.write(promptFile, prompt)

    const command = substituteAgentCommand({
      command: args.agentCommand,
      iteration,
      laneDir: args.laneDir,
      programPath: args.programPath,
      promptFile,
      targetId: laneState.target.id,
      worktree: args.worktree,
    })
    const agentResult = await runCommand({
      args: command,
      cwd: args.worktree,
    })

    await Bun.write(join(artifactDir, 'agent.stdout.log'), agentResult.stdout)
    await Bun.write(join(artifactDir, 'agent.stderr.log'), agentResult.stderr)

    if (agentResult.exitCode !== 0) {
      throw new Error(
        agentResult.stderr.trim() ||
          agentResult.stdout.trim() ||
          `Agent step failed with exit code ${agentResult.exitCode}`,
      )
    }

    const evaluation = await evaluateAutoresearchLane({
      laneDir: args.laneDir,
    })
    const decision = shouldAcceptAutoresearchEvaluation({
      evaluation,
      laneState,
      minScoreDelta: args.minScoreDelta,
    })

    await Bun.write(join(artifactDir, 'evaluation.json'), toJson(evaluation))
    await Bun.write(join(artifactDir, 'decision.json'), toJson(decision))

    if (decision.accept) {
      await acceptAutoresearchLane({
        laneDir: args.laneDir,
      })
      acceptedIterations.push(iteration)
      consecutiveRejects = 0
    } else {
      await revertAutoresearchLane({
        laneDir: args.laneDir,
      })
      rejectedIterations.push(iteration)
      consecutiveRejects += 1
    }

    const laneStatus = await loadAutoresearchLaneStatus({
      laneDir: args.laneDir,
    })
    await Bun.write(join(artifactDir, 'status.after.json'), toJson(laneStatus))

    if (consecutiveRejects >= args.maxConsecutiveRejects) {
      return {
        acceptedIterations,
        laneDir: args.laneDir,
        programPath: args.programPath,
        rejectedIterations,
        stopReason: `hit consecutive reject limit (${args.maxConsecutiveRejects})`,
        worktree: args.worktree,
      }
    }
  }

  return {
    acceptedIterations,
    laneDir: args.laneDir,
    programPath: args.programPath,
    rejectedIterations,
    stopReason: `hit max iterations (${args.maxIterations})`,
    worktree: args.worktree,
  }
}

const main = async () => {
  const args = parseAgentAdapterArgs(Bun.argv)
  const result = await runAgentAdapter(args)
  await Bun.write(join(args.laneDir, AGENT_ADAPTER_DIR, 'session.json'), toJson(result))
  console.log(toJson(result))
}

if (import.meta.main) {
  await main()
}
