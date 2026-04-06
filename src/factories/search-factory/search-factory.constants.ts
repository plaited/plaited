import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the search factory.
 *
 * @public
 */
export const SEARCH_FACTORY_EVENTS = keyMirror(
  'search_factory_search',
  'search_factory_results_updated',
  'search_factory_search_failed',
)

/**
 * Default signal keys used by the search factory.
 *
 * @public
 */
export const SEARCH_FACTORY_SIGNAL_KEYS = {
  results: 'search_factory_results',
} as const
