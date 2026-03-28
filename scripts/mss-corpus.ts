import { join } from 'node:path'
import type { ResearchLaneConfig } from './autoresearch-runner.ts'
import { buildDocChunks } from './mss-doc-chunks.ts'
import { buildReport } from './mss-source-compare.ts'

export type ProgramRequirement = {
  label: string
  path: string
}

export type RequirementStatus = ProgramRequirement & {
  exists: boolean
}

export type MssCorpusStatus = {
  name: 'mss-corpus'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  seedPath: string
  seedDocs: number
  encodedPath: string
  encodedDocs: number
  artifactPath: string
  artifactFiles: number
  requirements: RequirementStatus[]
}

export const MSS_CORPUS_PROGRAM_PATH = join('dev-research', 'mss-corpus', 'program.md')
export const MSS_SEED_PATH = join('dev-research', 'mss-seed', 'seed')
export const MSS_CORPUS_ENCODED_PATH = join('dev-research', 'mss-corpus', 'encoded')
export const MSS_CORPUS_ARTIFACTS_PATH = join('dev-research', 'mss-corpus', 'artifacts')
export const MSS_CORPUS_CHUNKS_PATH = join(MSS_CORPUS_ARTIFACTS_PATH, 'chunks.jsonl')
export const MSS_CORPUS_COMPARE_REPORT_PATH = join(MSS_CORPUS_ARTIFACTS_PATH, 'source-compare.json')
export const MSS_CORPUS_MANIFEST_PATH = join(MSS_CORPUS_ENCODED_PATH, 'manifest.json')
export const DEFAULT_MSS_CORPUS_WITH_EMBEDDINGS = true
export const DEFAULT_MSS_CORPUS_WITH_LLM = true
export const MSS_CORPUS_SYSTEM_PROMPT = `You are working on the mss-corpus lane.

Your job is to encode MSS and Modnet source material into a graph-ready corpus that depends on seed anchors.
Prefer source chunks, distilled assertions, provenance, and retrieval-ready structure over abstract ontology expansion.
Do not drift into unrelated repo improvement or support-surface rewrites.`

export type GenerateMssCorpusArtifactsOptions = {
  workspaceRoot?: string
  docPaths?: string[]
  markdownPaths?: string[]
  artifactDir?: string
  encodedDir?: string
  seedPath?: string
  withEmbeddings?: boolean
  withLlm?: boolean
}

type MssCorpusLaneConfig = ResearchLaneConfig & {
  sourceDocs: string[]
  compareMarkdownPaths: string[]
}

export const RESEARCH_LANE_CONFIG = {
  key: 'mss-corpus',
  scriptPath: 'scripts/mss-corpus.ts',
  programPath: MSS_CORPUS_PROGRAM_PATH,
  validateCommand: ['bun', 'scripts/mss-corpus.ts', 'validate'],
  writableRoots: [join('dev-research', 'mss-corpus')],
  skills: [
    join('skills', 'mss'),
    join('skills', 'modnet-node'),
    join('skills', 'modnet-modules'),
    join('skills', 'hypergraph-memory'),
    join('skills', 'youdotcom-api'),
  ],
  model: 'openrouter/minimax/minimax-m2.7',
  systemPrompt: MSS_CORPUS_SYSTEM_PROMPT,
  taskPrompt:
    'Improve the mss-corpus lane artifacts. Produce lane-local encoded corpus artifacts that depend on mss-seed anchors rather than raw ad hoc concepts. Do not edit src/tools. Run the lane validator before finishing and summarize what changed.',
  defaultAttempts: 15,
  defaultParallelism: 3,
  evaluation: {
    graderPath: 'scripts/mss-corpus-grader.ts',
    verifierPath: 'scripts/mss-corpus-verifier.ts',
    useMetaVerification: true,
    hint: 'Prefer lane-bounded corpus outputs with encoded/artifact evidence, source-backed structure, and seed-aligned semantics. Penalize ontology drift and weak corpus evidence.',
  },
  sourceDocs: [join('docs', 'Structural-IA.md'), join('docs', 'Modnet.md'), join('docs', 'MODNET-IMPLEMENTATION.md')],
  compareMarkdownPaths: [
    join('skills', 'mss', 'SKILL.md'),
    join('skills', 'mss', 'references', 'dynamics-distilled.md'),
    join('skills', 'mss', 'references', 'modnet-standards-distilled.md'),
    join('skills', 'mss', 'references', 'structural-ia-distilled.md'),
    join('skills', 'mss', 'references', 'valid-combinations.md'),
    join('skills', 'modnet-node', 'SKILL.md'),
    join('skills', 'modnet-modules', 'SKILL.md'),
  ],
} satisfies MssCorpusLaneConfig

