import { isAbsolute, resolve } from 'node:path'
import type * as z from 'zod'

import { FrontierSnapshotSchema, type SnapshotMessage, type Spec, SpecSchema } from '../behavioral.ts'
import { makeCli } from '../cli/cli.ts'
import {
  BEHAVIORAL_FRONTIER_MODES,
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
} from './behavioral-frontier.constants.ts'
import {
  type BehavioralFrontierInput,
  BehavioralFrontierInputSchema,
  type BehavioralFrontierOutput,
  BehavioralFrontierOutputSchema,
} from './behavioral-frontier.schemas.ts'
import { exploreFrontiers } from './explore-frontiers.ts'
import { replayToFrontier } from './replay-to-frontier.ts'
import { verifyFrontiers } from './verify-frontiers.ts'

const countSelectionSnapshots = ({ snapshotMessages }: { snapshotMessages: SnapshotMessage[] }) =>
  snapshotMessages.reduce((count, snapshot) => count + (snapshot.kind === 'selection' ? 1 : 0), 0)

const createFrontierSnapshot = ({
  frontier,
  step,
}: {
  frontier: ReturnType<typeof replayToFrontier>['frontier']
  step: number
}) =>
  FrontierSnapshotSchema.parse({
    kind: 'frontier',
    step,
    status: frontier.status,
    candidates: frontier.candidates.map((candidate) => ({
      priority: candidate.priority,
      type: candidate.type,
      ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
      ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
    })),
    enabled: frontier.enabled.map((candidate) => ({
      priority: candidate.priority,
      type: candidate.type,
      ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
      ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
    })),
  })

const toAbsolutePath = ({ cwd, path }: { cwd?: string; path: string }) =>
  isAbsolute(path) ? path : resolve(cwd ? resolve(cwd) : process.cwd(), path)

const formatIssues = (issues: z.core.$ZodIssue[]) =>
  issues.map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`).join('; ')

const loadSpecsFromJsonl = async ({ cwd, specPath }: { cwd?: string; specPath: string }) => {
  const resolvedPath = toAbsolutePath({ cwd, path: specPath })
  const file = Bun.file(resolvedPath)

  if (!(await file.exists())) {
    throw new Error(`Spec file does not exist: ${resolvedPath}`)
  }

  const raw = await file.text()
  const specs: Spec[] = []

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(trimmed)
    } catch {
      throw new Error(`Invalid JSON on specPath line ${index + 1}: ${resolvedPath}`)
    }

    const parsedSpec = SpecSchema.safeParse(parsedJson)
    if (!parsedSpec.success) {
      throw new Error(`Invalid spec at ${resolvedPath}:${index + 1}: ${formatIssues(parsedSpec.error.issues)}`)
    }

    specs.push(parsedSpec.data)
  }

  return specs
}

const loadSpecs = async (input: BehavioralFrontierInput) =>
  'specs' in input ? input.specs : loadSpecsFromJsonl({ cwd: input.cwd, specPath: input.specPath })

const runReplay = async (
  input: Extract<BehavioralFrontierInput, { mode: 'replay' }>,
): Promise<BehavioralFrontierOutput> => {
  const specs = await loadSpecs(input)
  const snapshotMessages = input.snapshotMessages ?? []
  const { frontier } = replayToFrontier({
    specs,
    snapshotMessages,
  })

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.replay,
    snapshotMessages,
    frontier: createFrontierSnapshot({
      frontier,
      step: countSelectionSnapshots({ snapshotMessages }),
    }),
  }
}

const runExplore = async (
  input: Extract<BehavioralFrontierInput, { mode: 'explore' }>,
): Promise<BehavioralFrontierOutput> => {
  const specs = await loadSpecs(input)

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.explore,
    ...exploreFrontiers({
      specs,
      snapshotMessages: input.snapshotMessages,
      triggers: input.triggers,
      strategy: input.strategy,
      selectionPolicy: input.selectionPolicy,
      maxDepth: input.maxDepth,
    }),
  }
}

const runVerify = async (
  input: Extract<BehavioralFrontierInput, { mode: 'verify' }>,
): Promise<BehavioralFrontierOutput> => {
  const specs = await loadSpecs(input)

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.verify,
    ...verifyFrontiers({
      specs,
      snapshotMessages: input.snapshotMessages,
      triggers: input.triggers,
      strategy: input.strategy,
      selectionPolicy: input.selectionPolicy,
      maxDepth: input.maxDepth,
    }),
  }
}

export const runBehavioralFrontier = async (args: unknown): Promise<BehavioralFrontierOutput> => {
  const input = BehavioralFrontierInputSchema.parse(args)

  switch (input.mode) {
    case BEHAVIORAL_FRONTIER_MODES.replay:
      return BehavioralFrontierOutputSchema.parse(await runReplay(input))
    case BEHAVIORAL_FRONTIER_MODES.explore:
      return BehavioralFrontierOutputSchema.parse(await runExplore(input))
    case BEHAVIORAL_FRONTIER_MODES.verify:
      return BehavioralFrontierOutputSchema.parse(await runVerify(input))
  }
}

export const BEHAVIORAL_FRONTIER_COMMAND = 'behavioral-frontier'

export const behavioralFrontierCli = makeCli({
  name: BEHAVIORAL_FRONTIER_COMMAND,
  inputSchema: BehavioralFrontierInputSchema,
  outputSchema: BehavioralFrontierOutputSchema,
  help: [
    'Spec input options:',
    '  - specs: inline JSON array of behavioral specs',
    '  - specPath: JSONL file of behavioral specs (one spec object per line)',
    '',
    'Replay/explore/verify options:',
    '  - snapshotMessages: prior snapshot stream prefix',
    `  - strategy: ${BEHAVIORAL_FRONTIER_STRATEGIES.bfs} | ${BEHAVIORAL_FRONTIER_STRATEGIES.dfs}`,
    `  - selectionPolicy: ${BEHAVIORAL_FRONTIER_SELECTION_POLICIES['all-enabled']} | ${BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler}`,
    '  - triggers: external BPEvent values explored as ingress selections',
    '  - maxDepth: selection-depth cap for exploration',
  ].join('\n'),
  run: runBehavioralFrontier,
})
