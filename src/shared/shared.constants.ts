import { keyMirror } from '../utils.ts'

/**
 * Event keys used for messages emitted by the behavioral engine to the browser
 * controller.
 *
 * @public
 */
export const SERVER_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'render', 'dispatch_custom_event', 'navigate')

/**
 * Event keys used for messages emitted by the browser controller to the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_SERVER_EVENTS = keyMirror('ui_event', 'error', 'form_submit', 'success', 'snapshot')

/**
 * Supported DOM insertion modes for `render` protocol messages.
 *
 * @remarks
 * These values align with the insertion positions accepted by the controller's
 * DOM update path, plus `innerHTML` and `outerHTML` replacement modes.
 *
 * @public
 */
export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const PAGE_EVENTS = keyMirror('pagereveal', 'pageswap', 'pagehide', 'pageshow')

/**
 * A2A (Agent2Agent) protocol JSON-RPC method names.
 *
 * @remarks
 * PascalCase names matching the A2A JSON-RPC protocol binding (Section 9).
 * The client transport validates the envelope only; method-specific params
 * are validated server-side via behavioral `sync({ block })`.
 *
 * @public
 */
export const A2A_METHODS = {
  GetExtendedAgentCard: 'GetExtendedAgentCard',
  SendMessage: 'SendMessage',
  GetTask: 'GetTask',
  ListTasks: 'ListTasks',
  CancelTask: 'CancelTask',
  SubscribeToTask: 'SubscribeToTask',
} as const

/** @public */
export type A2AMethod = (typeof A2A_METHODS)[keyof typeof A2A_METHODS]

/**
 * URI identifying the web-a2a extension.
 *
 * @remarks
 * Declared in each side's `AgentCard.capabilities.extensions[]`. When both
 * consumer and provider declare support, the `postMessage` handshake migrates
 * all subsequent RPC to a private `MessagePort`.
 *
 * @public
 */
export const WEB_A2A_EXTENSION_URI = 'https://plaited.dev/ext/web-a2a/v1'

export const P_FORM_TRIGGER = 'p-form-trigger'
