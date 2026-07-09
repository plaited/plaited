import { ERROR_TYPES } from './use-html-rewriter.constants.ts'

/**
 * Thrown when more than one `<script type="application/json" p-context>` is found in a file.
 *
 * @public
 */
export class DuplicateContextError extends Error {
  override name = ERROR_TYPES.duplicate_context
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when the `<script type="application/json" p-context>` content fails JSON.parse.
 *
 * @public
 */
export class InvalidContextJsonError extends Error {
  override name = ERROR_TYPES.invalid_context_json
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when the data resolver returns unexpected data (non-object when object expected,
 * or a top-level boolean).
 *
 * @public
 */
export class InvalidResolverResultError extends Error {
  override name = ERROR_TYPES.invalid_resolver_result
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when a bound attribute map fails schema validation against the element's
 * getNodeSchema(tag).attributes.
 *
 * @public
 */
export class InvalidAttributeError extends Error {
  override name = ERROR_TYPES.invalid_attribute
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when a bound object value contains a key starting with `on` (inline event handler).
 *
 * @public
 */
export class EventHandlerAttributeError extends Error {
  override name = ERROR_TYPES.event_handler_attribute
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when a `<link rel="stylesheet">` element is encountered in dynamic mode.
 *
 * @public
 */
export class StylesheetNotAllowedError extends Error {
  override name = ERROR_TYPES.stylesheet_not_allowed
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when an `<ssr-include>` src file or descriptor template file does not exist.
 *
 * @public
 */
export class IncludeNotFoundError extends Error {
  override name = ERROR_TYPES.include_not_found
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * Thrown when a circular `<ssr-include>` or template include chain is detected.
 *
 * @public
 */
export class IncludeCycleError extends Error {
  override name = ERROR_TYPES.include_cycle
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
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
