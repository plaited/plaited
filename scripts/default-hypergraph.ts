import { join } from 'node:path'
import { buildIndex, loadJsonLd } from '../src/tools/hypergraph.ts'

export type ProgramRequirement = {
  label: string
  path: string
}

export type RequirementStatus = ProgramRequirement & {
  exists: boolean
}

export type ProgramStatus = {
  name: 'default-hypergraph'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  seedPath: string
  seedDocs: number
  vertexCount: number
  hyperedgeCount: number
  requirements: RequirementStatus[]
  missingConcepts: string[]
  missingSkillLinks: Array<{ from: string; to: string }>
}

export const DEFAULT_HYPERGRAPH_PROGRAM_PATH = join('dev-research', 'default-hypergraph', 'program.md')
export const DEFAULT_HYPERGRAPH_SEED_PATH = join('dev-research', 'default-hypergraph', 'seed')

export const REQUIRED_CONCEPT_IDS = [
  'mss:content-type',
  'mss:structure',
  'mss:mechanics',
  'mss:boundary',
  'mss:scale',
  'mss:scale/relative',
  'modnet:composition/parent-child',
  'modnet:composition/auto-group',
  'agent:state/uncertain',
  'agent:state/evidence-required',
  'agent:action/hypergraph-recall',
  'agent:action/web-search',
  'agent:action/ask-human',
  'agent:action/stop',
  'agent:policy/fanout',
  'agent:policy/merge-winner',
  'bp:thread/search-gate',
  'bp:thread/human-escalation',
] as const

export const REQUIRED_SKILL_LINKS = [
  { from: 'skill://default-hypergraph-modnet', to: 'skill://default-hypergraph-mss' },
  { from: 'skill://default-hypergraph-agent-policy', to: 'skill://default-hypergraph-modnet' },
  { from: 'skill://default-hypergraph-decomposition', to: 'skill://default-hypergraph-agent-policy' },
] as const

export const DEFAULT_HYPERGRAPH_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Hypergraph tool', path: join('src', 'tools', 'hypergraph.ts') },
  { label: 'Hypergraph memory skill', path: join('skills', 'hypergraph-memory', 'SKILL.md') },
  { label: 'Hypergraph recall skill', path: join('skills', 'hypergraph-recall', 'SKILL.md') },
  { label: 'MSS vocabulary skill', path: join('skills', 'mss-vocabulary', 'SKILL.md') },
  { label: 'Modnet modules skill', path: join('skills', 'modnet-modules', 'SKILL.md') },
] as const

export const getDefaultHypergraphStatus = async (): Promise<ProgramStatus> => {
  const programFile = Bun.file(DEFAULT_HYPERGRAPH_PROGRAM_PATH)
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const docs = await loadJsonLd(DEFAULT_HYPERGRAPH_SEED_PATH)
  const index = docs.length > 0 ? buildIndex(docs) : null

  const requirements = await Promise.all(
    DEFAULT_HYPERGRAPH_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await Bun.file(requirement.path).exists(),
    })),
  )

  const missingConcepts = REQUIRED_CONCEPT_IDS.filter((id) => !index?.vertexMap.has(id))
  const missingSkillLinks = REQUIRED_SKILL_LINKS.filter(({ from, to }) => {
    if (!index) return true

    const fromIdx = index.vertexMap.get(from)
    const toIdx = index.vertexMap.get(to)

    if (fromIdx === undefined || toIdx === undefined) {
      return true
    }

    const start = index.dirOffsets[fromIdx] ?? 0
    const end = index.dirOffsets[fromIdx + 1] ?? start

    for (let cursor = start; cursor < end; cursor++) {
      if (index.dirNeighbors[cursor] === toIdx) {
        return false
      }
    }

    return true
  })

  return {
    name: 'default-hypergraph',
    programPath: DEFAULT_HYPERGRAPH_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    seedPath: DEFAULT_HYPERGRAPH_SEED_PATH,
    seedDocs: docs.length,
    vertexCount: index?.vertexIds.length ?? 0,
    hyperedgeCount: index?.hyperedgeIds.length ?? 0,
    requirements,
    missingConcepts,
    missingSkillLinks,
  }
}

export const isDefaultHypergraphValid = (status: ProgramStatus): boolean =>
  status.programExists &&
  status.programNonEmpty &&
  status.seedDocs > 0 &&
  status.requirements.every((requirement) => requirement.exists) &&
  status.missingConcepts.length === 0 &&
  status.missingSkillLinks.length === 0

export const renderDefaultHypergraphStatus = (status: ProgramStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `seedPath: ${status.seedPath}`,
    `seedDocs: ${status.seedDocs}`,
    `vertexCount: ${status.vertexCount}`,
    `hyperedgeCount: ${status.hyperedgeCount}`,
    'requirements:',
    ...status.requirements.map(
      (requirement) => `- ${requirement.label}: ${requirement.exists ? 'ok' : 'missing'} (${requirement.path})`,
    ),
    `missingConcepts: ${status.missingConcepts.length === 0 ? 'none' : status.missingConcepts.join(', ')}`,
    `missingSkillLinks: ${
      status.missingSkillLinks.length === 0
        ? 'none'
        : status.missingSkillLinks.map(({ from, to }) => `${from} -> ${to}`).join(', ')
    }`,
  ]

  return lines.join('\n')
}

const main = async () => {
  const command = Bun.argv[2] ?? 'status'
  const status = await getDefaultHypergraphStatus()

  if (command === 'status') {
    console.log(renderDefaultHypergraphStatus(status))
    return
  }

  if (command === 'validate') {
    console.log(renderDefaultHypergraphStatus(status))
    if (!isDefaultHypergraphValid(status)) {
      process.exitCode = 1
    }
    return
  }

  console.error('Usage: bun scripts/default-hypergraph.ts [status|validate]')
  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
