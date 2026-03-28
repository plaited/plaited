import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateMssSeedArtifacts,
  getMssSeedStatus,
  isMssSeedValid,
  MSS_SEED_PATH,
  MSS_SEED_PROGRAM_PATH,
  renderMssSeedStatus,
} from '../mss-seed.ts'

describe('mss-seed script', () => {
  test('reports the configured program path', async () => {
    const status = await getMssSeedStatus()

    expect(status.programPath).toBe(MSS_SEED_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getMssSeedStatus()
    const output = renderMssSeedStatus(status)

    expect(output).toContain('program: mss-seed')
    expect(output).toContain(`programPath: ${MSS_SEED_PROGRAM_PATH}`)
    expect(output).toContain(`laneSeedPath: ${MSS_SEED_PATH}`)
    expect(output).toContain('artifactPath:')
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getMssSeedStatus()

    expect(status.programExists).toBe(true)
    expect(status.programNonEmpty).toBe(true)
    expect(isMssSeedValid(status)).toBe(true)
  })

  test('generate writes chunk and compare artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-mss-seed-'))
    const artifactDir = join(root, 'artifacts')
    const result = await generateMssSeedArtifacts({
      artifactDir,
      withEmbeddings: false,
      withLlm: false,
    })
    const chunkExists = await Bun.file(result.chunkOutputPath).exists()
    const compareExists = await Bun.file(result.compareOutputPath).exists()

    expect(result.sections).toBeGreaterThan(0)
    expect(result.deterministicPairs).toBeGreaterThanOrEqual(0)
    expect(result.withLlm).toBe(false)
    expect(chunkExists).toBe(true)
    expect(compareExists).toBe(true)

    await rm(root, { force: true, recursive: true })
  })
})
