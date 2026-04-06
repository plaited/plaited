import type { Factory } from '../../agent.ts'
import { PROJECTION_FACTORY_SIGNAL_KEYS } from '../projection-factory/projection-factory.constants.ts'
import { PLAN_FACTORY_EVENTS, PLAN_FACTORY_SIGNAL_KEYS } from './plan-factory.constants.ts'
import {
  NullablePlanStateSchema,
  type PlanPhase,
  PlanPhaseSchema,
  type PlanState,
  PlanStateSchema,
  ReplanDetailSchema,
  RuntimePlanStepSchema,
  SetPlanDetailSchema,
  UpdatePlanStepDetailSchema,
} from './plan-factory.schemas.ts'
import type { CreatePlanFactoryOptions } from './plan-factory.types.ts'

const derivePhase = (state: PlanState): PlanPhase => {
  if (state.steps.every((step) => step.status === 'completed')) return 'completed'
  if (state.steps.some((step) => step.status === 'in_progress' || step.status === 'blocked')) return 'execution'
  return 'planning'
}

/**
 * Creates the bounded plan factory.
 *
 * @public
 */
export const createPlanFactory =
  ({
    planSignalKey = PLAN_FACTORY_SIGNAL_KEYS.plan,
    projectionPhaseSignalKey = PROJECTION_FACTORY_SIGNAL_KEYS.phase,
  }: CreatePlanFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const planSignal =
      signals.get(planSignalKey) ??
      signals.set({
        key: planSignalKey,
        schema: NullablePlanStateSchema,
        value: null,
        readOnly: false,
      })

    const phaseSignal =
      signals.get(projectionPhaseSignalKey) ??
      signals.set({
        key: projectionPhaseSignalKey,
        schema: PlanPhaseSchema.exclude(['completed']),
        value: 'planning',
        readOnly: false,
      })

    const publish = (state: PlanState) => {
      planSignal.set?.(state)
      phaseSignal.set?.(state.phase === 'completed' ? 'verification' : state.phase)
      trigger({
        type: PLAN_FACTORY_EVENTS.plan_factory_updated,
        detail: {
          goal: state.goal,
          phase: state.phase,
          stepCount: state.steps.length,
          completedCount: state.steps.filter((step) => step.status === 'completed').length,
        },
      })
    }

    return {
      handlers: {
        [PLAN_FACTORY_EVENTS.plan_factory_set_plan](detail) {
          const parsed = SetPlanDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const steps = parsed.data.steps.map((step) =>
            RuntimePlanStepSchema.parse({
              ...step,
              status: 'pending',
            }),
          )
          publish(
            PlanStateSchema.parse({
              goal: parsed.data.goal,
              phase: 'planning',
              steps,
            }),
          )
        },
        [PLAN_FACTORY_EVENTS.plan_factory_step_update](detail) {
          const parsed = UpdatePlanStepDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (planSignal.get() ?? null) as PlanState | null
          if (!current) return
          const steps = current.steps.map((step) =>
            step.id === parsed.data.id ? { ...step, status: parsed.data.status, note: parsed.data.note } : step,
          )
          publish(
            PlanStateSchema.parse({
              ...current,
              steps,
              phase: derivePhase({ ...current, steps }),
            }),
          )
        },
        [PLAN_FACTORY_EVENTS.plan_factory_replan](detail) {
          const parsed = ReplanDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (planSignal.get() ?? null) as PlanState | null
          if (!current) return
          const steps = parsed.data.steps
            ? parsed.data.steps.map((step) =>
                RuntimePlanStepSchema.parse({
                  ...step,
                  status: 'pending',
                }),
              )
            : current.steps.map((step) =>
                RuntimePlanStepSchema.parse({
                  ...step,
                  status: step.status === 'completed' ? 'completed' : 'pending',
                  note: undefined,
                }),
              )
          publish(
            PlanStateSchema.parse({
              ...current,
              steps,
              phase: 'planning',
              lastReplanCause: parsed.data.cause,
            }),
          )
        },
      },
    }
  }
