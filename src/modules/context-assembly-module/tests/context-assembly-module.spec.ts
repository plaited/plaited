import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PLAN_MODULE_EVENTS } from '../../plan-module/plan-module.constants.ts'
import { createPlanModule } from '../../plan-module/plan-module.ts'
import { createProjectionModule } from '../../projection-module/projection-module.ts'
import { SEARCH_MODULE_EVENTS } from '../../search-module/search-module.constants.ts'
import { createSearchModule } from '../../search-module/search-module.ts'
import { createToolRegistryModule } from '../../tool-registry-module/tool-registry-module.ts'
import {
  CONTEXT_ASSEMBLY_MODULE_EVENTS,
  CONTEXT_ASSEMBLY_MODULE_SIGNAL_KEYS,
} from '../context-assembly-module.constants.ts'
import type { AssembledRequestSchema } from '../context-assembly-module.schemas.ts'
import { createContextAssemblyModule } from '../context-assembly-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createContextAssemblyModule', () => {
  test('assembles bounded next-request context from plan, projection, search, and registry state', async () => {
    let requestSignal: Signal<typeof AssembledRequestSchema> | undefined

    const agent = await createAgent({
      id: 'agent:context-assembly',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createPlanModule(),
        createToolRegistryModule(),
        createSearchModule({ rootDir: process.cwd() }),
        createProjectionModule(),
        createContextAssemblyModule(),
        ({ signals }) => {
          requestSignal = signals.get(CONTEXT_ASSEMBLY_MODULE_SIGNAL_KEYS.request) as Signal<
            typeof AssembledRequestSchema
          >
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_MODULE_EVENTS.plan_module_set_plan,
      detail: {
        goal: 'Assemble execution context',
        steps: [{ id: 'search', intent: 'Search for evidence', tools: ['search'] }],
      },
    })
    agent.trigger({
      type: SEARCH_MODULE_EVENTS.search_module_search,
      detail: { query: 'context' },
    })
    await Bun.sleep(50)
    agent.trigger({ type: CONTEXT_ASSEMBLY_MODULE_EVENTS.context_assembly_module_rebuild })

    const request = requestSignal?.get()
    expect(request?.phase).toBeTruthy()
    expect(request?.blocks.map((block) => block.id)).toContain('plan-state')
    expect(request?.blocks.map((block) => block.id)).toContain('capability-selection')
  })
})
