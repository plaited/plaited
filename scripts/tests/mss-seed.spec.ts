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
  resolveWorkspaceRoot,
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

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
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

  test('status resolves lane paths inside an overridden workspace root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-mss-seed-workspace-'))
    await Bun.$`mkdir -p ${join(root, 'dev-research', 'mss-seed')}`.quiet()
    await Bun.write(join(root, 'dev-research', 'mss-seed', 'program.md'), '# temp program\n')
    const status = await getMssSeedStatus({ workspaceRoot: root })

    expect(status.programExists).toBe(true)
    expect(status.programPath).toBe(MSS_SEED_PROGRAM_PATH)

    await rm(root, { force: true, recursive: true })
  })
})
