import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PLAN_MODULE_SIGNAL_KEYS } from '../../plan-module/plan-module.constants.ts'
import { NullablePlanStateSchema } from '../../plan-module/plan-module.schemas.ts'
import { VERIFICATION_MODULE_SIGNAL_KEYS } from '../../verification-module/verification-module.constants.ts'
import { NullableVerificationReportSchema } from '../../verification-module/verification-module.schemas.ts'
import { FANOUT_MODULE_EVENTS, FANOUT_MODULE_SIGNAL_KEYS } from '../fanout-module.constants.ts'
import type { FanoutState, FanoutStateSchema } from '../fanout-module.schemas.ts'
import { createFanoutModule } from '../fanout-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createFanoutModule', () => {
  test('retains bounded attempts, recommendation state, and winner selection', async () => {
    let fanoutSignal: Signal<typeof FanoutStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:fanout',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ signals }) => {
          signals.set({
            key: PLAN_MODULE_SIGNAL_KEYS.plan,
            schema: NullablePlanStateSchema,
            value: {
              goal: 'Repair module bundle',
              phase: 'verification',
              steps: [
                {
                  id: 'verify',
                  intent: 'Validate result',
                  tools: ['bun test'],
                  status: 'blocked',
                },
              ],
            },
            readOnly: false,
          })
          signals.set({
            key: VERIFICATION_MODULE_SIGNAL_KEYS.report,
            schema: NullableVerificationReportSchema,
            value: {
              status: 'failed',
              findings: [
                { code: 'missing-evidence', message: 'Need another implementation attempt.' },
                { code: 'blocked-step', message: 'Verification step is blocked.' },
              ],
              checkedAt: 100,
            },
            readOnly: false,
          })
          return {}
        },
        createFanoutModule(),
        ({ signals }) => {
          fanoutSignal = signals.get(FANOUT_MODULE_SIGNAL_KEYS.state) as Signal<typeof FanoutStateSchema>
          return {}
        },
      ],
    })

    expect((fanoutSignal?.get() as FanoutState | undefined)?.recommendation?.recommendedCount).toBe(3)

    agent.trigger({
      type: FANOUT_MODULE_EVENTS.fanout_module_start,
      detail: {
        goal: 'Repair module bundle',
        count: 2,
        strategy: 'repair_compare',
      },
    })

    expect((fanoutSignal?.get() as FanoutState | undefined)?.attempts.map((attempt) => attempt.id)).toEqual([
      'attempt-1',
      'attempt-2',
    ])

    agent.trigger({
      type: FANOUT_MODULE_EVENTS.fanout_module_attempt_update,
      detail: {
        attemptId: 'attempt-1',
        status: 'validated',
        diffSummary: 'Changed 3 module files',
        validationSummary: 'bun test passed',
      },
    })
    agent.trigger({
      type: FANOUT_MODULE_EVENTS.fanout_module_select_winner,
      detail: {
        attemptId: 'attempt-1',
        disposition: 'promote',
        rationale: 'Best validation and smallest diff',
      },
    })

    const state = fanoutSignal?.get() as FanoutState | undefined
    expect(state?.winner?.attemptId).toBe('attempt-1')
    expect(state?.attempts.find((attempt) => attempt.id === 'attempt-1')?.status).toBe('promoted')
    expect(state?.attempts.find((attempt) => attempt.id === 'attempt-2')?.status).toBe('discarded')
  })
})
