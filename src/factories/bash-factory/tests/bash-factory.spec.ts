import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { BASH_FACTORY_EVENTS, BASH_FACTORY_SIGNAL_KEYS } from '../bash-factory.constants.ts'
import type { NullableBashExecutionStateSchema } from '../bash-factory.schemas.ts'
import { createBashFactory } from '../bash-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createBashFactory', () => {
  test('classifies bash execution profile and retains normalized run state', async () => {
    let stateSignal: Signal<typeof NullableBashExecutionStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:bash-factory',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createBashFactory(),
        ({ signals }) => {
          stateSignal = signals.get(BASH_FACTORY_SIGNAL_KEYS.state) as Signal<typeof NullableBashExecutionStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: BASH_FACTORY_EVENTS.bash_factory_request,
      detail: {
        path: 'scripts/fix-worker.ts',
        args: ['apply', 'patch'],
      },
    })

    expect(stateSignal?.get()?.profile).toBe('workspace_write')
    expect(stateSignal?.get()?.status).toBe('requested')

    agent.trigger({
      type: BASH_FACTORY_EVENTS.bash_factory_mark_result,
      detail: {
        status: 'completed',
        summary: 'Worker completed cleanly',
      },
    })

    expect(stateSignal?.get()?.status).toBe('completed')
    expect(stateSignal?.get()?.summary).toBe('Worker completed cleanly')
  })
})
