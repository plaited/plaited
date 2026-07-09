import { ERROR_TYPES } from './controller.constants.ts'

/**
 * Thrown when a server-pushed render or attrs message names a `p-target` that
 * no longer exists in the DOM.
 *
 * @public
 */
export class ElementNotFoundError extends Error implements Error {
  override name = ERROR_TYPES.element_not_found
}

/**
 * Thrown when an inbound WebSocket message fails JSON parsing or schema
 * validation in the controller's listener.
 *
 * @public
 */
export class WebSocketMessageError extends Error implements Error {
  override name = ERROR_TYPES.web_socket_message
}

/**
 * Thrown when a `p-trigger` event handler (non-extension path) throws while
 * dispatching a behavioral event to the agent.
 *
 * @public
 */
export class TriggerError extends Error implements Error {
  override name = ERROR_TYPES.trigger
}

/**
 * Thrown when a page lifecycle listener (`pagehide`, `pagereveal`,
 * `pageshow`, `pageswap`) or its registered hook throws.
 *
 * @public
 */
export class PageExtensionError extends Error implements Error {
  override name = ERROR_TYPES.page_extension
}

/**
 * Thrown for WebSocket-level failures: error events, unexpected targets, or
 * listener callbacks that fail outside the message-handling path.
 *
 * @public
 */
export class WebSocketError extends Error implements Error {
  override name = ERROR_TYPES.web_socket
}

/**
 * Thrown when a `p-form` submission's HTTP POST fails or returns a non-OK
 * status, or when the form submit handler itself throws.
 *
 * @public
 */
export class FormSubmitError extends Error implements Error {
  override name = ERROR_TYPES.form_submit
}

/**
 * Thrown when `CSSStyleSheet.replace` rejects while adopting a server-pushed
 * stylesheet, indicating invalid CSS.
 *
 * @public
 */
export class AdoptedStyleSheetsError extends Error implements Error {
  override name = ERROR_TYPES.adopt_style_sheet
}
