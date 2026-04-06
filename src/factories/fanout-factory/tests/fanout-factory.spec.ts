import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PLAN_FACTORY_SIGNAL_KEYS } from '../../plan-factory/plan-factory.constants.ts'
import { NullablePlanStateSchema } from '../../plan-factory/plan-factory.schemas.ts'
import { VERIFICATION_FACTORY_SIGNAL_KEYS } from '../../verification-factory/verification-factory.constants.ts'
import { NullableVerificationReportSchema } from '../../verification-factory/verification-factory.schemas.ts'
import { FANOUT_FACTORY_EVENTS, FANOUT_FACTORY_SIGNAL_KEYS } from '../fanout-factory.constants.ts'
import type { FanoutState, FanoutStateSchema } from '../fanout-factory.schemas.ts'
import { createFanoutFactory } from '../fanout-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createFanoutFactory', () => {
  test('retains bounded attempts, recommendation state, and winner selection', async () => {
    let fanoutSignal: Signal<typeof FanoutStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:fanout',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          signals.set({
            key: PLAN_FACTORY_SIGNAL_KEYS.plan,
            schema: NullablePlanStateSchema,
            value: {
              goal: 'Repair factory bundle',
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
            key: VERIFICATION_FACTORY_SIGNAL_KEYS.report,
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
        createFanoutFactory(),
        ({ signals }) => {
          fanoutSignal = signals.get(FANOUT_FACTORY_SIGNAL_KEYS.state) as Signal<typeof FanoutStateSchema>
          return {}
        },
      ],
    })

    expect((fanoutSignal?.get() as FanoutState | undefined)?.recommendation?.recommendedCount).toBe(3)

    agent.trigger({
      type: FANOUT_FACTORY_EVENTS.fanout_factory_start,
      detail: {
        goal: 'Repair factory bundle',
        count: 2,
        strategy: 'repair_compare',
      },
    })

    expect((fanoutSignal?.get() as FanoutState | undefined)?.attempts.map((attempt) => attempt.id)).toEqual([
      'attempt-1',
      'attempt-2',
    ])

    agent.trigger({
      type: FANOUT_FACTORY_EVENTS.fanout_factory_attempt_update,
      detail: {
        attemptId: 'attempt-1',
        status: 'validated',
        diffSummary: 'Changed 3 factory files',
        validationSummary: 'bun test passed',
      },
    })
    agent.trigger({
      type: FANOUT_FACTORY_EVENTS.fanout_factory_select_winner,
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
