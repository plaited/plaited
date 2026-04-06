import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../../tool-registry-factory/tool-registry-factory.constants.ts'
import { CapabilityRegistrySchema } from '../../tool-registry-factory/tool-registry-factory.schemas.ts'
import { WORKFLOW_STATE_FACTORY_SIGNAL_KEYS } from '../../workflow-state-factory/workflow-state-factory.constants.ts'
import { WorkflowStateSchema } from '../../workflow-state-factory/workflow-state-factory.schemas.ts'
import { ACP_FACTORY_EVENTS, ACP_FACTORY_SIGNAL_KEYS } from '../acp-factory.constants.ts'
import type { AcpFactoryState, AcpFactoryStateSchema } from '../acp-factory.schemas.ts'
import { createAcpFactory } from '../acp-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createAcpFactory', () => {
  test('advertises local capabilities and retains ACP session state', async () => {
    let acpSignal: Signal<typeof AcpFactoryStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:acp',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          signals.set({
            key: TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
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
            key: WORKFLOW_STATE_FACTORY_SIGNAL_KEYS.state,
            schema: WorkflowStateSchema,
            value: {
              activeRoles: ['planner'],
            },
            readOnly: false,
          })
          return {}
        },
        createAcpFactory(),
        ({ signals }) => {
          acpSignal = signals.get(ACP_FACTORY_SIGNAL_KEYS.state) as Signal<typeof AcpFactoryStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: ACP_FACTORY_EVENTS.acp_factory_open_session,
      detail: { sessionId: 'session-1' },
    })
    agent.trigger({
      type: ACP_FACTORY_EVENTS.acp_factory_submit_turn,
      detail: { sessionId: 'session-1', prompt: 'inspect current plan' },
    })
    agent.trigger({
      type: ACP_FACTORY_EVENTS.acp_factory_cancel_session,
      detail: { sessionId: 'session-1' },
    })

    const state = acpSignal?.get() as AcpFactoryState | undefined
    expect(state?.advertisedCapabilities.map((entry) => entry.id)).toEqual(['search', 'workflow:planner'])
    expect(state?.sessions[0]?.promptCount).toBe(1)
    expect(state?.sessions[0]?.status).toBe('cancelled')
  })
})
