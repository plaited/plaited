import { useExtension } from '../../../../behavioral.ts'

export default useExtension('agent_core_default_actor_fixture', () => ({
  ping() {
    ;(globalThis as Record<string, unknown>).__plaitedAgentCoreDefaultActorSeen = true
  },
}))
