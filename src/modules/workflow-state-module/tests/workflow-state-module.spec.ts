import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { EDIT_MODULE_EVENTS } from '../../edit-module/edit-module.constants.ts'
import { createEditModule } from '../../edit-module/edit-module.ts'
import { PLAN_MODULE_EVENTS } from '../../plan-module/plan-module.constants.ts'
import { createPlanModule } from '../../plan-module/plan-module.ts'
import { VERIFICATION_MODULE_EVENTS } from '../../verification-module/verification-module.constants.ts'
import { createVerificationModule } from '../../verification-module/verification-module.ts'
import { WORKFLOW_STATE_MODULE_SIGNAL_KEYS } from '../workflow-state-module.constants.ts'
import type { WorkflowStateSchema } from '../workflow-state-module.schemas.ts'
import { createWorkflowStateModule } from '../workflow-state-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createWorkflowStateModule', () => {
  test('tracks active in-process roles from plan, edit, and verification state', async () => {
    let workflowSignal: Signal<typeof WorkflowStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:workflow',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createPlanModule(),
        createEditModule(),
        createVerificationModule(),
        createWorkflowStateModule(),
        ({ signals }) => {
          workflowSignal = signals.get(WORKFLOW_STATE_MODULE_SIGNAL_KEYS.state) as Signal<typeof WorkflowStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_MODULE_EVENTS.plan_module_set_plan,
      detail: {
        goal: 'Implement change',
        steps: [{ id: 'step-1', intent: 'Edit code', tools: ['write_file'] }],
      },
    })
    expect(workflowSignal?.get()?.activeRoles).toEqual(['planner'])

    agent.trigger({
      type: EDIT_MODULE_EVENTS.edit_module_request,
      detail: {
        intent: 'Patch code',
        files: ['src/modules/workflow-state-module/workflow-state-module.ts'],
      },
    })
    expect(workflowSignal?.get()?.activeRoles).toContain('editor')

    agent.trigger({ type: VERIFICATION_MODULE_EVENTS.verification_module_run })
    expect(workflowSignal?.get()?.activeRoles).toContain('reporter')
  })
})
