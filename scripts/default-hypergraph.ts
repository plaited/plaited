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
  missingInternalReferences: Array<{ from: string; field: string; target: string }>
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
  'agent:policy/single-path',
  'agent:state/decomposing',
  'agent:state/fanout-active',
  'agent:state/merging',
  'agent:state/single-path-selected',
  'agent:state/merge-failed',
  'decomp:strategy/parallel',
  'decomp:strategy/sequential',
  'decomp:strategy/recursive',
  'decomp:strategy/hierarchical',
  'decomp:limit/max-branches',
  'decomp:limit/max-depth',
  'decomp:limit/budget',
  'decomp:merge/winner-takes-all',
  'decomp:merge/consensus',
  'decomp:merge/confidence-weighted',
  'decomp:merge/priority',
  'decomp:merge/union',
  'decomp:merge/partial',
  'decomp:tie/first-available',
  'decomp:tie/random',
  'decomp:tie/ask-human',
  'decomp:criteria/confidence',
  'decomp:criteria/cost',
  'decomp:criteria/entropy',
  'decomp:criteria/atomicity',
  'decomp:failure/timeout',
  'decomp:failure/contradiction',
  'decomp:failure/incomplete',
  'decomp:trigger/high-uncertainty',
  'decomp:trigger/multiple-valid',
  'decomp:trigger/risk-mitigation',
  'decomp:prefer/single-path-over-fanout',
  'decomp:prefer/fanout-over-single-path',
  'bp:thread/search-gate',
  'bp:thread/human-escalation',
  'bp:thread/fanout-selection',
  'bp:thread/single-path-selection',
  'bp:thread/merge-coordination',
  // Factory compilation surfaces
  'factory:surface/policy',
  'factory:surface/rule',
  'factory:surface/thread-pattern',
  'factory:surface/constraint',
  'factory:surface/graph-only',
  'factory:surface/provenance',
  'factory:policy/graph-before-factory',
  'factory:policy/preserve-invariants',
  'factory:policy/traceable-output',
  'factory:output/bthread',
  'factory:output/policy-guard',
  'factory:output/rule-assertion',
] as const

export const REQUIRED_SKILL_LINKS = [
  { from: 'skill://default-hypergraph-modnet', to: 'skill://default-hypergraph-mss' },
  { from: 'skill://default-hypergraph-agent-policy', to: 'skill://default-hypergraph-modnet' },
  { from: 'skill://default-hypergraph-decomposition', to: 'skill://default-hypergraph-agent-policy' },
  { from: 'skill://default-hypergraph-invariants', to: 'skill://default-hypergraph-mss' },
  { from: 'skill://default-hypergraph-runtime', to: 'skill://default-hypergraph-agent-policy' },
  { from: 'skill://default-hypergraph-distillation', to: 'skill://default-hypergraph-runtime' },
  { from: 'skill://default-hypergraph-factory', to: 'skill://default-hypergraph-distillation' },
  { from: 'skill://default-hypergraph-factory', to: 'skill://default-hypergraph-invariants' },
] as const

export const DEFAULT_HYPERGRAPH_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Hypergraph tool', path: join('src', 'tools', 'hypergraph.ts') },
  { label: 'Hypergraph memory skill', path: join('skills', 'hypergraph-memory', 'SKILL.md') },
  { label: 'Hypergraph recall skill', path: join('skills', 'hypergraph-recall', 'SKILL.md') },
  { label: 'MSS skill', path: join('skills', 'mss', 'SKILL.md') },
  { label: 'Modnet modules skill', path: join('skills', 'modnet-modules', 'SKILL.md') },
] as const

const INTERNAL_REFERENCE_FIELDS = new Set([
  'references',
  'blocks',
  'subject',
  'object',
  'contains',
  'containedBy',
  'restrictionOrder',
])

const looksLikeGraphId = (value: string) => /^[a-z][a-z0-9-]*:(?:\/\/)?/i.test(value)

const collectMissingInternalReferences = (
  docs: Record<string, unknown>[],
): Array<{ from: string; field: string; target: string }> => {
  const ids = new Set<string>()
  const missing = new Map<string, { from: string; field: string; target: string }>()

  for (const doc of docs) {
    const docId = doc['@id']
    if (typeof docId === 'string') {
      ids.add(docId)
    }

    for (const field of ['provides', 'requires', 'rules', 'bids'] as const) {
      const items = doc[field]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          const itemId = item['@id' as keyof typeof item]
          if (typeof itemId === 'string') {
            ids.add(itemId)
          }
        }
      }
    }
  }

  const visit = (value: unknown, from: string, field: string) => {
    if (typeof value === 'string') {
      if (looksLikeGraphId(value) && !ids.has(value)) {
        missing.set(`${from}\0${field}\0${value}`, { from, field, target: value })
      }
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, from, field)
      }
      return
    }

    if (typeof value === 'object' && value !== null) {
      for (const [nestedField, nestedValue] of Object.entries(value)) {
        if (INTERNAL_REFERENCE_FIELDS.has(nestedField)) {
          visit(nestedValue, from, nestedField)
        }
      }
    }
  }

  for (const doc of docs) {
    const docId = typeof doc['@id'] === 'string' ? doc['@id'] : '(unknown-doc)'
    for (const [field, value] of Object.entries(doc)) {
      if (INTERNAL_REFERENCE_FIELDS.has(field)) {
        visit(value, docId, field)
      }
    }

    for (const containerField of ['provides', 'requires', 'rules', 'bids'] as const) {
      const items = doc[containerField]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const itemId =
          typeof item['@id' as keyof typeof item] === 'string' ? (item['@id' as keyof typeof item] as string) : docId
        for (const [field, value] of Object.entries(item)) {
          if (INTERNAL_REFERENCE_FIELDS.has(field)) {
            visit(value, itemId, field)
          }
        }
      }
    }
  }

  return [...missing.values()].sort((left, right) =>
    `${left.from}:${left.field}:${left.target}`.localeCompare(`${right.from}:${right.field}:${right.target}`),
  )
}

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
  const missingInternalReferences = collectMissingInternalReferences(docs)
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
    missingInternalReferences,
  }
}

export const isDefaultHypergraphValid = (status: ProgramStatus): boolean =>
  status.programExists &&
  status.programNonEmpty &&
  status.seedDocs > 0 &&
  status.requirements.every((requirement) => requirement.exists) &&
  status.missingConcepts.length === 0 &&
  status.missingSkillLinks.length === 0 &&
  status.missingInternalReferences.length === 0

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
    `missingInternalReferences: ${
      status.missingInternalReferences.length === 0
        ? 'none'
        : status.missingInternalReferences.map(({ from, field, target }) => `${from}.${field} -> ${target}`).join(', ')
    }`,
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
