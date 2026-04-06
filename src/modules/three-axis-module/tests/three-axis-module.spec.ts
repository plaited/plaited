import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createToolRegistryModule } from '../../tool-registry-module/tool-registry-module.ts'
import { createVerificationModule } from '../../verification-module/verification-module.ts'
import { THREE_AXIS_MODULE_EVENTS, THREE_AXIS_MODULE_SIGNAL_KEYS } from '../three-axis-module.constants.ts'
import type { ThreeAxisStateSchema } from '../three-axis-module.schemas.ts'
import { createThreeAxisModule } from '../three-axis-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createThreeAxisModule', () => {
  test('derives autonomy and authority policy from capability metadata', async () => {
    let stateSignal: Signal<typeof ThreeAxisStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:three-axis',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createToolRegistryModule(),
        createVerificationModule(),
        createThreeAxisModule(),
        ({ signals }) => {
          stateSignal = signals.get(THREE_AXIS_MODULE_SIGNAL_KEYS.state) as Signal<typeof ThreeAxisStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({ type: THREE_AXIS_MODULE_EVENTS.three_axis_module_evaluate })

    const state = stateSignal?.get()
    expect(state?.decisions.length ?? 0).toBeGreaterThan(0)
    expect(state?.decisions.some((entry) => entry.capabilityId === 'builtin:bash')).toBe(true)
  })
})