export const MSS_CORPUS_REQUIREMENTS: readonly ProgramRequirement[] = [
  { label: 'MSS seed program', path: join('dev-research', 'mss-seed', 'program.md') },
  { label: 'MSS seed output', path: MSS_SEED_PATH },
  { label: 'MSS skill', path: join('skills', 'mss', 'SKILL.md') },
  { label: 'Modnet node skill', path: join('skills', 'modnet-node', 'SKILL.md') },
  { label: 'Modnet modules skill', path: join('skills', 'modnet-modules', 'SKILL.md') },
  { label: 'Structural IA doc', path: join('docs', 'Structural-IA.md') },
  { label: 'Modnet doc', path: join('docs', 'Modnet.md') },
  { label: 'Modnet implementation doc', path: join('docs', 'MODNET-IMPLEMENTATION.md') },
  { label: 'Chunking helper', path: join('scripts', 'mss-doc-chunks.ts') },
  { label: 'Compare helper', path: join('scripts', 'mss-source-compare.ts') },
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

const writeDocChunksJsonl = async ({
  outputPath,
  files,
  artifactDir,
}: {
  outputPath: string
  files: Awaited<ReturnType<typeof buildDocChunks>>
  artifactDir: string
}) => {
  await Bun.$`mkdir -p ${artifactDir}`.quiet()
  const rows = files.flatMap((file) =>
    file.sections.map((section) =>
      JSON.stringify({
        sourcePath: section.sourcePath,
        heading: section.heading,
        headingPath: section.headingPath,
        kind: section.kind,
        text: section.text,
        xml: section.xml,
      }),
    ),
  )

  await Bun.write(outputPath, `${rows.join('\n')}${rows.length > 0 ? '\n' : ''}`)
}

export const generateMssCorpusArtifacts = async (options: GenerateMssCorpusArtifactsOptions = {}) => {
  const laneConfig = RESEARCH_LANE_CONFIG as MssCorpusLaneConfig
  const workspaceRoot = options.workspaceRoot ?? (await resolveWorkspaceRoot())
  const artifactDir =
    options.artifactDir ?? resolveWorkspacePath({ workspaceRoot, relativePath: MSS_CORPUS_ARTIFACTS_PATH })
  const encodedDir =
    options.encodedDir ?? resolveWorkspacePath({ workspaceRoot, relativePath: MSS_CORPUS_ENCODED_PATH })
  const seedPath = options.seedPath ?? resolveWorkspacePath({ workspaceRoot, relativePath: MSS_SEED_PATH })
  const withEmbeddings = options.withEmbeddings ?? DEFAULT_MSS_CORPUS_WITH_EMBEDDINGS
  const withLlm = options.withLlm ?? DEFAULT_MSS_CORPUS_WITH_LLM
  const chunkOutputPath = join(artifactDir, 'chunks.jsonl')
  const compareOutputPath = join(artifactDir, 'source-compare.json')
  const manifestPath = join(encodedDir, 'manifest.json')
  const docPaths =
    options.docPaths ?? laneConfig.sourceDocs.map((path) => resolveWorkspacePath({ workspaceRoot, relativePath: path }))
  const files = await buildDocChunks(docPaths)
  await writeDocChunksJsonl({ outputPath: chunkOutputPath, files, artifactDir })

  const report = await buildReport({
    chunkPath: chunkOutputPath,
    markdownPaths:
      options.markdownPaths ??
      laneConfig.compareMarkdownPaths.map((path) => resolveWorkspacePath({ workspaceRoot, relativePath: path })),
    pairLimit: 40,
    withEmbeddings,
    withLlm,
  })

  await Bun.$`mkdir -p ${encodedDir}`.quiet()
  await Bun.write(compareOutputPath, `${JSON.stringify(report, null, 2)}\n`)
  await Bun.write(
    manifestPath,
    `${JSON.stringify(
      {
        seedPath,
        chunkPath: chunkOutputPath,
        compareReportPath: compareOutputPath,
        sections: report.totals.sections,
        deterministicPairs: report.totals.deterministicPairs,
        withEmbeddings,
        withLlm,
      },
      null,
      2,
    )}\n`,
  )

  return {
    chunkOutputPath,
    compareOutputPath,
    manifestPath,
    docFiles: files.length,
    sections: files.reduce((count, file) => count + file.sections.length, 0),
    deterministicPairs: report.totals.deterministicPairs,
    withEmbeddings,
    withLlm,
  }
}

export const getMssCorpusStatus = async ({
  workspaceRoot,
}: {
  workspaceRoot?: string
} = {}): Promise<MssCorpusStatus> => {
  const resolvedWorkspaceRoot = workspaceRoot ?? (await resolveWorkspaceRoot())
  const programFile = Bun.file(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_CORPUS_PROGRAM_PATH }),
  )
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const seedDocs = await countJsonLdDocs(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_SEED_PATH }),
  )
  const encodedDocs = await countJsonLdDocs(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_CORPUS_ENCODED_PATH }),
  )
  const artifactFiles = await countFiles(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_CORPUS_ARTIFACTS_PATH }),
  )

  const requirements = await Promise.all(
    MSS_CORPUS_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await pathExists(
        resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: requirement.path }),
      ),
    })),
  )

  return {
    name: 'mss-corpus',
    programPath: MSS_CORPUS_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    seedPath: MSS_SEED_PATH,
    seedDocs,
    encodedPath: MSS_CORPUS_ENCODED_PATH,
    encodedDocs,
    artifactPath: MSS_CORPUS_ARTIFACTS_PATH,
    artifactFiles,
    requirements,
  }
}

