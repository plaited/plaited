import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { SKILLS_MODULE_EVENTS } from '../../skills-module/skills-module.constants.ts'
import { OBSERVABILITY_MODULE_SIGNAL_KEYS } from '../observability-module.constants.ts'
import type { ObservabilityTraceLogSchema } from '../observability-module.schemas.ts'
import { createObservabilityModule } from '../observability-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createObservabilityModule', () => {
  test('retains bounded traces from snapshots and key module events', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-observability-module-'))
    let tracesSignal: Signal<typeof ObservabilityTraceLogSchema> | undefined
    const agent = await createAgent({
      id: 'agent:observability',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      modules: [
        createObservabilityModule(),
        ({ signals }) => {
          tracesSignal = signals.get(OBSERVABILITY_MODULE_SIGNAL_KEYS.traces) as Signal<
            typeof ObservabilityTraceLogSchema
          >
          return {
            handlers: {
              emit_trace_skill_selected() {
                agent.trigger({
                  type: SKILLS_MODULE_EVENTS.skills_module_selected,
                  detail: { name: 'trace-skill' },
                })
              },
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'emit_trace_skill_selected' })
    await Bun.sleep(50)

    const traces = tracesSignal?.get() ?? []
    expect(traces.some((entry) => entry.kind === 'selection')).toBe(true)
    expect(traces.some((entry) => entry.kind === 'skill-selection')).toBe(true)

    await rm(workspace, { recursive: true, force: true })
  })
})
