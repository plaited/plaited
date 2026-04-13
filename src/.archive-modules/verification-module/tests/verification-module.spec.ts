import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PLAN_MODULE_EVENTS } from '../../plan-module/plan-module.constants.ts'
import { createPlanModule } from '../../plan-module/plan-module.ts'
import { SEARCH_MODULE_EVENTS } from '../../search-module/search-module.constants.ts'
import { createSearchModule } from '../../search-module/search-module.ts'
import { VERIFICATION_MODULE_EVENTS, VERIFICATION_MODULE_SIGNAL_KEYS } from '../verification-module.constants.ts'
import type { NullableVerificationReportSchema, VerificationReport } from '../verification-module.schemas.ts'
import { createVerificationModule } from '../verification-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createVerificationModule', () => {
  test('emits deterministic failure reports for invalid plan structure', async () => {
    let reportSignal: Signal<typeof NullableVerificationReportSchema> | undefined

    const agent = await createAgent({
      id: 'agent:verification',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createPlanModule(),
        createSearchModule(),
        createVerificationModule(),
        ({ signals }) => {
          reportSignal = signals.get(VERIFICATION_MODULE_SIGNAL_KEYS.report) as Signal<
            typeof NullableVerificationReportSchema
          >
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_MODULE_EVENTS.plan_module_set_plan,
      detail: {
        goal: 'Implement a lane',
        steps: [
          { id: 'dup', intent: 'First step', tools: [] },
          { id: 'dup', intent: 'Second step', tools: ['write_file'], depends: ['missing'] },
        ],
      },
    })
    agent.trigger({
      type: SEARCH_MODULE_EVENTS.search_module_search,
      detail: { query: 'lane' },
    })

    await Bun.sleep(50)
    agent.trigger({ type: VERIFICATION_MODULE_EVENTS.verification_module_run })

    const report = (reportSignal?.get() ?? null) as VerificationReport | null
    expect(report?.status).toBe('failed')
    expect(report?.findings.map((finding) => finding.code)).toEqual([
      'missing-tools',
      'duplicate-step-id',
      'missing-dependency',
    ])
  })
})
