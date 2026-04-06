import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgent } from '../../../agent.ts'
import { createSkillsFactory } from '../../skills-factory/skills-factory.ts'
import { createToolRegistryFactory } from '../../tool-registry-factory/tool-registry-factory.ts'
import { SEARCH_FACTORY_EVENTS, SEARCH_FACTORY_SIGNAL_KEYS } from '../search-factory.constants.ts'
import { createSearchFactory } from '../search-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createSearchFactory', () => {
  test('routes metadata-first search across skills, modules, tools, and files', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-search-factory-'))
    const skillDir = join(workspace, 'skills', 'doc-search')
    await mkdir(skillDir, { recursive: true })
    await Bun.write(
      join(skillDir, 'SKILL.md'),
      `---
name: doc-search
description: Search documentation
---

Body.
`,
    )
    await Bun.write(join(workspace, 'notes-doc-search.txt'), 'search me')
    let resultsSignal: { get: () => unknown; listen: (cb: () => void) => void } | undefined
    let resolveResults!: () => void
    const resultsSeen = new Promise<void>((resolve) => {
      resolveResults = resolve
    })

    const agent = await createAgent({
      id: 'agent:search',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        createSkillsFactory({ rootDir: workspace }),
        createToolRegistryFactory(),
        createSearchFactory({ rootDir: workspace }),
        ({ signals }) => {
          resultsSignal = signals.get(SEARCH_FACTORY_SIGNAL_KEYS.results) as {
            get: () => unknown
            listen: (cb: () => void) => void
          }
          resultsSignal.listen(() => {
            const current = resultsSignal?.get() as { results?: unknown[] } | null | undefined
            if ((current?.results?.length ?? 0) > 0) resolveResults()
          })
          return {}
        },
      ],
    })

    await Bun.sleep(50)

    agent.trigger({
      type: SEARCH_FACTORY_EVENTS.search_factory_search,
      detail: { query: 'doc-search' },
    })

    await resultsSeen
    const payload = resultsSignal?.get() as
      | {
          query: string
          results: Array<{ id: string }>
        }
      | null
      | undefined
    expect(payload?.query).toBe('doc-search')
    expect(payload?.results.some((entry) => entry.id === 'skill:doc-search')).toBe(true)
    expect(payload?.results.some((entry) => entry.id === 'file:notes-doc-search.txt')).toBe(true)

    await rm(workspace, { recursive: true, force: true })
  })
})
