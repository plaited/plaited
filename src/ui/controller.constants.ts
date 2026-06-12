import { AGENT_TO_CONTROLLER_EVENTS } from '../shared/shared.constants.ts'
import { keyMirror } from '../utils.ts'

/** @internal WebSocket close codes that warrant reconnect attempts. */
export const UI_CORE_RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum reconnect attempts before a controller island gives up. */
export const UI_CORE_MAX_RETRIES = 3

/**
 * Controller diagnostic keys used for protocol handling failures.
 *
 * @public
 */
export const CONTROLLER_ERRORS = keyMirror(`${AGENT_TO_CONTROLLER_EVENTS.attrs}_element_not_found`)

/**
 * Event keys used for messages emitted by the browser controller toward the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_EVENTS = keyMirror('import_invoked', 'controller_connected')

export const PAGE_EVENTS = keyMirror('pagehide', 'pagereveal', 'pageshow', 'pageswap')
