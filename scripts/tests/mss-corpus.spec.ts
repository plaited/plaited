import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateMssCorpusArtifacts,
  getMssCorpusStatus,
  isMssCorpusValid,
  MSS_CORPUS_ENCODED_PATH,
  MSS_CORPUS_PROGRAM_PATH,
  MSS_SEED_PATH,
  renderMssCorpusStatus,
  resolveWorkspaceRoot,
  validateMssCorpusSemantics,
} from '../mss-corpus.ts'

describe('mss-corpus script', () => {
  test('reports the configured program path', async () => {
    const status = await getMssCorpusStatus()

    expect(status.programPath).toBe(MSS_CORPUS_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getMssCorpusStatus()
    const output = renderMssCorpusStatus(status)

    expect(output).toContain('program: mss-corpus')
    expect(output).toContain(`programPath: ${MSS_CORPUS_PROGRAM_PATH}`)
    expect(output).toContain(`seedPath: ${MSS_SEED_PATH}`)
    expect(output).toContain(`encodedPath: ${MSS_CORPUS_ENCODED_PATH}`)
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getMssCorpusStatus()

    expect(status.programExists).toBe(true)
    expect(status.programNonEmpty).toBe(true)
    expect(isMssCorpusValid(status)).toBe(false)
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('generate writes compare artifacts and encoded manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-mss-corpus-'))
    const artifactDir = join(root, 'artifacts')
    const encodedDir = join(root, 'encoded')
    const seedDir = join(root, 'seed')
    await Bun.$`mkdir -p ${seedDir}`.quiet()
    await Bun.write(join(seedDir, 'placeholder.jsonld'), '{}\n')
    const result = await generateMssCorpusArtifacts({
      artifactDir,
      encodedDir,
      seedPath: seedDir,
      withEmbeddings: false,
      withLlm: false,
    })
    const compareExists = await Bun.file(result.compareOutputPath).exists()
    const manifestExists = await Bun.file(result.manifestPath).exists()

    expect(result.sections).toBeGreaterThan(0)
    expect(result.deterministicPairs).toBeGreaterThanOrEqual(0)
    expect(result.withEmbeddings).toBe(false)
    expect(result.withLlm).toBe(false)
    expect(compareExists).toBe(true)
    expect(manifestExists).toBe(true)

    await rm(root, { force: true, recursive: true })
  })

  test('status resolves lane paths inside an overridden workspace root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-mss-corpus-workspace-'))
    await Bun.$`mkdir -p ${join(root, 'dev-research', 'mss-corpus')} ${join(root, 'dev-research', 'mss-seed')}`.quiet()
    await Bun.write(join(root, 'dev-research', 'mss-corpus', 'program.md'), '# temp corpus program\n')
    await Bun.write(join(root, 'dev-research', 'mss-seed', 'program.md'), '# temp seed program\n')
    const status = await getMssCorpusStatus({ workspaceRoot: root })

    expect(status.programExists).toBe(true)
    expect(status.programPath).toBe(MSS_CORPUS_PROGRAM_PATH)

    await rm(root, { force: true, recursive: true })
  })

  test('semantic validation requires encoded corpus to reference seed anchors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-mss-corpus-semantic-'))
    const seedDir = join(root, 'dev-research', 'mss-seed', 'seed')
    const encodedDir = join(root, 'dev-research', 'mss-corpus', 'encoded')
    await Bun.$`mkdir -p ${seedDir} ${encodedDir}`.quiet()
    await Bun.write(
      join(seedDir, 'seed.jsonld'),
      `${JSON.stringify({
        '@context': { '@vocab': 'https://plaited.dev/mss-seed/' },
        '@graph': [{ '@id': 'mss:field/contentType', '@type': 'mss:Field' }],
      })}\n`,
    )
    await Bun.write(
      join(encodedDir, 'encoded.jsonld'),
      `${JSON.stringify({
        '@context': { '@vocab': 'https://plaited.dev/mss-corpus/' },
        '@graph': [
          {
            '@id': 'mss-corpus:chunk/1',
            '@type': 'mss:EncodedChunk',
            provenance: ['skills/mss/SKILL.md'],
            seedRefs: [{ '@id': 'mss:field/contentType' }],
          },
        ],
      })}\n`,
    )

    const semantic = await validateMssCorpusSemantics({ workspaceRoot: root })

    expect(semantic.valid).toBe(true)
    expect(semantic.issues).toEqual([])

    await rm(root, { force: true, recursive: true })
  })
})
