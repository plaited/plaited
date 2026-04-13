import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the skills module.
 *
 * @public
 */
export const SKILLS_MODULE_EVENTS = keyMirror(
  'skills_module_reload',
  'skills_module_catalog_updated',
  'skills_module_catalog_failed',
  'skills_module_select',
  'skills_module_selected',
  'skills_module_selection_failed',
)

/**
 * Default signal keys used by the skills module.
 *
 * @public
 */
export const SKILLS_MODULE_SIGNAL_KEYS = {
  catalog: 'skills_module_catalog',
  selected: 'skills_module_selected',
} as const
