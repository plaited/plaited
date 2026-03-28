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
  missingCoreConcepts: string[]
  missingSeedDocumentLinks: Array<{ from: string; to: string }>
  missingInternalReferences: Array<{ from: string; field: string; target: string }>
}

export const DEFAULT_HYPERGRAPH_PROGRAM_PATH = join('dev-research', 'default-hypergraph', 'program.md')
export const DEFAULT_HYPERGRAPH_SEED_PATH = join('dev-research', 'default-hypergraph', 'seed')

export const REQUIRED_CORE_CONCEPT_IDS = [
  'mss:content-type',
  'mss:structure',
  'mss:mechanics',
  'mss:boundary',
  'mss:scale',
  'mss:scale/relative',
  'modnet:composition/parent-child',
  'agent:state/uncertain',
  'agent:state/evidence-required',
  'agent:action/hypergraph-recall',
  'agent:action/web-search',
  'agent:action/ask-human',
  'agent:action/stop',
  'agent:policy/fanout',
  'agent:policy/merge-winner',
  'agent:policy/single-path',
  'decomp:strategy/parallel',
  'decomp:strategy/sequential',
  'decomp:limit/max-branches',
  'decomp:limit/max-depth',
  'decomp:limit/budget',
  'decomp:merge/winner-takes-all',
  'decomp:merge/consensus',
  'decomp:merge/confidence-weighted',
  'decomp:merge/priority',
  'decomp:merge/union',
  'decomp:tie/ask-human',
  'decomp:criteria/confidence',
  'decomp:criteria/cost',
  'decomp:failure/timeout',
  'decomp:failure/contradiction',
  'decomp:failure/incomplete',
  'decomp:trigger/high-uncertainty',
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

export const REQUIRED_SEED_DOCUMENT_LINKS = [
  { from: 'seed://default-hypergraph-modnet', to: 'seed://default-hypergraph-mss' },
  { from: 'seed://default-hypergraph-agent-policy', to: 'seed://default-hypergraph-modnet' },
  { from: 'seed://default-hypergraph-decomposition', to: 'seed://default-hypergraph-agent-policy' },
  { from: 'seed://default-hypergraph-invariants', to: 'seed://default-hypergraph-mss' },
  { from: 'seed://default-hypergraph-runtime', to: 'seed://default-hypergraph-agent-policy' },
  { from: 'seed://default-hypergraph-distillation', to: 'seed://default-hypergraph-runtime' },
  { from: 'seed://default-hypergraph-factory', to: 'seed://default-hypergraph-distillation' },
  { from: 'seed://default-hypergraph-factory', to: 'seed://default-hypergraph-invariants' },
] as const

export const DEFAULT_HYPERGRAPH_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Hypergraph tool', path: join('src', 'tools', 'hypergraph.ts') },
  { label: 'Hypergraph memory skill', path: join('skills', 'hypergraph-memory', 'SKILL.md') },
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

const findMissingInternalReferences = ({
  docs,
}: {
  docs: Record<string, unknown>[]
}): Array<{ from: string; field: string; target: string }> => {
  const knownIds = new Set<string>()
  const missing = new Map<string, { from: string; field: string; target: string }>()

  for (const doc of docs) {
    const docId = doc['@id']
    if (typeof docId === 'string') {
      knownIds.add(docId)
    }

    for (const field of ['provides', 'requires', 'rules', 'bids'] as const) {
      const items = doc[field]
      if (!Array.isArray(items)) continue

      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const itemId = item['@id' as keyof typeof item]
        if (typeof itemId === 'string') {
          knownIds.add(itemId)
        }
      }
    }
  }

  const visit = (value: unknown, from: string, field: string) => {
    if (typeof value === 'string') {
      if (looksLikeGraphId(value) && !knownIds.has(value)) {
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

  const missingCoreConcepts = REQUIRED_CORE_CONCEPT_IDS.filter((id) => !index?.vertexMap.has(id))
  const missingInternalReferences = findMissingInternalReferences({ docs })
  const missingSeedDocumentLinks = REQUIRED_SEED_DOCUMENT_LINKS.filter(({ from, to }) => {
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
    missingCoreConcepts,
    missingSeedDocumentLinks,
    missingInternalReferences,
  }
}

export const isDefaultHypergraphValid = (status: ProgramStatus): boolean =>
  status.programExists &&
  status.programNonEmpty &&
  status.seedDocs > 0 &&
  status.requirements.every((requirement) => requirement.exists) &&
  status.missingCoreConcepts.length === 0 &&
  status.missingSeedDocumentLinks.length === 0 &&
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
    `missingCoreConcepts: ${status.missingCoreConcepts.length === 0 ? 'none' : status.missingCoreConcepts.join(', ')}`,
    `missingInternalReferences: ${
      status.missingInternalReferences.length === 0
        ? 'none'
        : status.missingInternalReferences.map(({ from, field, target }) => `${from}.${field} -> ${target}`).join(', ')
    }`,
    `missingSeedDocumentLinks: ${
      status.missingSeedDocumentLinks.length === 0
        ? 'none'
        : status.missingSeedDocumentLinks.map(({ from, to }) => `${from} -> ${to}`).join(', ')
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
