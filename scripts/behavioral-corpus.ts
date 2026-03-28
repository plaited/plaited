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

export type BehavioralCorpusStatus = {
  name: 'behavioral-corpus'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  seedPath: string
  seedDocs: number
  encodedPath: string
  encodedDocs: number
  semanticCorpusValid: boolean
  semanticIssues: string[]
  artifactPath: string
  artifactFiles: number
  requirements: RequirementStatus[]
}

type JsonLdNode = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const collectJsonLdNodes = (document: JsonLdNode): JsonLdNode[] => {
  const graph = document['@graph']
  const nodes = Array.isArray(graph) ? graph.filter(isRecord) : []
  return [document, ...nodes]
}

export const validateBehavioralCorpusSemantics = async ({
  workspaceRoot,
  seedPath = BEHAVIORAL_SEED_PATH,
  encodedPath = BEHAVIORAL_CORPUS_ENCODED_PATH,
}: {
  workspaceRoot: string
  seedPath?: string
  encodedPath?: string
}) => {
  const resolvedSeedPath = resolveWorkspacePath({ workspaceRoot, relativePath: seedPath })
  const resolvedEncodedPath = resolveWorkspacePath({ workspaceRoot, relativePath: encodedPath })
  const issues: string[] = []

  if (!(await pathExists(resolvedEncodedPath))) {
    return { valid: true, issues }
  }

  const encodedDocs = (await loadJsonLd(resolvedEncodedPath)) as JsonLdNode[]
  if (encodedDocs.length === 0) {
    return { valid: true, issues }
  }

  const seedDocs = (await loadJsonLd(resolvedSeedPath).catch(() => [])) as JsonLdNode[]
  const seedIds = new Set(
    seedDocs
      .flatMap((document) => collectJsonLdNodes(document))
      .map((node) => (typeof node['@id'] === 'string' ? node['@id'] : ''))
      .filter(Boolean),
  )

  const encodedNodes = encodedDocs.flatMap((document) => collectJsonLdNodes(document))
  const encodedText = encodedNodes.map((node) => JSON.stringify(node).toLowerCase()).join('\n')

  if (!encodedText.includes('source') && !encodedText.includes('provenance') && !encodedText.includes('derivedfrom')) {
    issues.push('missing source-backed provenance in encoded behavioral corpus')
  }

  if (
    !encodedText.includes('behavioral') &&
    !encodedText.includes('constitution') &&
    !encodedText.includes('governance')
  ) {
    issues.push('encoded behavioral corpus does not express behavioral or constitution semantics')
  }

  const seedReferences = [...seedIds].filter((seedId) => encodedText.includes(seedId.toLowerCase()))
  if (seedIds.size > 0 && seedReferences.length === 0) {
    issues.push('encoded behavioral corpus does not reference any behavioral seed anchors')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export const BEHAVIORAL_CORPUS_PROGRAM_PATH = join('dev-research', 'behavioral-corpus', 'program.md')
export const BEHAVIORAL_SEED_PATH = join('dev-research', 'behavioral-seed', 'seed')
export const BEHAVIORAL_CORPUS_ENCODED_PATH = join('dev-research', 'behavioral-corpus', 'encoded')
export const BEHAVIORAL_CORPUS_ARTIFACTS_PATH = join('dev-research', 'behavioral-corpus', 'artifacts')
export const BEHAVIORAL_CORPUS_SYSTEM_PROMPT = `You are working on the behavioral-corpus lane.

Your job is to encode behavioral-core and constitution source material into a graph-ready corpus that depends on behavioral seed anchors.
Treat dev-research/behavioral-seed/seed as the semantic frame first, and treat raw behavioral and constitution sources as evidence to be encoded under that frame.
Do not treat raw source material as a parallel ontology source unless seed insufficiency is explicit and justified.`

export const RESEARCH_LANE_CONFIG = {
  key: 'behavioral-corpus',
  scriptPath: 'scripts/behavioral-corpus.ts',
  programPath: BEHAVIORAL_CORPUS_PROGRAM_PATH,
  validateCommand: ['bun', 'scripts/behavioral-corpus.ts', 'validate'],
  writableRoots: [join('dev-research', 'behavioral-corpus')],
  skills: [
    join('skills', 'behavioral-core'),
    join('skills', 'constitution'),
    join('skills', 'hypergraph-memory'),
    join('skills', 'youdotcom-api'),
  ],
  model: 'openrouter/minimax/minimax-m2.7',
  systemPrompt: BEHAVIORAL_CORPUS_SYSTEM_PROMPT,
  taskPrompt:
    'Improve the behavioral-corpus lane artifacts. Use behavioral-seed as the semantic frame, and encode raw behavioral and constitution source material as evidence under that frame. Produce lane-local encoded corpus artifacts rather than raw ad hoc concepts. Do not edit src/tools. Run the lane validator before finishing and summarize what changed, including any explicit seed insufficiency.',
  defaultAttempts: 20,
  defaultParallelism: 3,
  evaluation: {
    graderPath: 'scripts/behavioral-corpus-grader.ts',
    verifierPath: 'scripts/behavioral-corpus-verifier.ts',
    useMetaVerification: true,
    hint: 'Prefer lane-bounded corpus outputs with encoded evidence, source-backed structure, and behavioral-seed-aligned semantics. Penalize ontology drift and weak corpus evidence.',
  },
} satisfies ResearchLaneConfig

export const BEHAVIORAL_CORPUS_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'Behavioral seed program', path: join('dev-research', 'behavioral-seed', 'program.md') },
  { label: 'Behavioral seed output', path: BEHAVIORAL_SEED_PATH },
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

export const getBehavioralCorpusStatus = async ({
  workspaceRoot,
}: {
  workspaceRoot?: string
} = {}): Promise<BehavioralCorpusStatus> => {
  const resolvedWorkspaceRoot = workspaceRoot ?? (await resolveWorkspaceRoot())
  const programFile = Bun.file(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_CORPUS_PROGRAM_PATH }),
  )
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const seedDocs = await countJsonLdDocs(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_SEED_PATH }),
  )
  const encodedDocs = await countJsonLdDocs(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_CORPUS_ENCODED_PATH }),
  )
  const semanticValidation = await validateBehavioralCorpusSemantics({ workspaceRoot: resolvedWorkspaceRoot })
  const artifactFiles = await countFiles(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: BEHAVIORAL_CORPUS_ARTIFACTS_PATH }),
  )

  const requirements = await Promise.all(
    BEHAVIORAL_CORPUS_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await pathExists(
        resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: requirement.path }),
      ),
    })),
  )

  return {
    name: 'behavioral-corpus',
    programPath: BEHAVIORAL_CORPUS_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    seedPath: BEHAVIORAL_SEED_PATH,
    seedDocs,
    encodedPath: BEHAVIORAL_CORPUS_ENCODED_PATH,
    encodedDocs,
    semanticCorpusValid: semanticValidation.valid,
    semanticIssues: semanticValidation.issues,
    artifactPath: BEHAVIORAL_CORPUS_ARTIFACTS_PATH,
    artifactFiles,
    requirements,
  }
}

export const isBehavioralCorpusValid = (status: BehavioralCorpusStatus): boolean =>
  status.programExists &&
  status.programNonEmpty &&
  status.requirements.every((requirement) => requirement.exists) &&
  (status.encodedDocs === 0 || status.semanticCorpusValid)

export const renderBehavioralCorpusStatus = (status: BehavioralCorpusStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `seedPath: ${status.seedPath}`,
    `seedDocs: ${status.seedDocs}`,
    `encodedPath: ${status.encodedPath}`,
    `encodedDocs: ${status.encodedDocs}`,
    `semanticCorpusValid: ${status.semanticCorpusValid ? 'yes' : 'no'}`,
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
  const status = await getBehavioralCorpusStatus()

  if (command === 'status') {
    console.log(renderBehavioralCorpusStatus(status))
    return
  }

  if (command === 'validate') {
    console.log(renderBehavioralCorpusStatus(status))
    if (!isBehavioralCorpusValid(status)) {
      process.exitCode = 1
    }
    return
  }

  console.error('Usage: bun scripts/behavioral-corpus.ts [status|validate]')
  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
