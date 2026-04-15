import { useExtension } from '../../../behavioral.ts'

export const updateModulesExtensionFixture = useExtension('agent_core_fixture', () => ({
  ping() {
    ;(globalThis as Record<string, unknown>).__plaitedAgentCoreFixtureSeen = true
  },
}))
