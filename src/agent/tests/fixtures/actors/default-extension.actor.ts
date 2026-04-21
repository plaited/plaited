import { defineActor } from '../../../../behavioral.ts'

export default defineActor({
  id: 'agent_core_default_actor_fixture',
  setup() {
    ;(globalThis as Record<string, unknown>).__plaitedAgentCoreDefaultActorSeen = true
  },
})
