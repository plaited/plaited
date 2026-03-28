import { join } from 'node:path'
import { loadJsonLd } from '../src/tools/hypergraph.ts'
import type { ResearchLaneConfig } from './autoresearch-runner.ts'

export type ProgramRequirement = {
  label: string
  path: string
}

export type RequirementStatus = ProgramRequirement & {
  exists: boolean
}

export type BehavioralSeedStatus = {
  name: 'behavioral-seed'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  laneSeedPath: string
  laneSeedDocs: number
  semanticSeedValid: boolean
  semanticIssues: string[]
  artifactPath: string
  artifactFiles: number
  requirements: RequirementStatus[]
}

type JsonLdNode = Record<string, unknown>

const REQUIRED_BEHAVIORAL_ANCHORS = ['behavioral', 'bthread', 'bsync', 'governance', 'constitution'] as const

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const collectJsonLdNodes = (document: JsonLdNode): JsonLdNode[] => {
  const graph = document['@graph']
  const nodes = Array.isArray(graph) ? graph.filter(isRecord) : []
  return [document, ...nodes]
}

const toStringArray = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

const hasProvenanceSignal = (node: JsonLdNode): boolean =>
  [
    'derivedFrom',
    'behavioral:derivedFrom',
    'provenance',
    'behavioral:provenance',
    'source',
    'sources',
    'behavioral:source',
    'behavioral:sources',
  ].some((key) => key in node)

const isRuleLikeNode = (node: JsonLdNode): boolean => {
  const typeValues = toStringArray(node['@type']).map((value) => value.toLowerCase())
  if (
    typeValues.some((value) => value.includes('rule') || value.includes('invariant') || value.includes('constraint'))
  ) {
    return true
  }

  return typeof node.rule === 'string' || typeof node['behavioral:rule'] === 'string'
}

const isPatternLikeNode = (node: JsonLdNode): boolean => {
  const typeValues = toStringArray(node['@type']).map((value) => value.toLowerCase())
  if (typeValues.some((value) => value.includes('pattern'))) {
    return true
  }

  const serialized = JSON.stringify(node).toLowerCase()
  return serialized.includes('behavioral') && (serialized.includes('bthread') || serialized.includes('bsync'))
}

const collectExplicitReferences = (value: unknown, refs: Set<string>) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectExplicitReferences(entry, refs)
    }
    return
  }

  if (!isRecord(value)) {
    return
  }

  if (typeof value['@id'] === 'string' && Object.keys(value).every((key) => key === '@id')) {
    refs.add(value['@id'])
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === '@context' || key === '@id' || key === '@type') {
      continue
    }
    collectExplicitReferences(entry, refs)
  }
}

