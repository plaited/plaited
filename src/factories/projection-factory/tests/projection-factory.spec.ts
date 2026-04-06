import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgent } from '../../../agent.ts'
import { SEARCH_FACTORY_EVENTS } from '../../search-factory/search-factory.constants.ts'
import { createSearchFactory } from '../../search-factory/search-factory.ts'
import { SKILLS_FACTORY_EVENTS } from '../../skills-factory/skills-factory.constants.ts'
import { createSkillsFactory } from '../../skills-factory/skills-factory.ts'
import { createToolRegistryFactory } from '../../tool-registry-factory/tool-registry-factory.ts'
import { PROJECTION_FACTORY_SIGNAL_KEYS } from '../projection-factory.constants.ts'
import { createProjectionFactory } from '../projection-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createProjectionFactory', () => {
  test('projects bounded context blocks from selected skill, search evidence, and registry state', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-projection-factory-'))
    const skillDir = join(workspace, 'skills', 'review-skill')
    await mkdir(skillDir, { recursive: true })
    await Bun.write(
      join(skillDir, 'SKILL.md'),
      `---
name: review-skill
description: Review code
---

# Review Skill

Focus on correctness first.
`,
    )

    let blocksSignal: { get: () => unknown; listen: (cb: () => void) => void } | undefined
    let resolveBlocks!: () => void
    const blocksSeen = new Promise<void>((resolve) => {
      resolveBlocks = resolve
    })

    const agent = await createAgent({
      id: 'agent:projection',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        createSkillsFactory({ rootDir: workspace }),
        createToolRegistryFactory(),
        createSearchFactory({ rootDir: workspace }),
        createProjectionFactory(),
        ({ signals }) => {
          blocksSignal = signals.get(PROJECTION_FACTORY_SIGNAL_KEYS.blocks) as {
            get: () => unknown
            listen: (cb: () => void) => void
          }
          blocksSignal.listen(() => {
            const current = blocksSignal?.get() as unknown[] | null | undefined
            if ((current?.length ?? 0) >= 3) resolveBlocks()
          })
          return {}
        },
      ],
    })

    await Bun.sleep(50)

    agent.trigger({
      type: SKILLS_FACTORY_EVENTS.skills_factory_select,
      detail: { name: 'review-skill' },
    })
    agent.trigger({
      type: SEARCH_FACTORY_EVENTS.search_factory_search,
      detail: { query: 'review' },
    })

    await blocksSeen
    const blocks = (blocksSignal?.get() as Array<{ id: string; title: string }> | undefined) ?? []
    expect(blocks.map((block) => block.id)).toEqual(['selected-skill', 'search-evidence', 'capability-summary'])
    expect(blocks[0]?.title).toBe('Selected Skill')
    expect(blocks[1]?.title).toBe('Search Evidence')
    expect(blocks[2]?.title).toBe('Capability Summary')

    await rm(workspace, { recursive: true, force: true })
  })
})
