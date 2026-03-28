import { join } from 'node:path'

export type ProgramRequirement = {
  label: string
  path: string
}

export type RequirementStatus = ProgramRequirement & {
  exists: boolean
}

export type ProgramStatus = {
  name: 'behavioral-factories'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  requirements: RequirementStatus[]
}

export const BEHAVIORAL_FACTORIES_PROGRAM_PATH = join('dev-research', 'behavioral-factories', 'program.md')

export const BEHAVIORAL_FACTORIES_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Behavioral core skill', path: join('skills', 'behavioral-core', 'SKILL.md') },
  { label: 'Hypergraph memory skill', path: join('skills', 'hypergraph-memory', 'SKILL.md') },
  { label: 'MSS skill', path: join('skills', 'mss', 'SKILL.md') },
  { label: 'Hypergraph tool', path: join('src', 'tools', 'hypergraph.ts') },
  { label: 'Training prompts program', path: join('dev-research', 'training-prompts', 'program.md') },
] as const

export const getBehavioralFactoriesStatus = async (): Promise<ProgramStatus> => {
  const programFile = Bun.file(BEHAVIORAL_FACTORIES_PROGRAM_PATH)
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''

  const requirements = await Promise.all(
    BEHAVIORAL_FACTORIES_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await Bun.file(requirement.path).exists(),
    })),
  )

  return {
    name: 'behavioral-factories',
    programPath: BEHAVIORAL_FACTORIES_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    requirements,
  }
}

export const isBehavioralFactoriesValid = (status: ProgramStatus): boolean =>
  status.programExists && status.programNonEmpty && status.requirements.every((requirement) => requirement.exists)

export const renderBehavioralFactoriesStatus = (status: ProgramStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
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
