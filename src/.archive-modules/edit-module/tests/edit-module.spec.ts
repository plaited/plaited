import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { VERIFICATION_MODULE_SIGNAL_KEYS } from '../../verification-module/verification-module.constants.ts'
import { createVerificationModule } from '../../verification-module/verification-module.ts'
import { EDIT_MODULE_EVENTS, EDIT_MODULE_SIGNAL_KEYS } from '../edit-module.constants.ts'
import type { NullableEditStateSchema } from '../edit-module.schemas.ts'
import { createEditModule } from '../edit-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createEditModule', () => {
  test('classifies edit strategy and advances edit state toward verification', async () => {
    let editSignal: Signal<typeof NullableEditStateSchema> | undefined
    let verificationSignal: { get: () => unknown } | undefined

    const agent = await createAgent({
      id: 'agent:edit',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createEditModule(),
        createVerificationModule(),
        ({ signals }) => {
          editSignal = signals.get(EDIT_MODULE_SIGNAL_KEYS.state) as Signal<typeof NullableEditStateSchema>
          verificationSignal = signals.get(VERIFICATION_MODULE_SIGNAL_KEYS.report) as { get: () => unknown }
          return {}
        },
      ],
    })

    agent.trigger({
      type: EDIT_MODULE_EVENTS.edit_module_request,
      detail: {
        intent: 'Patch the TypeScript implementation',
        files: ['src/modules/edit-module/edit-module.ts'],
      },
    })
    expect(editSignal?.get()?.strategy).toBe('targeted_patch')
    expect(editSignal?.get()?.status).toBe('proposed')

    agent.trigger({
      type: EDIT_MODULE_EVENTS.edit_module_apply,
      detail: {
        changedFiles: ['src/modules/edit-module/edit-module.ts'],
        note: 'Applied targeted patch',
      },
    })
    expect(editSignal?.get()?.status).toBe('applying')

    agent.trigger({ type: EDIT_MODULE_EVENTS.edit_module_mark_ready })
    expect(editSignal?.get()?.status).toBe('ready_for_verification')
    expect(verificationSignal?.get()).toBeTruthy()
  })
})
