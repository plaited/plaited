import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BEHAVIORAL_SEED_PROGRAM_PATH,
  BEHAVIORAL_SEED_SYSTEM_PROMPT,
  getBehavioralSeedStatus,
  isBehavioralSeedValid,
  RESEARCH_LANE_CONFIG,
  renderBehavioralSeedStatus,
  resolveWorkspaceRoot,
  validateBehavioralSeedSemantics,
} from '../behavioral-seed.ts'

describe('behavioral-seed script', () => {
  test('reports the configured program path', async () => {
    const status = await getBehavioralSeedStatus()

    expect(status.programPath).toBe(BEHAVIORAL_SEED_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getBehavioralSeedStatus()
    const output = renderBehavioralSeedStatus(status)

    expect(output).toContain('program: behavioral-seed')
    expect(output).toContain(`programPath: ${BEHAVIORAL_SEED_PROGRAM_PATH}`)
    expect(output).toContain('laneSeedPath:')
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getBehavioralSeedStatus()

    expect(status.programExists).toBe(true)
    expect(status.programNonEmpty).toBe(true)
    expect(isBehavioralSeedValid(status)).toBe(true)
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('exports an autoresearch lane config', () => {
    expect(RESEARCH_LANE_CONFIG.scriptPath).toBe('scripts/behavioral-seed.ts')
    expect(RESEARCH_LANE_CONFIG.validateCommand).toEqual(['bun', 'scripts/behavioral-seed.ts', 'validate'])
    expect(RESEARCH_LANE_CONFIG.writableRoots).toEqual(['dev-research/behavioral-seed'])
    expect(RESEARCH_LANE_CONFIG.defaultAttempts).toBe(20)
    expect(RESEARCH_LANE_CONFIG.defaultParallelism).toBe(3)
    expect(RESEARCH_LANE_CONFIG.systemPrompt).toBe(BEHAVIORAL_SEED_SYSTEM_PROMPT)
  })

  test('semantic validation checks behavioral anchors and linkage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-behavioral-seed-semantic-'))
    const seedDir = join(root, 'dev-research', 'behavioral-seed', 'seed')
    await Bun.$`mkdir -p ${seedDir}`.quiet()
    await Bun.write(
      join(seedDir, 'seed.jsonld'),
      `${JSON.stringify(
        {
          '@context': { '@vocab': 'https://plaited.dev/behavioral-seed/' },
          '@graph': [
            { '@id': 'behavioral:anchor/behavioral', '@type': 'behavioral:Anchor', label: 'behavioral' },
            { '@id': 'behavioral:anchor/bthread', '@type': 'behavioral:Anchor', label: 'bthread' },
            { '@id': 'behavioral:anchor/bsync', '@type': 'behavioral:Anchor', label: 'bsync' },
            { '@id': 'behavioral:anchor/governance', '@type': 'behavioral:Anchor', label: 'governance' },
            { '@id': 'constitution:anchor/constitution', '@type': 'constitution:Anchor', label: 'constitution' },
            {
              '@id': 'behavioral:rule/coordination',
              '@type': 'behavioral:Invariant',
              'behavioral:rule': 'behavioral bthread and bsync coordination stays bounded under governance',
              'behavioral:derivedFrom': ['skills/behavioral-core/SKILL.md'],
            },
            {
              '@id': 'behavioral:pattern/factory',
              '@type': 'behavioral:Pattern',
              description: 'behavioral factory pattern with bthread and bsync under constitution governance',
              refs: [{ '@id': 'behavioral:anchor/bthread' }],
            },
          ],
        },
        null,
        2,
      )}\n`,
    )

    const semantic = await validateBehavioralSeedSemantics({ workspaceRoot: root })

    expect(semantic.valid).toBe(true)
    expect(semantic.issues).toEqual([])

    await rm(root, { force: true, recursive: true })
  })
})
