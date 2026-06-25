import { ERROR_TYPES } from './controller.constants.ts'

export class ElementNotFoundError extends Error implements Error {
  override name = ERROR_TYPES.element_not_found
}

export class WebSocketMessageError extends Error implements Error {
  override name = ERROR_TYPES.web_socket_message
}

export class TriggerError extends Error implements Error {
  override name = ERROR_TYPES.trigger
}

export class PageExtensionError extends Error implements Error {
  override name = ERROR_TYPES.page_extension
}

export class WebSocketError extends Error implements Error {
  override name = ERROR_TYPES.web_socket
}

export class FormSubmitError extends Error implements Error {
  override name = ERROR_TYPES.form_submit
}
