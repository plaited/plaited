import { keyMirror } from '../utils.ts'

/**
 * @internal
 * Error name registry for use-html-rewriter errors.
 * Mirrors the controller's ERROR_TYPES pattern.
 */
export const ERROR_TYPES = keyMirror(
  'duplicate_context',
  'invalid_context_json',
  'invalid_resolver_result',
  'invalid_attribute',
  'event_handler_attribute',
  'stylesheet_not_allowed',
  'include_not_found',
  'include_cycle',
  'invalid_descriptor',
)
