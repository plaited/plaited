import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PLAN_FACTORY_EVENTS } from '../../plan-factory/plan-factory.constants.ts'
import { createPlanFactory } from '../../plan-factory/plan-factory.ts'
import { createProjectionFactory } from '../../projection-factory/projection-factory.ts'
import { SEARCH_FACTORY_EVENTS } from '../../search-factory/search-factory.constants.ts'
import { createSearchFactory } from '../../search-factory/search-factory.ts'
import { createToolRegistryFactory } from '../../tool-registry-factory/tool-registry-factory.ts'
import {
  CONTEXT_ASSEMBLY_FACTORY_EVENTS,
  CONTEXT_ASSEMBLY_FACTORY_SIGNAL_KEYS,
} from '../context-assembly-factory.constants.ts'
import type { AssembledRequestSchema } from '../context-assembly-factory.schemas.ts'
import { createContextAssemblyFactory } from '../context-assembly-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createContextAssemblyFactory', () => {
  test('assembles bounded next-request context from plan, projection, search, and registry state', async () => {
    let requestSignal: Signal<typeof AssembledRequestSchema> | undefined

    const agent = await createAgent({
      id: 'agent:context-assembly',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createPlanFactory(),
        createToolRegistryFactory(),
        createSearchFactory({ rootDir: process.cwd() }),
        createProjectionFactory(),
        createContextAssemblyFactory(),
        ({ signals }) => {
          requestSignal = signals.get(CONTEXT_ASSEMBLY_FACTORY_SIGNAL_KEYS.request) as Signal<
            typeof AssembledRequestSchema
          >
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_FACTORY_EVENTS.plan_factory_set_plan,
      detail: {
        goal: 'Assemble execution context',
        steps: [{ id: 'search', intent: 'Search for evidence', tools: ['search'] }],
      },
    })
    agent.trigger({
      type: SEARCH_FACTORY_EVENTS.search_factory_search,
      detail: { query: 'context' },
    })
    await Bun.sleep(50)
    agent.trigger({ type: CONTEXT_ASSEMBLY_FACTORY_EVENTS.context_assembly_factory_rebuild })

    const request = requestSignal?.get()
    expect(request?.phase).toBeTruthy()
    expect(request?.blocks.map((block) => block.id)).toContain('plan-state')
    expect(request?.blocks.map((block) => block.id)).toContain('capability-selection')
  })
})
