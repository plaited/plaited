import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the plan module.
 *
 * @public
 */
export const PLAN_MODULE_EVENTS = keyMirror(
  'plan_module_set_plan',
  'plan_module_step_update',
  'plan_module_replan',
  'plan_module_updated',
)

/**
 * Default signal keys used by the plan module.
 *
 * @public
 */
export const PLAN_MODULE_SIGNAL_KEYS = {
  plan: 'plan_module_state',
} as const
