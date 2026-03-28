import { join } from 'node:path'
import type { ResearchLaneConfig } from './autoresearch-runner.ts'
import { buildDocChunks } from './mss-doc-chunks.ts'
import { buildReport, DEFAULT_MSS_COMPARE_EMBEDDING_MODEL } from './mss-source-compare.ts'

export type ProgramRequirement = {
  label: string
  path: string
}

export type RequirementStatus = ProgramRequirement & {
  exists: boolean
}

export type MssSeedStatus = {
  name: 'mss-seed'
  programPath: string
  programExists: boolean
  programNonEmpty: boolean
  laneSeedPath: string
  laneSeedDocs: number
  artifactPath: string
  artifactFiles: number
  requirements: RequirementStatus[]
}

export const MSS_SEED_PROGRAM_PATH = join('dev-research', 'mss-seed', 'program.md')
export const MSS_SEED_PATH = join('dev-research', 'mss-seed', 'seed')
export const MSS_SEED_ARTIFACTS_PATH = join('dev-research', 'mss-seed', 'artifacts')
export const MSS_SEED_CHUNKS_PATH = join(MSS_SEED_ARTIFACTS_PATH, 'chunks.jsonl')
export const MSS_SEED_COMPARE_REPORT_PATH = join(MSS_SEED_ARTIFACTS_PATH, 'source-compare.json')
export const DEFAULT_MSS_SEED_WITH_EMBEDDINGS = false
export const DEFAULT_MSS_SEED_WITH_LLM = true
export const MSS_SEED_SYSTEM_PROMPT = `You are working on the mss-seed lane.

Your job is to derive a compact, reviewable seed ontology from MSS and Modnet sources.
Prefer durable anchors, invariants, and downstream corpus-enabling concepts over broad registries.
Do not drift into general repo improvement or unrelated framework work.`

export type GenerateMssSeedArtifactsOptions = {
  workspaceRoot?: string
  docPaths?: string[]
  markdownPaths?: string[]
  artifactDir?: string
  withEmbeddings?: boolean
  withLlm?: boolean
}

type MssSeedLaneConfig = ResearchLaneConfig & {
  sourceDocs: string[]
  compareMarkdownPaths: string[]
}

export const RESEARCH_LANE_CONFIG = {
  key: 'mss-seed',
  scriptPath: 'scripts/mss-seed.ts',
  programPath: MSS_SEED_PROGRAM_PATH,
  validateCommand: ['bun', 'scripts/mss-seed.ts', 'validate'],
  writableRoots: [join('dev-research', 'mss-seed')],
  skills: [
    join('skills', 'mss'),
    join('skills', 'modnet-node'),
    join('skills', 'modnet-modules'),
    join('skills', 'youdotcom-api'),
  ],
  model: 'openrouter/minimax/minimax-m2.7',
  systemPrompt: MSS_SEED_SYSTEM_PROMPT,
  taskPrompt:
    'Improve the mss-seed lane artifacts. Produce or refine a compact lane-local seed ontology for downstream corpus encoding. Do not edit src/tools. Run the lane validator before finishing and summarize what changed.',
  defaultAttempts: 20,
  defaultParallelism: 3,
  evaluation: {
    graderPath: 'scripts/mss-seed-grader.ts',
    verifierPath: 'scripts/mss-seed-verifier.ts',
    useMetaVerification: true,
    hint: 'Prefer compact, lane-bounded seed improvements with durable MSS and Modnet anchors. Penalize support-surface drift and weak seed evidence.',
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
} satisfies MssSeedLaneConfig

export const MSS_SEED_REQUIREMENTS: readonly ProgramRequirement[] = [
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

export const generateMssSeedArtifacts = async (options: GenerateMssSeedArtifactsOptions = {}) => {
  const laneConfig = RESEARCH_LANE_CONFIG as MssSeedLaneConfig
  const workspaceRoot = options.workspaceRoot ?? (await resolveWorkspaceRoot())
  const artifactDir =
    options.artifactDir ?? resolveWorkspacePath({ workspaceRoot, relativePath: MSS_SEED_ARTIFACTS_PATH })
  const chunkOutputPath = join(artifactDir, 'chunks.jsonl')
  const compareOutputPath = join(artifactDir, 'source-compare.json')
  const withEmbeddings = options.withEmbeddings ?? DEFAULT_MSS_SEED_WITH_EMBEDDINGS
  const withLlm = options.withLlm ?? DEFAULT_MSS_SEED_WITH_LLM
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

  await Bun.write(compareOutputPath, `${JSON.stringify(report, null, 2)}\n`)

  return {
    chunkOutputPath,
    compareOutputPath,
    docFiles: files.length,
    sections: files.reduce((count, file) => count + file.sections.length, 0),
    deterministicPairs: report.totals.deterministicPairs,
    withEmbeddings,
    withLlm,
    embeddingModel: DEFAULT_MSS_COMPARE_EMBEDDING_MODEL,
  }
}

export const getMssSeedStatus = async ({ workspaceRoot }: { workspaceRoot?: string } = {}): Promise<MssSeedStatus> => {
  const resolvedWorkspaceRoot = workspaceRoot ?? (await resolveWorkspaceRoot())
  const programFile = Bun.file(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_SEED_PROGRAM_PATH }),
  )
  const programExists = await programFile.exists()
  const programText = programExists ? (await programFile.text()).trim() : ''
  const laneSeedDocs = await countJsonLdDocs(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_SEED_PATH }),
  )
  const artifactFiles = await countFiles(
    resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: MSS_SEED_ARTIFACTS_PATH }),
  )

  const requirements = await Promise.all(
    MSS_SEED_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      exists: await pathExists(
        resolveWorkspacePath({ workspaceRoot: resolvedWorkspaceRoot, relativePath: requirement.path }),
      ),
    })),
  )

  return {
    name: 'mss-seed',
    programPath: MSS_SEED_PROGRAM_PATH,
    programExists,
    programNonEmpty: programText.length > 0,
    laneSeedPath: MSS_SEED_PATH,
    laneSeedDocs,
    artifactPath: MSS_SEED_ARTIFACTS_PATH,
    artifactFiles,
    requirements,
  }
}

export const isMssSeedValid = (status: MssSeedStatus): boolean =>
  status.programExists && status.programNonEmpty && status.requirements.every((requirement) => requirement.exists)

export const renderMssSeedStatus = (status: MssSeedStatus): string => {
  const lines = [
    `program: ${status.name}`,
    `programPath: ${status.programPath}`,
    `programExists: ${status.programExists ? 'yes' : 'no'}`,
    `programNonEmpty: ${status.programNonEmpty ? 'yes' : 'no'}`,
    `laneSeedPath: ${status.laneSeedPath}`,
    `laneSeedDocs: ${status.laneSeedDocs}`,
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
  const status = await getMssSeedStatus()

  if (command === 'status') {
    console.log(renderMssSeedStatus(status))
    return
  }

  if (command === 'validate') {
    console.log(renderMssSeedStatus(status))
    if (!isMssSeedValid(status)) {
      process.exitCode = 1
    }
    return
  }

  if (command === 'generate') {
    const summary = await generateMssSeedArtifacts()
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.error('Usage: bun scripts/mss-seed.ts [status|validate|generate]')
  process.exitCode = 1
}

if (import.meta.main) {
  await main()
}
