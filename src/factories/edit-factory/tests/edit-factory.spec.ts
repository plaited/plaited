import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { VERIFICATION_FACTORY_SIGNAL_KEYS } from '../../verification-factory/verification-factory.constants.ts'
import { createVerificationFactory } from '../../verification-factory/verification-factory.ts'
import { EDIT_FACTORY_EVENTS, EDIT_FACTORY_SIGNAL_KEYS } from '../edit-factory.constants.ts'
import type { NullableEditStateSchema } from '../edit-factory.schemas.ts'
import { createEditFactory } from '../edit-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createEditFactory', () => {
  test('classifies edit strategy and advances edit state toward verification', async () => {
    let editSignal: Signal<typeof NullableEditStateSchema> | undefined
    let verificationSignal: { get: () => unknown } | undefined

    const agent = await createAgent({
      id: 'agent:edit',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createEditFactory(),
        createVerificationFactory(),
        ({ signals }) => {
          editSignal = signals.get(EDIT_FACTORY_SIGNAL_KEYS.state) as Signal<typeof NullableEditStateSchema>
          verificationSignal = signals.get(VERIFICATION_FACTORY_SIGNAL_KEYS.report) as { get: () => unknown }
          return {}
        },
      ],
    })

    agent.trigger({
      type: EDIT_FACTORY_EVENTS.edit_factory_request,
      detail: {
        intent: 'Patch the TypeScript implementation',
        files: ['src/factories/edit-factory/edit-factory.ts'],
      },
    })
    expect(editSignal?.get()?.strategy).toBe('targeted_patch')
    expect(editSignal?.get()?.status).toBe('proposed')

    agent.trigger({
      type: EDIT_FACTORY_EVENTS.edit_factory_apply,
      detail: {
        changedFiles: ['src/factories/edit-factory/edit-factory.ts'],
        note: 'Applied targeted patch',
      },
    })
    expect(editSignal?.get()?.status).toBe('applying')

    agent.trigger({ type: EDIT_FACTORY_EVENTS.edit_factory_mark_ready })
    expect(editSignal?.get()?.status).toBe('ready_for_verification')
    expect(verificationSignal?.get()).toBeTruthy()
  })
})
