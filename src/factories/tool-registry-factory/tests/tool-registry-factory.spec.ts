import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createModuleDiscoveryFactory } from '../../module-discovery-factory/module-discovery-factory.ts'
import { createSkillsFactory } from '../../skills-factory/skills-factory.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../tool-registry-factory.constants.ts'
import type { CapabilityRegistrySchema } from '../tool-registry-factory.schemas.ts'
import { createToolRegistryFactory } from '../tool-registry-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createToolRegistryFactory', () => {
  test('builds a compact registry from built-ins, skills, and discovered modules', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-tool-registry-'))
    const skillDir = join(workspace, 'skills', 'alpha-skill')
    const moduleDir = join(workspace, 'generated')

    await mkdir(skillDir, { recursive: true })
    await mkdir(moduleDir, { recursive: true })
    await Bun.write(
      join(skillDir, 'SKILL.md'),
      `---
name: alpha-skill
description: Alpha skill
allowed-tools: Read Write
---

Body.
`,
    )
    await Bun.write(
      join(moduleDir, 'alpha.factory-module.ts'),
      [
        "import type { FactoryParams } from '../src/agent.ts'",
        '',
        'const alphaFactory = (_params: FactoryParams) => ({})',
        '',
        'export default [alphaFactory]',
      ].join('\n'),
    )

    let registrySignal: Signal<typeof CapabilityRegistrySchema> | undefined
    let resolveRegistry!: () => void
    const registrySeen = new Promise<void>((resolve) => {
      resolveRegistry = resolve
    })

    await createAgent({
      id: 'agent:tool-registry',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        createSkillsFactory({ rootDir: workspace }),
        createModuleDiscoveryFactory({
          rootDir: workspace,
          patterns: ['generated/*.factory-module.ts'],
        }),
        createToolRegistryFactory(),
        ({ signals }) => {
          registrySignal = signals.get(TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry) as Signal<
            typeof CapabilityRegistrySchema
          >
          registrySignal.listen(() => {
            const ids = registrySignal?.get()?.map((entry) => entry.id) ?? []
            if (ids.includes('skill:alpha-skill') && ids.includes('module:generated/alpha.factory-module')) {
              resolveRegistry()
            }
          }, true)

          return {}
        },
      ],
    })

    await registrySeen

    const registry = registrySignal?.get() ?? []
    expect(registry.some((entry) => entry.id === 'builtin:read_file')).toBe(true)
    expect(registry.find((entry) => entry.id === 'skill:alpha-skill')).toEqual({
      id: 'skill:alpha-skill',
      name: 'alpha-skill',
      description: 'Alpha skill',
      capabilityClass: 'skill',
      sourceClass: 'default',
      path: join(skillDir, 'SKILL.md'),
      tags: ['skill'],
      authorityHints: ['Read Write'],
    })
    expect(registry.find((entry) => entry.id === 'module:generated/alpha.factory-module')).toEqual({
      id: 'module:generated/alpha.factory-module',
      name: 'generated/alpha.factory-module',
      description: 'Factory module discovered at generated/alpha.factory-module.ts',
      capabilityClass: 'module',
      sourceClass: 'generated',
      path: 'generated/alpha.factory-module.ts',
      tags: ['module', 'factory'],
      authorityHints: ['factory-count:1'],
    })

    await rm(workspace, { recursive: true, force: true })
  })
})
