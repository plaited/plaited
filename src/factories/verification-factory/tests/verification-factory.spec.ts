import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PLAN_FACTORY_EVENTS } from '../../plan-factory/plan-factory.constants.ts'
import { createPlanFactory } from '../../plan-factory/plan-factory.ts'
import { SEARCH_FACTORY_EVENTS } from '../../search-factory/search-factory.constants.ts'
import { createSearchFactory } from '../../search-factory/search-factory.ts'
import { VERIFICATION_FACTORY_EVENTS, VERIFICATION_FACTORY_SIGNAL_KEYS } from '../verification-factory.constants.ts'
import type { NullableVerificationReportSchema, VerificationReport } from '../verification-factory.schemas.ts'
import { createVerificationFactory } from '../verification-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createVerificationFactory', () => {
  test('emits deterministic failure reports for invalid plan structure', async () => {
    let reportSignal: Signal<typeof NullableVerificationReportSchema> | undefined

    const agent = await createAgent({
      id: 'agent:verification',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createPlanFactory(),
        createSearchFactory(),
        createVerificationFactory(),
        ({ signals }) => {
          reportSignal = signals.get(VERIFICATION_FACTORY_SIGNAL_KEYS.report) as Signal<
            typeof NullableVerificationReportSchema
          >
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_FACTORY_EVENTS.plan_factory_set_plan,
      detail: {
        goal: 'Implement a lane',
        steps: [
          { id: 'dup', intent: 'First step', tools: [] },
          { id: 'dup', intent: 'Second step', tools: ['write_file'], depends: ['missing'] },
        ],
      },
    })
    agent.trigger({
      type: SEARCH_FACTORY_EVENTS.search_factory_search,
      detail: { query: 'lane' },
    })

    await Bun.sleep(50)
    agent.trigger({ type: VERIFICATION_FACTORY_EVENTS.verification_factory_run })

    const report = (reportSignal?.get() ?? null) as VerificationReport | null
    expect(report?.status).toBe('failed')
    expect(report?.findings.map((finding) => finding.code)).toEqual([
      'missing-tools',
      'duplicate-step-id',
      'missing-dependency',
    ])
  })
})
