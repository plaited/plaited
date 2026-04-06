import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { EDIT_FACTORY_EVENTS } from '../../edit-factory/edit-factory.constants.ts'
import { createEditFactory } from '../../edit-factory/edit-factory.ts'
import { PLAN_FACTORY_EVENTS } from '../../plan-factory/plan-factory.constants.ts'
import { createPlanFactory } from '../../plan-factory/plan-factory.ts'
import { VERIFICATION_FACTORY_EVENTS } from '../../verification-factory/verification-factory.constants.ts'
import { createVerificationFactory } from '../../verification-factory/verification-factory.ts'
import { WORKFLOW_STATE_FACTORY_SIGNAL_KEYS } from '../workflow-state-factory.constants.ts'
import type { WorkflowStateSchema } from '../workflow-state-factory.schemas.ts'
import { createWorkflowStateFactory } from '../workflow-state-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createWorkflowStateFactory', () => {
  test('tracks active in-process roles from plan, edit, and verification state', async () => {
    let workflowSignal: Signal<typeof WorkflowStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:workflow',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createPlanFactory(),
        createEditFactory(),
        createVerificationFactory(),
        createWorkflowStateFactory(),
        ({ signals }) => {
          workflowSignal = signals.get(WORKFLOW_STATE_FACTORY_SIGNAL_KEYS.state) as Signal<typeof WorkflowStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: PLAN_FACTORY_EVENTS.plan_factory_set_plan,
      detail: {
        goal: 'Implement change',
        steps: [{ id: 'step-1', intent: 'Edit code', tools: ['write_file'] }],
      },
    })
    expect(workflowSignal?.get()?.activeRoles).toEqual(['planner'])

    agent.trigger({
      type: EDIT_FACTORY_EVENTS.edit_factory_request,
      detail: {
        intent: 'Patch code',
        files: ['src/factories/workflow-state-factory/workflow-state-factory.ts'],
      },
    })
    expect(workflowSignal?.get()?.activeRoles).toContain('editor')

    agent.trigger({ type: VERIFICATION_FACTORY_EVENTS.verification_factory_run })
    expect(workflowSignal?.get()?.activeRoles).toContain('reporter')
  })
})
