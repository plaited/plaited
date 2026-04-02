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
  upstreamStatus: {
    mssSeedDocs: number
    mssCorpusDocs: number
    behavioralSeedDocs: number
    behavioralCorpusDocs: number
    semanticUpstreamValid: boolean
    semanticIssues: string[]
  }
  requirements: RequirementStatus[]
}

type JsonLdNode = Record<string, unknown>

export const BEHAVIORAL_FACTORIES_PROGRAM_PATH = join('dev-research', 'behavioral-factories', 'program.md')
export const BEHAVIORAL_FACTORIES_OUTPUT_PATH = join('dev-research', 'behavioral-factories')
export const MSS_SEED_PATH = join('dev-research', 'mss-seed', 'seed')
export const MSS_CORPUS_ENCODED_PATH = join('dev-research', 'mss-corpus', 'encoded')
export const BEHAVIORAL_SEED_PATH = join('dev-research', 'behavioral-seed', 'seed')
export const BEHAVIORAL_CORPUS_ENCODED_PATH = join('dev-research', 'behavioral-corpus', 'encoded')
export const BEHAVIORAL_FACTORIES_SYSTEM_PROMPT = `You are working on the behavioral-factories lane.

Your job is to derive deterministic, reviewable behavioral-factory outputs from
retained MSS and behavioral seed/corpus artifacts.
Treat upstream seed/corpus outputs as fixed semantic inputs. Prefer lane-local
factory, policy, context, memory, rollout, and validation artifacts over broad
runtime or framework edits. Do not rewrite upstream artifact lanes while working
on this lane.`

export const RESEARCH_LANE_CONFIG = {
  key: 'behavioral-factories',
  scriptPath: 'scripts/behavioral-factories.ts',
  programPath: BEHAVIORAL_FACTORIES_PROGRAM_PATH,
  validateCommand: ['bun', 'scripts/behavioral-factories.ts', 'validate'],
  writableRoots: [join('dev-research', 'behavioral-factories')],
  readRoots: [
    join('dev-research', 'behavioral-factories'),
    MSS_SEED_PATH,
    MSS_CORPUS_ENCODED_PATH,
    BEHAVIORAL_SEED_PATH,
    BEHAVIORAL_CORPUS_ENCODED_PATH,
  ],
  skills: [join('skills', 'behavioral-core'), join('skills', 'constitution'), join('skills', 'mss')],
  optionalSkillsByTag: {
    ui: [join('skills', 'generative-ui')],
    'agent-loop': [join('skills', 'agent-loop')],
    'node-auth': [join('skills', 'node-auth')],
    web: [join('skills', 'youdotcom-api')],
  },
  model: 'openrouter/minimax/minimax-m2.7',
  systemPrompt: BEHAVIORAL_FACTORIES_SYSTEM_PROMPT,
  taskPrompt:
    'Improve the behavioral-factories lane. Keep changes lane-local, consume retained MSS and behavioral seed/corpus artifacts as fixed inputs, run the lane validator before finishing, and summarize what changed.',
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
  { label: 'Constitution skill', path: join('skills', 'constitution', 'SKILL.md') },
  { label: 'MSS skill', path: join('skills', 'mss', 'SKILL.md') },
  { label: 'Modnet node skill', path: join('skills', 'modnet-node', 'SKILL.md') },
  { label: 'Modnet modules skill', path: join('skills', 'modnet-modules', 'SKILL.md') },
  { label: 'Behavioral runtime surface', path: join('src', 'behavioral', 'behavioral.ts') },
  { label: 'Factories runtime surface', path: join('src', 'agent', 'factories.ts') },
  { label: 'Governance runtime surface', path: join('src', 'agent', 'governance.ts') },
  { label: 'MSS seed artifacts', path: MSS_SEED_PATH },
  { label: 'MSS corpus artifacts', path: MSS_CORPUS_ENCODED_PATH },
  { label: 'Behavioral seed artifacts', path: BEHAVIORAL_SEED_PATH },
  { label: 'Behavioral corpus artifacts', path: BEHAVIORAL_CORPUS_ENCODED_PATH },
] as const

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

const hasAnyKey = (node: JsonLdNode, keys: readonly string[]) => keys.some((key) => key in node)

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

const countJsonLdDocs = async (dirPath: string): Promise<number> => {
  if (!(await pathExists(dirPath))) {
    return 0
  }

  const entries = await Array.fromAsync(new Bun.Glob('*.jsonld').scan({ cwd: dirPath }))
  return entries.length
}

