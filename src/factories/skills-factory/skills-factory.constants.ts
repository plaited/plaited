import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the skills factory.
 *
 * @public
 */
export const SKILLS_FACTORY_EVENTS = keyMirror(
  'skills_factory_reload',
  'skills_factory_catalog_updated',
  'skills_factory_catalog_failed',
  'skills_factory_select',
  'skills_factory_selected',
  'skills_factory_selection_failed',
)

/**
 * Default signal keys used by the skills factory.
 *
 * @public
 */
export const SKILLS_FACTORY_SIGNAL_KEYS = {
  catalog: 'skills_factory_catalog',
  selected: 'skills_factory_selected',
} as const
