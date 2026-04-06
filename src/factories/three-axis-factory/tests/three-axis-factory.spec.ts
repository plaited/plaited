import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createToolRegistryFactory } from '../../tool-registry-factory/tool-registry-factory.ts'
import { createVerificationFactory } from '../../verification-factory/verification-factory.ts'
import { THREE_AXIS_FACTORY_EVENTS, THREE_AXIS_FACTORY_SIGNAL_KEYS } from '../three-axis-factory.constants.ts'
import type { ThreeAxisStateSchema } from '../three-axis-factory.schemas.ts'
import { createThreeAxisFactory } from '../three-axis-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createThreeAxisFactory', () => {
  test('derives autonomy and authority policy from capability metadata', async () => {
    let stateSignal: Signal<typeof ThreeAxisStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:three-axis',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createToolRegistryFactory(),
        createVerificationFactory(),
        createThreeAxisFactory(),
        ({ signals }) => {
          stateSignal = signals.get(THREE_AXIS_FACTORY_SIGNAL_KEYS.state) as Signal<typeof ThreeAxisStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({ type: THREE_AXIS_FACTORY_EVENTS.three_axis_factory_evaluate })

    const state = stateSignal?.get()
    expect(state?.decisions.length ?? 0).toBeGreaterThan(0)
    expect(state?.decisions.some((entry) => entry.capabilityId === 'builtin:bash')).toBe(true)
  })
})
