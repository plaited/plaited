import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { BASH_MODULE_EVENTS, BASH_MODULE_SIGNAL_KEYS } from '../bash-module.constants.ts'
import type { NullableBashExecutionStateSchema } from '../bash-module.schemas.ts'
import { createBashModule } from '../bash-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createBashModule', () => {
  test('classifies bash execution profile and retains normalized run state', async () => {
    let stateSignal: Signal<typeof NullableBashExecutionStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:bash-module',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createBashModule(),
        ({ signals }) => {
          stateSignal = signals.get(BASH_MODULE_SIGNAL_KEYS.state) as Signal<typeof NullableBashExecutionStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: BASH_MODULE_EVENTS.bash_module_request,
      detail: {
        path: 'scripts/fix-worker.ts',
        args: ['apply', 'patch'],
      },
    })

    expect(stateSignal?.get()?.profile).toBe('workspace_write')
    expect(stateSignal?.get()?.status).toBe('requested')

    agent.trigger({
      type: BASH_MODULE_EVENTS.bash_module_mark_result,
      detail: {
        status: 'completed',
        summary: 'Worker completed cleanly',
      },
    })

    expect(stateSignal?.get()?.status).toBe('completed')
    expect(stateSignal?.get()?.summary).toBe('Worker completed cleanly')
  })
})
