import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../../tool-registry-module/tool-registry-module.constants.ts'
import { CapabilityRegistrySchema } from '../../tool-registry-module/tool-registry-module.schemas.ts'
import { WORKFLOW_STATE_MODULE_SIGNAL_KEYS } from '../../workflow-state-module/workflow-state-module.constants.ts'
import { WorkflowStateSchema } from '../../workflow-state-module/workflow-state-module.schemas.ts'
import { ACP_MODULE_EVENTS, ACP_MODULE_SIGNAL_KEYS } from '../acp-module.constants.ts'
import type { AcpModuleState, AcpModuleStateSchema } from '../acp-module.schemas.ts'
import { createAcpModule } from '../acp-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createAcpModule', () => {
  test('advertises local capabilities and retains ACP session state', async () => {
    let acpSignal: Signal<typeof AcpModuleStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:acp',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ signals }) => {
          signals.set({
            key: TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
            schema: CapabilityRegistrySchema,
            value: [
              {
                id: 'search',
                name: 'Search',
                description: 'Search repo metadata',
                capabilityClass: 'built-in',
                sourceClass: 'core',
                tags: ['search'],
                authorityHints: ['read'],
              },
            ],
            readOnly: false,
          })
          signals.set({
            key: WORKFLOW_STATE_MODULE_SIGNAL_KEYS.state,
            schema: WorkflowStateSchema,
            value: {
              activeRoles: ['planner'],
            },
            readOnly: false,
          })
          return {}
        },
        createAcpModule(),
        ({ signals }) => {
          acpSignal = signals.get(ACP_MODULE_SIGNAL_KEYS.state) as Signal<typeof AcpModuleStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: ACP_MODULE_EVENTS.acp_module_open_session,
      detail: { sessionId: 'session-1' },
    })
    agent.trigger({
      type: ACP_MODULE_EVENTS.acp_module_submit_turn,
      detail: { sessionId: 'session-1', prompt: 'inspect current plan' },
    })
    agent.trigger({
      type: ACP_MODULE_EVENTS.acp_module_cancel_session,
      detail: { sessionId: 'session-1' },
    })

    const state = acpSignal?.get() as AcpModuleState | undefined
    expect(state?.advertisedCapabilities.map((entry) => entry.id)).toEqual(['search', 'workflow:planner'])
    expect(state?.sessions[0]?.promptCount).toBe(1)
    expect(state?.sessions[0]?.status).toBe('cancelled')
  })
})
