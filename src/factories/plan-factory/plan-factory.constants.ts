import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the plan factory.
 *
 * @public
 */
export const PLAN_FACTORY_EVENTS = keyMirror(
  'plan_factory_set_plan',
  'plan_factory_step_update',
  'plan_factory_replan',
  'plan_factory_updated',
)

/**
 * Default signal keys used by the plan factory.
 *
 * @public
 */
export const PLAN_FACTORY_SIGNAL_KEYS = {
  plan: 'plan_factory_state',
} as const
