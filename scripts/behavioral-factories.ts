import { join } from 'node:path'
import type { ResearchLaneConfig } from './autoresearch-runner.ts'

export type ProgramRequirement = {
  label: string
  path: string
}

export type RequirementStatus = ProgramRequirement & {
  exists: boolean
}

export type BehavioralFactoriesStatus = {
  name: 'behavioral-factories'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  outputRoot: string
  outputFiles: number
  requirements: RequirementStatus[]
}

export const BEHAVIORAL_FACTORIES_PROGRAM_PATH = join('dev-research', 'behavioral-factories', 'program.md')
export const BEHAVIORAL_FACTORIES_OUTPUT_PATH = join('dev-research', 'behavioral-factories')
export const BEHAVIORAL_FACTORIES_SYSTEM_PROMPT = `You are working on the behavioral-factories lane.

Your job is to derive deterministic, reviewable behavioral-factory outputs from
upstream seed and corpus contracts.
Prefer lane-local compilation artifacts over broad runtime or framework edits.
Do not rewrite upstream lanes while working on this lane.`

export const RESEARCH_LANE_CONFIG = {
  key: 'behavioral-factories',
  scriptPath: 'scripts/behavioral-factories.ts',
  programPath: BEHAVIORAL_FACTORIES_PROGRAM_PATH,
  validateCommand: ['bun', 'scripts/behavioral-factories.ts', 'validate'],
  writableRoots: [join('dev-research', 'behavioral-factories')],
  skills: [
    join('skills', 'behavioral-core'),
    join('skills', 'hypergraph-memory'),
    join('skills', 'mss'),
    join('skills', 'modnet-node'),
    join('skills', 'modnet-modules'),
    join('skills', 'youdotcom-api'),
  ],
  model: 'openrouter/minimax/minimax-m2.7',
  systemPrompt: BEHAVIORAL_FACTORIES_SYSTEM_PROMPT,
  taskPrompt:
    'Improve the behavioral-factories lane. Keep changes lane-local, consume upstream seed/corpus contracts conceptually, run the lane validator before finishing, and summarize what changed.',
  defaultAttempts: 20,
  defaultParallelism: 3,
  evaluation: {
    graderPath: 'scripts/behavioral-factories-grader.ts',
    verifierPath: 'scripts/behavioral-factories-verifier.ts',
    useMetaVerification: true,
    hint: 'Prefer deterministic, reviewable factory-oriented outputs that preserve seed/corpus dependency order and avoid upstream lane drift.',
  },
} satisfies ResearchLaneConfig

export const BEHAVIORAL_FACTORIES_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Behavioral core skill', path: join('skills', 'behavioral-core', 'SKILL.md') },
  { label: 'Hypergraph memory skill', path: join('skills', 'hypergraph-memory', 'SKILL.md') },
  { label: 'MSS skill', path: join('skills', 'mss', 'SKILL.md') },
  { label: 'Modnet node skill', path: join('skills', 'modnet-node', 'SKILL.md') },
  { label: 'Modnet modules skill', path: join('skills', 'modnet-modules', 'SKILL.md') },
  { label: 'Hypergraph tool', path: join('src', 'tools', 'hypergraph.ts') },
  { label: 'Factories runtime surface', path: join('src', 'agent', 'factories.ts') },
  { label: 'MSS seed program', path: join('dev-research', 'mss-seed', 'program.md') },
  { label: 'MSS corpus program', path: join('dev-research', 'mss-corpus', 'program.md') },
] as const

const pathExists = async (path: string): Promise<boolean> => {
  const result = await Bun.$`test -e ${path}`.quiet().nothrow()
  return result.exitCode === 0
}

const countFiles = async (dirPath: string): Promise<number> => {
  if (!(await pathExists(dirPath))) {
    return 0
  }

  return Array.fromAsync(new Bun.Glob('*').scan({ cwd: dirPath })).then((entries) => entries.length)
}

export const getBehavioralFactoriesStatus = async (): Promise<BehavioralFactoriesStatus> => {
  const programFile = Bun.file(BEHAVIORAL_FACTORIES_PROGRAM_PATH)
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const outputFiles = await countFiles(BEHAVIORAL_FACTORIES_OUTPUT_PATH)

  const requirements = await Promise.all(
    BEHAVIORAL_FACTORIES_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await pathExists(requirement.path),
    })),
  )

  return {
    name: 'behavioral-factories',
    programPath: BEHAVIORAL_FACTORIES_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    outputRoot: BEHAVIORAL_FACTORIES_OUTPUT_PATH,
    outputFiles,
    requirements,
  }
}

export const isBehavioralFactoriesValid = (status: BehavioralFactoriesStatus): boolean =>
  status.programExists && status.programNonEmpty && status.requirements.every((requirement) => requirement.exists)

export const renderBehavioralFactoriesStatus = (status: BehavioralFactoriesStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `outputRoot: ${status.outputRoot}`,
    `outputFiles: ${status.outputFiles}`,
    'requirements:',
    ...status.requirements.map(
      (requirement) => `- ${requirement.label}: ${requirement.exists ? 'ok' : 'missing'} (${requirement.path})`,
    ),
  ]

  return lines.join('\n')
}

const main = async () => {
  const command = Bun.argv[2] ?? 'status'
  const status = await getBehavioralFactoriesStatus()

  if (command === 'status') {
    console.log(renderBehavioralFactoriesStatus(status))
    return
  }

  if (command === 'validate') {
    console.log(renderBehavioralFactoriesStatus(status))
    if (!isBehavioralFactoriesValid(status)) {
      process.exitCode = 1
    }
    return
  }

  console.error('Usage: bun scripts/behavioral-factories.ts [status|validate]')
  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
