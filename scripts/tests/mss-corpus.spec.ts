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

  test('generate writes compare artifacts and encoded manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-mss-corpus-'))
    const artifactDir = join(root, 'artifacts')
    const encodedDir = join(root, 'encoded')
    const seedDir = join(root, 'seed')
    await Bun.$`mkdir -p ${seedDir}`.quiet()
    await Bun.write(join(seedDir, 'placeholder.jsonld'), '{}\n')
    const result = await generateMssCorpusArtifacts({ artifactDir, encodedDir, seedPath: seedDir })
    const compareExists = await Bun.file(result.compareOutputPath).exists()
    const manifestExists = await Bun.file(result.manifestPath).exists()

    expect(result.sections).toBeGreaterThan(0)
    expect(result.deterministicPairs).toBeGreaterThanOrEqual(0)
    expect(compareExists).toBe(true)
    expect(manifestExists).toBe(true)

    await rm(root, { force: true, recursive: true })
  })
})
