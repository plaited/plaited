import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { PROJECTION_MODULE_SIGNAL_KEYS } from '../../projection-module/projection-module.constants.ts'
import { PLAN_MODULE_EVENTS, PLAN_MODULE_SIGNAL_KEYS } from '../plan-module.constants.ts'
import type { NullablePlanStateSchema, PlanState } from '../plan-module.schemas.ts'
import { createPlanModule } from '../plan-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createPlanModule', () => {
  test('stores bounded plan state and routes projection phase from step status', async () => {
    let planSignal: Signal<typeof NullablePlanStateSchema> | undefined
    let phaseSignal: { get: () => unknown } | undefined

    const agent = await createAgent({
      id: 'agent:plan',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createPlanModule(),
        ({ signals }) => {
          planSignal = signals.get(PLAN_MODULE_SIGNAL_KEYS.plan) as Signal<typeof NullablePlanStateSchema>
          phaseSignal = signals.get(PROJECTION_MODULE_SIGNAL_KEYS.phase) as { get: () => unknown }
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_MODULE_EVENTS.plan_module_set_plan,
      detail: {
        goal: 'Build the next module lane',
        steps: [
          { id: 'search', intent: 'Gather evidence', tools: ['search'] },
          { id: 'edit', intent: 'Implement changes', tools: ['write_file'], depends: ['search'] },
        ],
      },
    })

    expect((planSignal?.get() as PlanState | null | undefined)?.goal).toBe('Build the next module lane')
    expect((planSignal?.get() as PlanState | null | undefined)?.phase).toBe('planning')
    expect(phaseSignal?.get()).toBe('planning')

    agent.trigger({
      type: PLAN_MODULE_EVENTS.plan_module_step_update,
      detail: { id: 'search', status: 'in_progress' },
    })

    expect((planSignal?.get() as PlanState | null | undefined)?.phase).toBe('execution')
    expect(phaseSignal?.get()).toBe('execution')

    agent.trigger({
      type: PLAN_MODULE_EVENTS.plan_module_replan,
      detail: {
        cause: 'Need a verification step',
        steps: [
          { id: 'search', intent: 'Gather evidence', tools: ['search'] },
          { id: 'verify', intent: 'Validate changes', tools: ['tsc'] },
        ],
      },
    })

    expect((planSignal?.get() as PlanState | null | undefined)?.lastReplanCause).toBe('Need a verification step')
    expect(((planSignal?.get() as PlanState | null | undefined)?.steps ?? []).map((step) => step.id)).toEqual([
      'search',
      'verify',
    ])
  })
})
