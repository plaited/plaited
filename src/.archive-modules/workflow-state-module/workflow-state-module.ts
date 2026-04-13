import type { Module } from '../../agent.ts'
import { EDIT_MODULE_SIGNAL_KEYS } from '../edit-module/edit-module.constants.ts'
import type { EditState } from '../edit-module/edit-module.schemas.ts'
import { PLAN_MODULE_SIGNAL_KEYS } from '../plan-module/plan-module.constants.ts'
import type { PlanState } from '../plan-module/plan-module.schemas.ts'
import { VERIFICATION_MODULE_SIGNAL_KEYS } from '../verification-module/verification-module.constants.ts'
import type { VerificationReport } from '../verification-module/verification-module.schemas.ts'
import {
  WORKFLOW_STATE_MODULE_EVENTS,
  WORKFLOW_STATE_MODULE_SIGNAL_KEYS,
} from './workflow-state-module.constants.ts'
import { type WorkflowRole, type WorkflowState, WorkflowStateSchema } from './workflow-state-module.schemas.ts'
import type { CreateWorkflowStateModuleOptions } from './workflow-state-module.types.ts'

const deriveRoles = ({
  plan,
  edit,
  verification,
}: {
  plan: PlanState | null
  edit: EditState | null
  verification: VerificationReport | null
}): WorkflowRole[] => {
  const roles = new Set<WorkflowRole>()

  if (plan) {
    if (plan.phase === 'planning') roles.add('planner')
    if (plan.phase === 'execution') roles.add('editor')
    if (plan.phase === 'verification' || plan.phase === 'completed') roles.add('verifier')
  }

  if (edit) {
    if (edit.status === 'proposed' || edit.status === 'applying' || edit.status === 'partial') roles.add('editor')
    if (edit.status === 'ready_for_verification' || edit.status === 'needs_repair') roles.add('verifier')
  }

  if (verification) {
    roles.add('reporter')
    if (verification.status === 'failed' || verification.status === 'blocked') roles.add('planner')
  }

  return [...roles].sort()
}

/**
 * Creates the in-process workflow-state module.
 *
 * @public
 */
export const createWorkflowStateModule =
  ({
    stateSignalKey = WORKFLOW_STATE_MODULE_SIGNAL_KEYS.state,
    planSignalKey = PLAN_MODULE_SIGNAL_KEYS.plan,
    editSignalKey = EDIT_MODULE_SIGNAL_KEYS.state,
    verificationSignalKey = VERIFICATION_MODULE_SIGNAL_KEYS.report,
  }: CreateWorkflowStateModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: WorkflowStateSchema,
        value: {
          activeRoles: [],
        },
        readOnly: false,
      })

    const rebuild = () => {
      const plan = (signals.get(planSignalKey)?.get() ?? null) as PlanState | null
      const edit = (signals.get(editSignalKey)?.get() ?? null) as EditState | null
      const verification = (signals.get(verificationSignalKey)?.get() ?? null) as VerificationReport | null
      const activeRoles = deriveRoles({ plan, edit, verification })
      const current = (stateSignal.get() ?? { activeRoles: [] }) as WorkflowState
      const next = WorkflowStateSchema.parse({
        activeRoles,
        lastTransition:
          current.activeRoles.join(',') === activeRoles.join(',')
            ? current.lastTransition
            : `${current.activeRoles.join(',')} -> ${activeRoles.join(',')}`,
      })
      stateSignal.set?.(next)
      trigger({
        type: WORKFLOW_STATE_MODULE_EVENTS.workflow_state_module_updated,
        detail: {
          activeRoles,
          lastTransition: next.lastTransition,
        },
      })
    }

    signals.get(planSignalKey)?.listen(() => rebuild(), true)
    signals.get(editSignalKey)?.listen(() => rebuild(), true)
    signals.get(verificationSignalKey)?.listen(() => rebuild(), true)
    rebuild()

    return {}
  }
