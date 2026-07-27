import { keyMirror } from '../utils.ts'

/** @internal Error name registry for HTML rendering errors. */
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
  'file_not_found',
)
/** @internal alias kept so existing error classes read unchanged after the
 * constants file was folded into this module during the restructure. */

/**
 * Thrown when a page/dynamic input file path does not exist.
 *
 * @public
 */
export class FileNotFoundError extends Error {
  override name = ERROR_TYPES.file_not_found
}

/**
 * Thrown when more than one `<script type="application/json" p-context>` is found in a file.
 *
 * @public
 */
export class DuplicateContextError extends Error {
  override name = ERROR_TYPES.duplicate_context
}

/**
 * Thrown when the `<script type="application/json" p-context>` content fails JSON.parse.
 *
 * @public
 */
export class InvalidContextJsonError extends Error {
  override name = ERROR_TYPES.invalid_context_json
}

/**
 * Thrown when the data resolver returns unexpected data (non-object when object expected,
 * or a top-level boolean).
 *
 * @public
 */
export class InvalidResolverResultError extends Error {
  override name = ERROR_TYPES.invalid_resolver_result
}

/**
 * Thrown when a bound attribute map fails schema validation against the element's
 * getNodeSchema(tag).attributes.
 *
 * @public
 */
export class InvalidAttributeError extends Error {
  override name = ERROR_TYPES.invalid_attribute
}

/**
 * Thrown when a bound object value contains a key starting with `on` (inline event handler).
 *
 * @public
 */
export class EventHandlerAttributeError extends Error {
  override name = ERROR_TYPES.event_handler_attribute
}

/**
 * Thrown when a `<link rel="stylesheet">` element is encountered in dynamic mode.
 *
 * @public
 */
export class StylesheetNotAllowedError extends Error {
  override name = ERROR_TYPES.stylesheet_not_allowed
}

/**
 * Thrown when an `<ssr-include>` src file or descriptor template file does not exist.
 *
 * @public
 */
export class IncludeNotFoundError extends Error {
  override name = ERROR_TYPES.include_not_found
}

/**
 * Thrown when a circular `<ssr-include>` or template include chain is detected.
 *
 * @public
 */
export class IncludeCycleError extends Error {
  override name = ERROR_TYPES.include_cycle
}

/**
 * Thrown when a p-context descriptor is malformed (missing kind, bad path, etc.).
 *
 * @public
 */
export class InvalidDescriptorError extends Error {
  override name = ERROR_TYPES.invalid_descriptor
  constructor(
    message: string,
    public readonly detail?: { pointer: string; token?: string },
  ) {
    super(message)
  }
}