export const validateBehavioralSeedSemantics = async ({
  workspaceRoot,
  laneSeedPath = BEHAVIORAL_SEED_PATH,
}: {
  workspaceRoot: string
  laneSeedPath?: string
}) => {
  const seedDir = join(workspaceRoot, laneSeedPath)
  const issues: string[] = []

  if (!(await pathExists(seedDir))) {
    return { valid: true, issues }
  }

  const documents = (await loadJsonLd(seedDir)) as JsonLdNode[]
  if (documents.length === 0) {
    return { valid: true, issues }
  }

  const nodes = documents.flatMap((document) => collectJsonLdNodes(document))
  const serialized = nodes.map((node) => JSON.stringify(node).toLowerCase()).join('\n')
  const missingAnchors = REQUIRED_BEHAVIORAL_ANCHORS.filter((anchor) => !serialized.includes(anchor))
  if (missingAnchors.length > 0) {
    issues.push(`missing behavioral anchors: ${missingAnchors.join(', ')}`)
  }

  const ruleNodes = nodes.filter((node) => isRuleLikeNode(node))
  if (ruleNodes.length === 0) {
    issues.push('missing behavioral rule or invariant concepts')
  }

  const patternNodes = nodes.filter((node) => isPatternLikeNode(node))
  if (patternNodes.length === 0) {
    issues.push('missing representative behavioral pattern concepts')
  }

  if (!nodes.some((node) => hasProvenanceSignal(node))) {
    issues.push('missing provenance or source linkage')
  }

  const anchorCoverage = REQUIRED_BEHAVIORAL_ANCHORS.filter((anchor) =>
    nodes.some((node) => !patternNodes.includes(node) && JSON.stringify(node).toLowerCase().includes(anchor)),
  )
  if (anchorCoverage.length < 3) {
    issues.push('behavioral anchors are not meaningfully connected to the rest of the seed semantics')
  }

  const explicitReferences = new Set<string>()
  for (const node of nodes) {
    collectExplicitReferences(node, explicitReferences)
  }
  const nodeIds = new Set(nodes.map((node) => (typeof node['@id'] === 'string' ? node['@id'] : '')).filter(Boolean))
  const unresolvedReferences = [...explicitReferences].filter(
    (ref) =>
      (ref.startsWith('behavioral:') || ref.startsWith('constitution:') || ref.startsWith('bp:')) && !nodeIds.has(ref),
  )
  if (unresolvedReferences.length > 0) {
    issues.push(`unresolved internal references: ${unresolvedReferences.slice(0, 5).join(', ')}`)
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export const BEHAVIORAL_SEED_PROGRAM_PATH = join('dev-research', 'behavioral-seed', 'program.md')
export const BEHAVIORAL_SEED_PATH = join('dev-research', 'behavioral-seed', 'seed')
export const BEHAVIORAL_SEED_ARTIFACTS_PATH = join('dev-research', 'behavioral-seed', 'artifacts')
export const BEHAVIORAL_SEED_SYSTEM_PROMPT = `You are working on the behavioral-seed lane.

Your job is to derive a compact, reviewable behavioral seed ontology from behavioral-core and constitution sources.
Prefer durable behavioral primitives, governance anchors, and downstream corpus-enabling concepts over broad registries.
Do not drift into unrelated repo improvement or framework rewrites.`

export const RESEARCH_LANE_CONFIG = {
  key: 'behavioral-seed',
  scriptPath: 'scripts/behavioral-seed.ts',
  programPath: BEHAVIORAL_SEED_PROGRAM_PATH,
  validateCommand: ['bun', 'scripts/behavioral-seed.ts', 'validate'],
  writableRoots: [join('dev-research', 'behavioral-seed')],
  skills: [join('skills', 'behavioral-core'), join('skills', 'constitution'), join('skills', 'youdotcom-api')],
  model: 'openrouter/minimax/minimax-m2.7',
  systemPrompt: BEHAVIORAL_SEED_SYSTEM_PROMPT,
  taskPrompt:
    'Improve the behavioral-seed lane artifacts. Produce or refine a compact lane-local behavioral seed ontology for downstream corpus encoding and factory compilation. Do not edit src/tools. Run the lane validator before finishing and summarize what changed.',
  defaultAttempts: 20,
  defaultParallelism: 3,
} satisfies ResearchLaneConfig

export const BEHAVIORAL_SEED_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Behavioral core skill', path: join('skills', 'behavioral-core', 'SKILL.md') },
  {
    label: 'Behavioral programs reference',
    path: join('skills', 'behavioral-core', 'references', 'behavioral-programs.md'),
  },
  {
    label: 'Behavioral algorithm reference',
    path: join('skills', 'behavioral-core', 'references', 'algorithm-reference.md'),
  },
  {
    label: 'Behavioral agent patterns reference',
    path: join('skills', 'behavioral-core', 'references', 'agent-patterns.spec.ts'),
  },
  {
    label: 'Behavioral agent lifecycle reference',
    path: join('skills', 'behavioral-core', 'references', 'agent-lifecycle.spec.ts'),
  },
  {
    label: 'Behavioral orchestration reference',
    path: join('skills', 'behavioral-core', 'references', 'agent-orchestration.spec.ts'),
  },
  { label: 'Constitution skill', path: join('skills', 'constitution', 'SKILL.md') },
  { label: 'Constitution factory patterns', path: join('skills', 'constitution', 'references', 'factory-patterns.md') },
  {
    label: 'Constitution generated bthreads',
    path: join('skills', 'constitution', 'references', 'generated-bthreads.md'),
  },
  { label: 'Constitution MAC rules', path: join('skills', 'constitution', 'references', 'mac-rules.md') },
  { label: 'Behavioral runtime', path: join('src', 'behavioral', 'behavioral.ts') },
  { label: 'Agent factories runtime', path: join('src', 'agent', 'factories.ts') },
  { label: 'Agent governance runtime', path: join('src', 'agent', 'governance.ts') },
] as const

const pathExists = async (path: string): Promise<boolean> => {
  const result = await Bun.$`test -e ${path}`.quiet().nothrow()
  return result.exitCode === 0
}

export const resolveWorkspaceRoot = async ({ cwd = process.cwd() }: { cwd?: string } = {}) => {
  const override = process.env.PLAITED_WORKSPACE_ROOT?.trim()
  if (override) {
    return override
  }

  const gitTopLevel = await Bun.$`git rev-parse --show-toplevel`.cwd(cwd).quiet().nothrow()
  if (gitTopLevel.exitCode === 0) {
    const root = (await gitTopLevel.text()).trim()
    if (root.length > 0) {
      return root
    }
  }

  return cwd
}

const resolveWorkspacePath = ({ workspaceRoot, relativePath }: { workspaceRoot: string; relativePath: string }) =>
  join(workspaceRoot, relativePath)

const countJsonLdDocs = async (dirPath: string): Promise<number> => {
  if (!(await pathExists(dirPath))) {
    return 0
  }

  const entries = await Array.fromAsync(new Bun.Glob('*.jsonld').scan({ cwd: dirPath }))
  return entries.length
}

const countFiles = async (dirPath: string): Promise<number> => {
  if (!(await pathExists(dirPath))) {
    return 0
  }

  return Array.fromAsync(new Bun.Glob('*').scan({ cwd: dirPath })).then((entries) => entries.length)
}

export const getBehavioralSeedStatus = async ({
  workspaceRoot,
}: {
  workspaceRoot?: string
} = {}): Promise<BehavioralSeedStatus> => {
  const resolvedWorkspaceRoot = workspaceRoot ?? (await resolveWorkspaceRoot())
  const programFile = Bun.file(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_SEED_PROGRAM_PATH }),
  )
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const laneSeedDocs = await countJsonLdDocs(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_SEED_PATH }),
  )
  const semanticValidation = await validateBehavioralSeedSemantics({ workspaceRoot: resolvedWorkspaceRoot })
  const artifactFiles = await countFiles(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_SEED_ARTIFACTS_PATH }),
  )

  const requirements = await Promise.all(
    BEHAVIORAL_SEED_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await pathExists(
        resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: requirement.path }),
      ),
    })),
  )

  return {
    name: 'behavioral-seed',
    programPath: BEHAVIORAL_SEED_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    laneSeedPath: BEHAVIORAL_SEED_PATH,
    laneSeedDocs,
    semanticSeedValid: semanticValidation.valid,
    semanticIssues: semanticValidation.issues,
    artifactPath: BEHAVIORAL_SEED_ARTIFACTS_PATH,
    artifactFiles,
    requirements,
  }
}

