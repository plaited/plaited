import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgent } from '../../../agent.ts'
import { SEARCH_MODULE_EVENTS } from '../../search-module/search-module.constants.ts'
import { createSearchModule } from '../../search-module/search-module.ts'
import { SKILLS_MODULE_EVENTS } from '../../skills-module/skills-module.constants.ts'
import { createSkillsModule } from '../../skills-module/skills-module.ts'
import { createToolRegistryModule } from '../../tool-registry-module/tool-registry-module.ts'
import { PROJECTION_MODULE_SIGNAL_KEYS } from '../projection-module.constants.ts'
import { createProjectionModule } from '../projection-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createProjectionModule', () => {
  test('projects bounded context blocks from selected skill, search evidence, and registry state', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-projection-module-'))
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
      modules: [
        createSkillsModule({ rootDir: workspace }),
        createToolRegistryModule(),
        createSearchModule({ rootDir: workspace }),
        createProjectionModule(),
        ({ signals }) => {
          blocksSignal = signals.get(PROJECTION_MODULE_SIGNAL_KEYS.blocks) as {
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
      type: SKILLS_MODULE_EVENTS.skills_module_select,
      detail: { name: 'review-skill' },
    })
    agent.trigger({
      type: SEARCH_MODULE_EVENTS.search_module_search,
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
