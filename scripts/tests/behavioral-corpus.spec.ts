import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BEHAVIORAL_CORPUS_ENCODED_PATH,
  BEHAVIORAL_CORPUS_PROGRAM_PATH,
  BEHAVIORAL_SEED_PATH,
  getBehavioralCorpusStatus,
  isBehavioralCorpusValid,
  RESEARCH_LANE_CONFIG,
  renderBehavioralCorpusStatus,
  resolveWorkspaceRoot,
  validateBehavioralCorpusSemantics,
} from '../behavioral-corpus.ts'

describe('behavioral-corpus script', () => {
  test('reports the configured program path', async () => {
    const status = await getBehavioralCorpusStatus()

    expect(status.programPath).toBe(BEHAVIORAL_CORPUS_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getBehavioralCorpusStatus()
    const output = renderBehavioralCorpusStatus(status)

    expect(output).toContain('program: behavioral-corpus')
    expect(output).toContain(`programPath: ${BEHAVIORAL_CORPUS_PROGRAM_PATH}`)
    expect(output).toContain(`seedPath: ${BEHAVIORAL_SEED_PATH}`)
    expect(output).toContain(`encodedPath: ${BEHAVIORAL_CORPUS_ENCODED_PATH}`)
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getBehavioralCorpusStatus()

    expect(status.programExists).toBe(true)
    expect(status.programNonEmpty).toBe(true)
    expect(isBehavioralCorpusValid(status)).toBe(false)
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('exports an autoresearch lane config', () => {
    expect(RESEARCH_LANE_CONFIG.scriptPath).toBe('scripts/behavioral-corpus.ts')
    expect(RESEARCH_LANE_CONFIG.validateCommand).toEqual(['bun', 'scripts/behavioral-corpus.ts', 'validate'])
    expect(RESEARCH_LANE_CONFIG.writableRoots).toEqual(['dev-research/behavioral-corpus'])
    expect(RESEARCH_LANE_CONFIG.defaultAttempts).toBe(20)
    expect(RESEARCH_LANE_CONFIG.defaultParallelism).toBe(3)
  })

  test('semantic validation requires encoded corpus to reference behavioral seed anchors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-behavioral-corpus-semantic-'))
    const seedDir = join(root, 'dev-research', 'behavioral-seed', 'seed')
    const encodedDir = join(root, 'dev-research', 'behavioral-corpus', 'encoded')
    await Bun.$`mkdir -p ${seedDir} ${encodedDir}`.quiet()
    await Bun.write(
      join(seedDir, 'seed.jsonld'),
      `${JSON.stringify({
        '@context': { '@vocab': 'https://plaited.dev/behavioral-seed/' },
        '@graph': [{ '@id': 'behavioral:anchor/bthread', '@type': 'behavioral:Anchor' }],
      })}\n`,
    )
    await Bun.write(
      join(encodedDir, 'encoded.jsonld'),
      `${JSON.stringify({
        '@context': { '@vocab': 'https://plaited.dev/behavioral-corpus/' },
        '@graph': [
          {
            '@id': 'behavioral-corpus:chunk/1',
            '@type': 'behavioral:EncodedChunk',
            provenance: ['skills/behavioral-core/SKILL.md'],
            description: 'behavioral and constitution governance evidence',
            seedRefs: [{ '@id': 'behavioral:anchor/bthread' }],
          },
        ],
      })}\n`,
    )

    const semantic = await validateBehavioralCorpusSemantics({ workspaceRoot: root })

    expect(semantic.valid).toBe(true)
    expect(semantic.issues).toEqual([])

    await rm(root, { force: true, recursive: true })
  })
})