export const isBehavioralSeedValid = (status: BehavioralSeedStatus): boolean =>
  status.programExists &&
  status.programNonEmpty &&
  status.requirements.every((requirement) => requirement.exists) &&
  (status.laneSeedDocs === 0 || status.semanticSeedValid)

export const renderBehavioralSeedStatus = (status: BehavioralSeedStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `laneSeedPath: ${status.laneSeedPath}`,
    `laneSeedDocs: ${status.laneSeedDocs}`,
    `semanticSeedValid: ${status.semanticSeedValid ? 'yes' : 'no'}`,
    `artifactPath: ${status.artifactPath}`,
    `artifactFiles: ${status.artifactFiles}`,
    ...(status.semanticIssues.length > 0
      ? ['semanticIssues:', ...status.semanticIssues.map((issue) => `- ${issue}`)]
      : []),
    'requirements:',
    ...status.requirements.map(
      (requirement) => `- ${requirement.label}: ${requirement.exists ? 'ok' : 'missing'} (${requirement.path})`,
    ),
  ]

  return lines.join('\n')
}

const main = async () => {
  const command = Bun.argv[2] ?? 'status'
  const status = await getBehavioralSeedStatus()

  if (command === 'status') {
    console.log(renderBehavioralSeedStatus(status))
    return
  }

  if (command === 'validate') {
    console.log(renderBehavioralSeedStatus(status))
    if (!isBehavioralSeedValid(status)) {
      process.exitCode = 1
    }
    return
  }

  console.error('Usage: bun scripts/behavioral-seed.ts [status|validate]')
  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