const validateSeedSemantics = ({
  nodes,
  requiredAnchors,
  provenanceKeys,
  referencePrefixes,
}: {
  nodes: JsonLdNode[]
  requiredAnchors: readonly string[]
  provenanceKeys: readonly string[]
  referencePrefixes: readonly string[]
}) => {
  const issues: string[] = []
  const serialized = nodes.map((node) => JSON.stringify(node).toLowerCase()).join('\n')
  const missingAnchors = requiredAnchors.filter((anchor) => !serialized.includes(anchor.toLowerCase()))
  if (missingAnchors.length > 0) {
    issues.push(`missing anchors: ${missingAnchors.join(', ')}`)
  }

  const ruleNodes = nodes.filter((node) => {
    const typeValues = toStringArray(node['@type']).map((value) => value.toLowerCase())
    return (
      typeValues.some(
        (value) => value.includes('rule') || value.includes('invariant') || value.includes('constraint'),
      ) || typeof node.rule === 'string'
    )
  })
  if (ruleNodes.length === 0) {
    issues.push('missing rule or invariant concepts')
  }

  const patternNodes = nodes.filter((node) => {
    const typeValues = toStringArray(node['@type']).map((value) => value.toLowerCase())
    return (
      typeValues.some((value) => value.includes('pattern')) || JSON.stringify(node).toLowerCase().includes('pattern')
    )
  })
  if (patternNodes.length === 0) {
    issues.push('missing representative pattern concepts')
  }

  if (!nodes.some((node) => hasAnyKey(node, provenanceKeys))) {
    issues.push('missing provenance or source linkage')
  }

  const explicitReferences = new Set<string>()
  for (const node of nodes) {
    collectExplicitReferences(node, explicitReferences)
  }
  const nodeIds = new Set(nodes.map((node) => (typeof node['@id'] === 'string' ? node['@id'] : '')).filter(Boolean))
  const unresolvedReferences = [...explicitReferences].filter(
    (ref) => referencePrefixes.some((prefix) => ref.startsWith(prefix)) && !nodeIds.has(ref),
  )
  if (unresolvedReferences.length > 0) {
    issues.push(`unresolved internal references: ${unresolvedReferences.slice(0, 5).join(', ')}`)
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

const validateCorpusSemantics = ({
  seedNodes,
  encodedNodes,
  semanticNeedles,
  corpusLabel,
}: {
  seedNodes: JsonLdNode[]
  encodedNodes: JsonLdNode[]
  semanticNeedles: readonly string[]
  corpusLabel: string
}) => {
  const issues: string[] = []
  const seedIds = new Set(seedNodes.map((node) => (typeof node['@id'] === 'string' ? node['@id'] : '')).filter(Boolean))
  const encodedText = encodedNodes.map((node) => JSON.stringify(node).toLowerCase()).join('\n')

  if (!encodedText.includes('source') && !encodedText.includes('provenance') && !encodedText.includes('derivedfrom')) {
    issues.push(`missing source-backed provenance in ${corpusLabel}`)
  }

  if (!semanticNeedles.some((needle) => encodedText.includes(needle))) {
    issues.push(`encoded ${corpusLabel} does not express expected semantics`)
  }

  const seedReferences = [...seedIds].filter((seedId) => encodedText.includes(seedId.toLowerCase()))
  if (seedIds.size > 0 && seedReferences.length === 0) {
    issues.push(`encoded ${corpusLabel} does not reference any seed anchors`)
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

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

const countFiles = async (dirPath: string): Promise<number> => {
  if (!(await pathExists(dirPath))) {
    return 0
  }

  return Array.fromAsync(new Bun.Glob('*').scan({ cwd: dirPath })).then((entries) => entries.length)
}

const loadJsonLdDocuments = async (dirPath: string): Promise<JsonLdNode[]> => {
  const paths = await Array.fromAsync(new Bun.Glob('*.jsonld').scan({ cwd: dirPath }))
  const documents = await Promise.all(
    paths.map(async (path) => {
      const value = await Bun.file(join(dirPath, path)).json()
      return isRecord(value) ? (value as JsonLdNode) : null
    }),
  )

  return documents.filter((document): document is JsonLdNode => document !== null)
}

const loadNodes = async (dirPath: string): Promise<JsonLdNode[]> => {
  if (!(await pathExists(dirPath))) {
    return []
  }

  const documents = await loadJsonLdDocuments(dirPath).catch(() => [])
  return documents.flatMap((document) => collectJsonLdNodes(document))
}

export const validateBehavioralFactoriesUpstream = async ({ workspaceRoot }: { workspaceRoot: string }) => {
  const mssSeedDir = resolveWorkspacePath({ workspaceRoot, relativePath: MSS_SEED_PATH })
  const mssCorpusDir = resolveWorkspacePath({ workspaceRoot, relativePath: MSS_CORPUS_ENCODED_PATH })
  const behavioralSeedDir = resolveWorkspacePath({ workspaceRoot, relativePath: BEHAVIORAL_SEED_PATH })
  const behavioralCorpusDir = resolveWorkspacePath({ workspaceRoot, relativePath: BEHAVIORAL_CORPUS_ENCODED_PATH })

  const [mssSeedDocs, mssCorpusDocs, behavioralSeedDocs, behavioralCorpusDocs] = await Promise.all([
    countJsonLdDocs(mssSeedDir),
    countJsonLdDocs(mssCorpusDir),
    countJsonLdDocs(behavioralSeedDir),
    countJsonLdDocs(behavioralCorpusDir),
  ])

  const [mssSeedNodes, mssCorpusNodes, behavioralSeedNodes, behavioralCorpusNodes] = await Promise.all([
    loadNodes(mssSeedDir),
    loadNodes(mssCorpusDir),
    loadNodes(behavioralSeedDir),
    loadNodes(behavioralCorpusDir),
  ])

  const issues: string[] = []

  if (mssSeedDocs === 0) {
    issues.push('missing MSS seed artifacts')
  } else {
    issues.push(
      ...validateSeedSemantics({
        nodes: mssSeedNodes,
        requiredAnchors: ['contenttype', 'structure', 'mechanics', 'boundary', 'scale'],
        provenanceKeys: ['derivedFrom', 'mss:derivedFrom', 'provenance', 'mss:provenance', 'source', 'mss:source'],
        referencePrefixes: ['mss:'],
      }).issues.map((issue) => `mss-seed: ${issue}`),
    )
  }

  if (mssCorpusDocs === 0) {
    issues.push('missing MSS corpus artifacts')
  } else {
    issues.push(
      ...validateCorpusSemantics({
        seedNodes: mssSeedNodes,
        encodedNodes: mssCorpusNodes,
        semanticNeedles: ['mss', 'contenttype', 'structure', 'mechanics', 'boundary', 'scale'],
        corpusLabel: 'MSS corpus',
      }).issues.map((issue) => `mss-corpus: ${issue}`),
    )
  }

  if (behavioralSeedDocs === 0) {
    issues.push('missing behavioral seed artifacts')
  } else {
    issues.push(
      ...validateSeedSemantics({
        nodes: behavioralSeedNodes,
        requiredAnchors: ['behavioral', 'bthread', 'bsync', 'governance', 'constitution'],
        provenanceKeys: [
          'derivedFrom',
          'behavioral:derivedFrom',
          'provenance',
          'behavioral:provenance',
          'source',
          'behavioral:source',
        ],
        referencePrefixes: ['behavioral:', 'constitution:', 'bp:'],
      }).issues.map((issue) => `behavioral-seed: ${issue}`),
    )
  }

  if (behavioralCorpusDocs === 0) {
    issues.push('missing behavioral corpus artifacts')
  } else {
    issues.push(
      ...validateCorpusSemantics({
        seedNodes: behavioralSeedNodes,
        encodedNodes: behavioralCorpusNodes,
        semanticNeedles: ['behavioral', 'constitution', 'governance', 'bthread', 'bsync'],
        corpusLabel: 'behavioral corpus',
      }).issues.map((issue) => `behavioral-corpus: ${issue}`),
    )
  }

  return {
    mssSeedDocs,
    mssCorpusDocs,
    behavioralSeedDocs,
    behavioralCorpusDocs,
    semanticUpstreamValid: issues.length === 0,
    semanticIssues: issues,
  }
}

export const getBehavioralFactoriesStatus = async ({
  workspaceRoot,
}: {
  workspaceRoot?: string
} = {}): Promise<BehavioralFactoriesStatus> => {
  const resolvedWorkspaceRoot = workspaceRoot ?? (await resolveWorkspaceRoot())
  const programFile = Bun.file(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_FACTORIES_PROGRAM_PATH }),
  )
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const outputFiles = await countFiles(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_FACTORIES_OUTPUT_PATH }),
  )
  const upstreamStatus = await validateBehavioralFactoriesUpstream({ workspaceRoot: resolvedWorkspaceRoot })

  const requirements = await Promise.all(
    BEHAVIORAL_FACTORIES_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await pathExists(
        resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: requirement.path }),
      ),
    })),
  )

  return {
    name: 'behavioral-factories',
    programPath: BEHAVIORAL_FACTORIES_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    outputRoot: BEHAVIORAL_FACTORIES_OUTPUT_PATH,
    outputFiles,
    upstreamStatus,
    requirements,
  }
}

export const isBehavioralFactoriesValid = (status: BehavioralFactoriesStatus): boolean =>
  status.programExists &&
  status.programNonEmpty &&
  status.upstreamStatus.semanticUpstreamValid &&
  status.requirements.every((requirement) => requirement.exists)

export const renderBehavioralFactoriesStatus = (status: BehavioralFactoriesStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `outputRoot: ${status.outputRoot}`,
    `outputFiles: ${status.outputFiles}`,
    `mssSeedDocs: ${status.upstreamStatus.mssSeedDocs}`,
    `mssCorpusDocs: ${status.upstreamStatus.mssCorpusDocs}`,
    `behavioralSeedDocs: ${status.upstreamStatus.behavioralSeedDocs}`,
    `behavioralCorpusDocs: ${status.upstreamStatus.behavioralCorpusDocs}`,
    `semanticUpstreamValid: ${status.upstreamStatus.semanticUpstreamValid ? 'yes' : 'no'}`,
    ...(status.upstreamStatus.semanticIssues.length > 0
      ? ['semanticIssues:', ...status.upstreamStatus.semanticIssues.map((issue) => `- ${issue}`)]
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