export const isMssCorpusValid = (status: MssCorpusStatus): boolean =>
  status.programExists && status.programNonEmpty && status.requirements.every((requirement) => requirement.exists)

export const renderMssCorpusStatus = (status: MssCorpusStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `seedPath: ${status.seedPath}`,
    `seedDocs: ${status.seedDocs}`,
    `encodedPath: ${status.encodedPath}`,
    `encodedDocs: ${status.encodedDocs}`,
    `artifactPath: ${status.artifactPath}`,
    `artifactFiles: ${status.artifactFiles}`,
    'requirements:',
    ...status.requirements.map(
      (requirement) => `- ${requirement.label}: ${requirement.exists ? 'ok' : 'missing'} (${requirement.path})`,
    ),
  ]

  return lines.join('\n')
}

const main = async () => {
  const command = Bun.argv[2] ?? 'status'
  const status = await getMssCorpusStatus()

  if (command === 'status') {
    console.log(renderMssCorpusStatus(status))
    return
  }

  if (command === 'validate') {
    console.log(renderMssCorpusStatus(status))
    if (!isMssCorpusValid(status)) {
      process.exitCode = 1
    }
    return
  }

  if (command === 'generate') {
    const summary = await generateMssCorpusArtifacts()
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.error('Usage: bun scripts/mss-corpus.ts [status|validate|generate]')
  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
