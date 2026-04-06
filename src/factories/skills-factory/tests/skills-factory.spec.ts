import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { SKILLS_FACTORY_EVENTS, SKILLS_FACTORY_SIGNAL_KEYS } from '../skills-factory.constants.ts'
import type { SkillsCatalogSchema, SkillsSelectedSignalSchema } from '../skills-factory.schemas.ts'
import { createSkillsFactory } from '../skills-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createSkillsFactory', () => {
  test('discovers valid skills into the catalog signal and emits an update event', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-skills-factory-'))
    const validSkillDir = join(workspace, 'skills', 'valid-skill')
    const invalidSkillDir = join(workspace, 'skills', 'invalid-skill')

    await mkdir(join(validSkillDir, 'references'), { recursive: true })
    await mkdir(invalidSkillDir, { recursive: true })
    await Bun.write(join(validSkillDir, 'references', 'guide.md'), '# Guide')
    await Bun.write(
      join(validSkillDir, 'SKILL.md'),
      `---
name: valid-skill
description: Valid skill
compatibility: Requires bun
allowed-tools: Read Write
---

See [guide](references/guide.md).
`,
    )
    await Bun.write(
      join(invalidSkillDir, 'SKILL.md'),
      `---
name: wrong-name
description: Invalid skill
---

Broken.
`,
    )

    let catalogSignal: Signal<typeof SkillsCatalogSchema> | undefined
    let resolveCatalog!: () => void
    const catalogSeen = new Promise<void>((resolve) => {
      resolveCatalog = resolve
    })
    const catalogEvents: Array<{ count: number; errors: unknown[] }> = []

    const agent = await createAgent({
      id: 'agent:skills-catalog',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        createSkillsFactory({ rootDir: workspace }),
        ({ signals }) => {
          catalogSignal = signals.get(SKILLS_FACTORY_SIGNAL_KEYS.catalog) as Signal<typeof SkillsCatalogSchema>
          catalogSignal.listen(() => resolveCatalog())

          return {
            handlers: {
              [SKILLS_FACTORY_EVENTS.skills_factory_catalog_updated](detail) {
                const parsed = z
                  .object({
                    count: z.number(),
                    errors: z.array(z.unknown()),
                  })
                  .parse(detail)
                catalogEvents.push(parsed)
              },
            },
          }
        },
      ],
    })

    await catalogSeen

    const catalog = catalogSignal?.get()
    expect(catalog).toHaveLength(1)
    expect(catalog?.[0]?.name).toBe('valid-skill')
    expect(catalog?.[0]?.localLinks.present).toEqual(['references/guide.md'])
    expect(catalogEvents.at(-1)).toEqual({
      count: 1,
      errors: [{ skillPath: join(invalidSkillDir, 'SKILL.md'), message: 'Invalid skill markdown' }],
    })

    agent.trigger({ type: SKILLS_FACTORY_EVENTS.skills_factory_reload })
    await Bun.sleep(25)
    expect(catalogSignal?.get()?.map((entry) => entry.name)).toEqual(['valid-skill'])

    await rm(workspace, { recursive: true, force: true })
  })

  test('loads selected skill body into the selected signal', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-skills-select-'))
    const skillDir = join(workspace, 'skills', 'search-docs')
    await mkdir(join(skillDir, 'references'), { recursive: true })
    await Bun.write(join(skillDir, 'references', 'api.md'), '# API')
    await Bun.write(
      join(skillDir, 'SKILL.md'),
      `---
name: search-docs
description: Search docs
license: ISC
---

# Search Docs

Use [api](references/api.md).
`,
    )

    let catalogSignal: Signal<typeof SkillsCatalogSchema> | undefined
    let selectedSignal: Signal<typeof SkillsSelectedSignalSchema> | undefined
    let resolveCatalog!: () => void
    let resolveSelected!: () => void
    const catalogSeen = new Promise<void>((resolve) => {
      resolveCatalog = resolve
    })
    const selectedSeen = new Promise<void>((resolve) => {
      resolveSelected = resolve
    })

    const agent = await createAgent({
      id: 'agent:skills-select',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        createSkillsFactory({ rootDir: workspace }),
        ({ signals }) => {
          catalogSignal = signals.get(SKILLS_FACTORY_SIGNAL_KEYS.catalog) as Signal<typeof SkillsCatalogSchema>
          selectedSignal = signals.get(SKILLS_FACTORY_SIGNAL_KEYS.selected) as Signal<typeof SkillsSelectedSignalSchema>
          catalogSignal.listen(() => resolveCatalog())
          selectedSignal.listen(() => {
            if (selectedSignal?.get()) {
              resolveSelected()
            }
          })
          return {}
        },
      ],
    })

    await catalogSeen
    expect(catalogSignal?.get()?.map((entry) => entry.name)).toEqual(['search-docs'])

    agent.trigger({
      type: SKILLS_FACTORY_EVENTS.skills_factory_select,
      detail: { name: 'search-docs' },
    })

    await selectedSeen

    expect(selectedSignal?.get()).toEqual({
      name: 'search-docs',
      description: 'Search docs',
      skillPath: join(skillDir, 'SKILL.md'),
      skillDir,
      license: 'ISC',
      localLinks: {
        present: ['references/api.md'],
        missing: [],
      },
      body: '# Search Docs\n\nUse [api](references/api.md).',
    })

    await rm(workspace, { recursive: true, force: true })
  })
})
