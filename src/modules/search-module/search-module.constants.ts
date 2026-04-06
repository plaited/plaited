import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the search module.
 *
 * @public
 */
export const SEARCH_MODULE_EVENTS = keyMirror(
  'search_module_search',
  'search_module_results_updated',
  'search_module_search_failed',
)

/**
 * Default signal keys used by the search module.
 *
 * @public
 */
export const SEARCH_MODULE_SIGNAL_KEYS = {
  results: 'search_module_results',
} as const
